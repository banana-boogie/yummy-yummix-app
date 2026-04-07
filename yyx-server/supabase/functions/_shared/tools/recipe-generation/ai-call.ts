/**
 * AI Gateway call for recipe generation, including retry logic and response parsing.
 */

import type { GeneratedRecipe, UserContext } from "../../irmixy-schemas.ts";
import { GeneratedRecipeSchema } from "../../irmixy-schemas.ts";
import { chat } from "../../ai-gateway/index.ts";
import type { CostContext } from "../../ai-gateway/types.ts";
import { hasThermomix } from "../../equipment-utils.ts";
import { logAIUsage } from "../../usage-logger.ts";
import type { GenerateRecipeParams } from "../tool-validators.ts";
import type { AIUsageLogContext } from "./types.ts";
import {
  buildRecipeGenerationPrompt,
  buildRecipeJsonSchema,
  getSystemPrompt,
} from "./prompts.ts";

/**
 * Parse raw AI response content and validate against the GeneratedRecipe schema.
 * Exported for use by modify-recipe and eval runners.
 */
export function parseAndValidateGeneratedRecipe(
  content: string,
): GeneratedRecipe {
  // Strip code fences if model wraps response in ```json ... ```
  let jsonContent = content.trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch {
    console.error(
      "Failed to parse recipe JSON:",
      jsonContent.slice(0, 500),
    );
    throw new Error("Invalid recipe JSON from AI");
  }

  const result = GeneratedRecipeSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Recipe validation failed:", result.error.issues);
    throw new Error("Generated recipe does not match schema");
  }

  // Force empty tags — AI-generated tags are never displayed in UI
  result.data.tags = [];

  return result.data;
}

/**
 * Call AI Gateway to generate the recipe.
 * Uses the 'recipe_generation' usage type for structured recipe output.
 * Uses one local retry if parsing/validation fails.
 */
export async function callRecipeGenerationAI(
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
  options?: {
    allergenWarning?: string;
    usageContext?: AIUsageLogContext;
    allergenPromptSection?: string;
  },
  costContext?: CostContext,
): Promise<GeneratedRecipe> {
  const prompt = buildRecipeGenerationPrompt(
    params,
    userContext,
    safetyReminders,
    options,
  );
  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);
  const recipeSchema = buildRecipeJsonSchema(isThermomixUser);
  let systemPrompt = getSystemPrompt(userContext);

  // Append allergen ingredient list if available
  if (options?.allergenPromptSection) {
    systemPrompt += options.allergenPromptSection;
  }

  const strictRetryPromptSuffix =
    "\n\nCRITICAL: Return ONLY raw JSON. No markdown, no code fences, no explanation text.";

  let lastError: Error | null = null;

  const usageContext = options?.usageContext;

  /** Fire-and-forget usage log for recipe generation attempts. */
  function fireRecipeUsageLog(
    attemptIndex: number,
    status: "success" | "error",
    startTime: number,
    response?: {
      model: string;
      usage: { inputTokens: number; outputTokens: number };
    },
  ) {
    if (!usageContext) return;
    void logAIUsage({
      userId: usageContext.userId,
      sessionId: usageContext.sessionId,
      requestId: usageContext.requestId,
      callPhase: "recipe_generation",
      attempt: attemptIndex,
      status,
      functionName: usageContext.functionName,
      usageType: "recipe_generation",
      model: response?.model ?? null,
      inputTokens: response?.usage.inputTokens ?? null,
      outputTokens: response?.usage.outputTokens ?? null,
      durationMs: Math.round(performance.now() - startTime),
      metadata: {
        streaming: false,
        request_type: "recipe_generation",
        source: "generate_custom_recipe",
      },
    });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const isRetry = attempt === 1;
    const llmStart = performance.now();
    let response: {
      content: string;
      model: string;
      usage: { inputTokens: number; outputTokens: number };
    };

    try {
      response = await chat({
        usageType: "recipe_generation",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: isRetry ? prompt + strictRetryPromptSuffix : prompt,
          },
        ],
        temperature: 0.7,
        maxTokens: 6144,
        responseFormat: {
          type: "json_schema",
          schema: recipeSchema,
        },
        costContext,
      });
    } catch (error) {
      fireRecipeUsageLog(attempt, "error", llmStart);
      throw error;
    }

    try {
      const parsedRecipe = parseAndValidateGeneratedRecipe(response.content);
      fireRecipeUsageLog(attempt, "success", llmStart, response);
      return parsedRecipe;
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error("Recipe parsing failed");
      fireRecipeUsageLog(attempt, "error", llmStart, response);

      if (!isRetry) {
        console.warn(
          "[Recipe Generation] First parse/validation attempt failed, retrying once",
          {
            error: lastError.message,
          },
        );
      }
    }
  }

  throw lastError || new Error("Generated recipe does not match schema");
}
