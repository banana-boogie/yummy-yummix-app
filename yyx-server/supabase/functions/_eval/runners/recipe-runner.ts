/**
 * AI Model Tournament — Recipe Generation Runner
 *
 * Tests models on recipe generation quality with Zod validation.
 * For reasoning-capable models, runs each test case at both "low" and "medium"
 * effort to measure the quality/speed tradeoff.
 */

import type { AICompletionRequest } from "../../_shared/ai-gateway/types.ts";
import {
  buildRecipeJsonSchema,
  getSystemPrompt,
  parseAndValidateGeneratedRecipe,
} from "../../_shared/tools/generate-custom-recipe.ts";
import { TEST_USER_CONTEXT } from "../config.ts";
import {
  type ApiKeys,
  callModelWithRetry,
  formatDuration,
} from "../helpers.ts";
import type {
  EvalRole,
  ModelConfig,
  RecipeTestCase,
  TestCaseResult,
} from "../types.ts";

// ============================================================
// Prompt Builder
// ============================================================

/**
 * Build user prompt for recipe generation (mirrors production buildRecipeGenerationPrompt
 * but simplified since we don't have allergen/safety DB lookups).
 */
function buildRecipePrompt(testCase: RecipeTestCase): string {
  const parts: string[] = [];

  if (testCase.recipeDescription) {
    parts.push(`Create a recipe for: ${testCase.recipeDescription}`);
    parts.push(`Available ingredients: ${testCase.ingredients.join(", ")}`);
  } else {
    parts.push(
      `Create a recipe using these ingredients: ${
        testCase.ingredients.join(", ")
      }`,
    );
  }

  parts.push(`Portions: ${TEST_USER_CONTEXT.householdSize ?? 4}.`);

  if (testCase.targetTime) {
    parts.push(
      `Total time should be around ${testCase.targetTime} minutes or less.`,
    );
  }

  if (testCase.cuisinePreference) {
    parts.push(`Style: ${testCase.cuisinePreference} cuisine.`);
  }

  if (testCase.difficulty) {
    parts.push(`Difficulty level: ${testCase.difficulty}.`);
  }

  if (testCase.additionalRequests) {
    parts.push(`Additional requirements: ${testCase.additionalRequests}`);
  }

  // Hard requirements from test persona
  if (TEST_USER_CONTEXT.ingredientDislikes.length > 0) {
    parts.push("\n⚠️ HARD REQUIREMENTS (must follow):");
    parts.push(
      `MUST AVOID these ingredients: ${
        TEST_USER_CONTEXT.ingredientDislikes.join(", ")
      }`,
    );
  }

  // Equipment
  if (TEST_USER_CONTEXT.kitchenEquipment.length > 0) {
    parts.push("\n🍳 AVAILABLE EQUIPMENT:");
    parts.push(
      `User has: ${
        TEST_USER_CONTEXT.kitchenEquipment.join(", ")
      }. Use where appropriate for the best result.`,
    );
  }

  // Soft preferences
  if (
    TEST_USER_CONTEXT.cuisinePreferences.length > 0 &&
    !testCase.cuisinePreference
  ) {
    parts.push("\n📝 Soft preferences (consider but be creative):");
    parts.push(
      `Cuisine inspiration (OPTIONAL): User enjoys ${
        TEST_USER_CONTEXT.cuisinePreferences.join(", ")
      } cooking.`,
    );
  }

  return parts.join("\n");
}

// ============================================================
// Runner
// ============================================================

export async function runRecipeTests(
  model: ModelConfig,
  testCases: RecipeTestCase[],
  apiKey: string,
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  const systemPrompt = getSystemPrompt(TEST_USER_CONTEXT);
  const hasThermomix = true; // Test persona has Thermomix TM6
  const recipeSchema = buildRecipeJsonSchema(hasThermomix);
  const useJsonSchema = model.capabilities.jsonSchema;

  // Determine reasoning effort variants to test
  const effortVariants: Array<string | null> = [];

  if (model.capabilities.reasoning) {
    // Run at both low and medium for quality/speed comparison
    effortVariants.push("low");
    effortVariants.push("medium");
  } else {
    effortVariants.push(null);
  }

  for (const effort of effortVariants) {
    const effortLabel = effort ? ` (${effort})` : "";

    for (const testCase of testCases) {
      const userPrompt = buildRecipePrompt(testCase);

      const request: AICompletionRequest = {
        usageType: "recipe_generation",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 6144,
        ...(effort
          ? {
            reasoningEffort: effort as AICompletionRequest["reasoningEffort"],
          }
          : { temperature: 0.7 }),
        ...(useJsonSchema
          ? {
            responseFormat: {
              type: "json_schema" as const,
              schema: recipeSchema,
            },
          }
          : {}),
      };

      try {
        const result = await callModelWithRetry(model, request, apiKey);
        const response = result.response;
        const content = response.content;

        // Evaluate: JSON parseable? Schema valid? Thermomix present?
        let jsonValid = false;
        let schemaValid = false;
        let thermomixPresent = false;

        try {
          const recipe = parseAndValidateGeneratedRecipe(content);
          jsonValid = true;
          schemaValid = true;
          thermomixPresent = recipe.steps.some(
            (s) =>
              s.thermomixTime != null ||
              s.thermomixTemp != null ||
              s.thermomixSpeed != null,
          );
        } catch {
          // Try just JSON.parse to distinguish JSON failure from schema failure
          try {
            let jsonContent = content.trim();
            if (jsonContent.startsWith("```")) {
              jsonContent = jsonContent
                .replace(/^```(?:json)?\s*\n?/, "")
                .replace(/\n?```\s*$/, "");
            }
            JSON.parse(jsonContent);
            jsonValid = true;
            // JSON parsed but schema validation failed
          } catch {
            // Complete JSON parse failure
          }
        }

        const status = schemaValid ? "pass" : "fail";
        const tag = status === "pass" ? "✓" : "✗";
        console.log(
          `  ${tag} ${testCase.id}${effortLabel} ${
            formatDuration(result.totalLatencyMs)
          } json=${jsonValid} schema=${schemaValid} tmx=${thermomixPresent}`,
        );

        results.push({
          modelId: effort ? `${model.id} (${effort})` : model.id,
          role: "recipe_generation",
          testCaseId: testCase.id,
          testCaseDescription: testCase.description,
          status,
          latencyMs: result.totalLatencyMs,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          costUsd: result.totalCostUsd,
          reasoningEffort: effort,
          attempts: result.attempts,
          failureType: status === "fail" ? "quality" : null,
          responseContent: content,
          jsonValid,
          schemaValid,
          thermomixPresent,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.log(`  ✗ ${testCase.id}${effortLabel} ERROR: ${err.message}`);

        results.push({
          modelId: effort ? `${model.id} (${effort})` : model.id,
          role: "recipe_generation",
          testCaseId: testCase.id,
          testCaseDescription: testCase.description,
          status: "fail",
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          reasoningEffort: effort,
          attempts: [],
          failureType: "transient",
          responseContent: `ERROR: ${err.message}`,
          error: err.message,
          jsonValid: false,
          schemaValid: false,
          thermomixPresent: false,
        });
      }
    }
  }

  return results;
}
