/**
 * AI Model Tournament — Recipe Generation Runner
 *
 * Tests models on recipe generation quality with Zod validation.
 * Variants tested:
 *   - Reasoning: minimal vs low (for reasoning-capable models)
 *   - Schema: with vs without JSON schema enforcement
 */

import type { AICompletionRequest } from "../../_shared/ai-gateway/types.ts";
import {
  buildRecipeJsonSchema,
  getSystemPrompt,
  parseAndValidateGeneratedRecipe,
} from "../../_shared/tools/generate-custom-recipe.ts";
import { TEST_USER_CONTEXT, TEST_USER_CONTEXT_EN } from "../config.ts";
import {
  callModelWithRetry,
  formatDuration,
  ROLE_TIMEOUTS,
} from "../helpers.ts";
import type { ModelConfig, RecipeTestCase, TestCaseResult } from "../types.ts";

// ============================================================
// Prompt Builder
// ============================================================

import type { UserContext } from "../../_shared/irmixy-schemas.ts";

function getUserContext(testCase: { language?: "en" | "es" }): UserContext {
  return testCase.language === "en" ? TEST_USER_CONTEXT_EN : TEST_USER_CONTEXT;
}

function buildRecipePrompt(testCase: RecipeTestCase): string {
  const userContext = getUserContext(testCase);
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

  parts.push(`Portions: ${userContext.householdSize ?? 4}.`);

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

  if (userContext.ingredientDislikes.length > 0) {
    parts.push("\n⚠️ HARD REQUIREMENTS (must follow):");
    parts.push(
      `MUST AVOID these ingredients: ${
        userContext.ingredientDislikes.join(", ")
      }`,
    );
  }

  if (userContext.kitchenEquipment.length > 0) {
    parts.push("\n🍳 AVAILABLE EQUIPMENT:");
    parts.push(
      `User has: ${
        userContext.kitchenEquipment.join(", ")
      }. Use where appropriate for the best result.`,
    );
  }

  if (
    userContext.cuisinePreferences.length > 0 &&
    !testCase.cuisinePreference
  ) {
    parts.push("\n📝 Soft preferences (consider but be creative):");
    parts.push(
      `Cuisine inspiration (OPTIONAL): User enjoys ${
        userContext.cuisinePreferences.join(", ")
      } cooking.`,
    );
  }

  return parts.join("\n");
}

// ============================================================
// Types for test variants
// ============================================================

interface RecipeVariant {
  effort: string | null;
  useSchema: boolean;
  label: string;
}

// ============================================================
// Runner
// ============================================================

export async function runRecipeTests(
  model: ModelConfig,
  testCases: RecipeTestCase[],
  apiKey: string,
): Promise<TestCaseResult[]> {
  // Cache system prompts and schemas per language
  const promptCache = new Map<
    string,
    { systemPrompt: string; recipeSchema: Record<string, unknown> }
  >();
  function getPromptAndSchema(lang: "en" | "es") {
    if (!promptCache.has(lang)) {
      const ctx = lang === "en" ? TEST_USER_CONTEXT_EN : TEST_USER_CONTEXT;
      promptCache.set(lang, {
        systemPrompt: getSystemPrompt(ctx),
        recipeSchema: buildRecipeJsonSchema(true),
      });
    }
    return promptCache.get(lang)!;
  }
  const canUseJsonSchema = model.capabilities.jsonSchema;

  // Build all variants to test
  // Schema enforcement is always on — previous runs proved it's essential
  // (without it: 0-33% pass rate) and adds no meaningful latency.
  const variants: RecipeVariant[] = [];

  if (model.capabilities.reasoning) {
    // Reasoning models: test none, minimal, and low effort levels
    variants.push({ effort: null, useSchema: true, label: "no-reasoning" });
    variants.push({ effort: "minimal", useSchema: true, label: "minimal" });
    variants.push({ effort: "low", useSchema: true, label: "low" });
  } else {
    // Non-reasoning models: single variant with schema
    variants.push({ effort: null, useSchema: true, label: "" });
  }

  // Run all variant × test case combinations in parallel
  const promises: Promise<TestCaseResult>[] = [];

  for (const variant of variants) {
    const variantLabel = variant.label ? ` (${variant.label})` : "";

    for (const testCase of testCases) {
      promises.push((async () => {
        const lang = testCase.language ?? "es";
        const { systemPrompt, recipeSchema } = getPromptAndSchema(lang);
        const userPrompt = buildRecipePrompt(testCase);

        const request: AICompletionRequest = {
          usageType: "recipe_generation",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          maxTokens: 6144,
          ...(variant.effort
            ? {
              reasoningEffort: variant
                .effort as AICompletionRequest["reasoningEffort"],
            }
            : model.capabilities.reasoning
            ? {} // Reasoning-capable models reject explicit temperature
            : { temperature: model.temperatureFixed ?? 0.7 }),
          ...(variant.useSchema && canUseJsonSchema
            ? {
              responseFormat: {
                type: "json_schema" as const,
                schema: recipeSchema,
              },
            }
            : {}),
        };

        const testStart = performance.now();
        try {
          const result = await callModelWithRetry(
            model,
            request,
            apiKey,
            ROLE_TIMEOUTS.recipe_generation,
          );
          const response = result.response;
          const content = response.content;

          let jsonValid = false;
          let schemaValid = false;
          let thermomixPresent = false;
          let kitchenToolsPresent = false;
          let kitchenToolsCount = 0;

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
            kitchenToolsPresent = Array.isArray(recipe.kitchenTools) &&
              recipe.kitchenTools.length > 0;
            kitchenToolsCount = recipe.kitchenTools?.length ?? 0;
          } catch {
            try {
              let jsonContent = content.trim();
              if (jsonContent.startsWith("```")) {
                jsonContent = jsonContent
                  .replace(/^```(?:json)?\s*\n?/, "")
                  .replace(/\n?```\s*$/, "");
              }
              JSON.parse(jsonContent);
              jsonValid = true;
            } catch {
              // Complete JSON parse failure
            }
          }

          const outputTokensPerSec = response.usage.outputTokens > 0
            ? Math.round(
              (response.usage.outputTokens / result.totalLatencyMs) * 1000,
            )
            : 0;

          const status = schemaValid ? "pass" : "fail";
          const tag = status === "pass" ? "✓" : "✗";
          const schemaTag = variant.useSchema ? "schema" : "no-schema";
          console.log(
            `  ${tag} ${testCase.id}${variantLabel} ${
              formatDuration(result.totalLatencyMs)
            } ${outputTokensPerSec} tok/s [${schemaTag}] json=${jsonValid} schema=${schemaValid} tmx=${thermomixPresent} items=${kitchenToolsCount}`,
          );

          return {
            modelId: variant.label
              ? `${model.id} (${variant.label})`
              : model.id,
            role: "recipe_generation" as const,
            testCaseId: testCase.id,
            testCaseDescription: testCase.description,
            status,
            latencyMs: result.totalLatencyMs,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            costUsd: result.totalCostUsd,
            reasoningEffort: variant.effort,
            attempts: result.attempts,
            failureType:
              (status === "fail" ? "quality" : null) as TestCaseResult[
                "failureType"
              ],
            responseContent: content,
            outputTokensPerSec,
            jsonValid,
            schemaValid,
            thermomixPresent,
            kitchenToolsPresent,
            kitchenToolsCount,
            schemaEnforced: variant.useSchema,
          };
        } catch (error) {
          const testLatency = Math.round(performance.now() - testStart);
          const err = error instanceof Error ? error : new Error(String(error));
          console.log(
            `  ✗ ${testCase.id}${variantLabel} ERROR: ${err.message}`,
          );

          return {
            modelId: variant.label
              ? `${model.id} (${variant.label})`
              : model.id,
            role: "recipe_generation" as const,
            testCaseId: testCase.id,
            testCaseDescription: testCase.description,
            status: "fail" as const,
            latencyMs: testLatency,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            reasoningEffort: variant.effort,
            attempts: [],
            failureType: "transient" as const,
            responseContent: `ERROR: ${err.message}`,
            error: err.message,
            outputTokensPerSec: 0,
            jsonValid: false,
            schemaValid: false,
            thermomixPresent: false,
            schemaEnforced: variant.useSchema,
          };
        }
      })());
    }
  }

  return await Promise.all(promises);
}
