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
import { TEST_USER_CONTEXT } from "../config.ts";
import {
  callModelWithRetry,
  formatDuration,
  ROLE_TIMEOUTS,
} from "../helpers.ts";
import type { ModelConfig, RecipeTestCase, TestCaseResult } from "../types.ts";

// ============================================================
// Prompt Builder
// ============================================================

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

  if (TEST_USER_CONTEXT.ingredientDislikes.length > 0) {
    parts.push("\n⚠️ HARD REQUIREMENTS (must follow):");
    parts.push(
      `MUST AVOID these ingredients: ${
        TEST_USER_CONTEXT.ingredientDislikes.join(", ")
      }`,
    );
  }

  if (TEST_USER_CONTEXT.kitchenEquipment.length > 0) {
    parts.push("\n🍳 AVAILABLE EQUIPMENT:");
    parts.push(
      `User has: ${
        TEST_USER_CONTEXT.kitchenEquipment.join(", ")
      }. Use where appropriate for the best result.`,
    );
  }

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
  const systemPrompt = getSystemPrompt(TEST_USER_CONTEXT);
  const hasThermomix = true;
  const recipeSchema = buildRecipeJsonSchema(hasThermomix);
  const canUseJsonSchema = model.capabilities.jsonSchema;

  // Build all variants to test
  const variants: RecipeVariant[] = [];

  if (model.capabilities.reasoning) {
    // Reasoning models: test minimal with schema, minimal without schema, low with schema
    variants.push({ effort: "minimal", useSchema: true, label: "minimal" });
    if (canUseJsonSchema) {
      variants.push({
        effort: "minimal",
        useSchema: false,
        label: "minimal, no-schema",
      });
    }
    variants.push({ effort: "low", useSchema: true, label: "low" });
  } else {
    // Non-reasoning models: test with schema and without schema
    variants.push({ effort: null, useSchema: true, label: "" });
    if (canUseJsonSchema) {
      variants.push({ effort: null, useSchema: false, label: "no-schema" });
    }
  }

  // Run all variant × test case combinations in parallel
  const promises: Promise<TestCaseResult>[] = [];

  for (const variant of variants) {
    const variantLabel = variant.label ? ` (${variant.label})` : "";

    for (const testCase of testCases) {
      promises.push((async () => {
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
            } ${outputTokensPerSec} tok/s [${schemaTag}] json=${jsonValid} schema=${schemaValid} tmx=${thermomixPresent}`,
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
