/**
 * AI Model Tournament — Recipe Modification Runner
 *
 * Tests models on modifying an existing recipe (base fixture).
 * Evaluates JSON validity, schema compliance, and Thermomix parameter preservation.
 */

import type { AICompletionRequest } from "../../_shared/ai-gateway/types.ts";
import {
  buildRecipeJsonSchema,
  parseAndValidateGeneratedRecipe,
} from "../../_shared/tools/generate-custom-recipe.ts";
import {
  buildModificationPrompt,
  getModificationSystemPrompt,
} from "../../_shared/tools/modify-recipe.ts";
import { TEST_USER_CONTEXT, TEST_USER_CONTEXT_EN } from "../config.ts";
import {
  callModelWithRetry,
  formatDuration,
  ROLE_TIMEOUTS,
} from "../helpers.ts";
import type {
  ModelConfig,
  ModificationTestCase,
  TestCaseResult,
} from "../types.ts";
import type { UserContext } from "../../_shared/irmixy-schemas.ts";
import { BASE_RECIPE } from "../test-cases/fixtures.ts";

function getUserContext(testCase: { language?: "en" | "es" }): UserContext {
  return testCase.language === "en" ? TEST_USER_CONTEXT_EN : TEST_USER_CONTEXT;
}

// ============================================================
// Runner
// ============================================================

export async function runModificationTests(
  model: ModelConfig,
  testCases: ModificationTestCase[],
  apiKey: string,
): Promise<TestCaseResult[]> {
  const useJsonSchema = model.capabilities.jsonSchema;
  const reasoningEffort = model.reasoningEffort.recipe_modification ?? null;

  // Cache system prompts per language
  const promptCache = new Map<
    string,
    { systemPrompt: string; recipeSchema: Record<string, unknown> }
  >();
  function getPromptAndSchema(lang: "en" | "es") {
    if (!promptCache.has(lang)) {
      const ctx = lang === "en" ? TEST_USER_CONTEXT_EN : TEST_USER_CONTEXT;
      promptCache.set(lang, {
        systemPrompt: getModificationSystemPrompt(ctx),
        recipeSchema: buildRecipeJsonSchema(true),
      });
    }
    return promptCache.get(lang)!;
  }

  // Run all test cases in parallel
  const promises = testCases.map((testCase) =>
    (async (): Promise<TestCaseResult> => {
      const lang = testCase.language ?? "es";
      const userContext = getUserContext(testCase);
      const { systemPrompt, recipeSchema } = getPromptAndSchema(lang);
      const modParams = { modificationRequest: testCase.modificationRequest };
      const userPrompt = buildModificationPrompt(
        BASE_RECIPE,
        modParams,
        userContext,
      );

      const request: AICompletionRequest = {
        usageType: "recipe_modification",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 6144,
        ...(reasoningEffort
          ? {
            reasoningEffort:
              reasoningEffort as AICompletionRequest["reasoningEffort"],
          }
          : {}),
        ...(useJsonSchema
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
          ROLE_TIMEOUTS.recipe_modification,
        );
        const response = result.response;
        const content = response.content;

        let jsonValid = false;
        let schemaValid = false;
        let thermomixPresent = false;
        let usefulItemsPresent = false;
        let usefulItemsCount = 0;

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
          usefulItemsPresent = Array.isArray(recipe.usefulItems) &&
            recipe.usefulItems.length > 0;
          usefulItemsCount = recipe.usefulItems?.length ?? 0;
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

        const status = schemaValid ? "pass" : "fail";
        const tag = status === "pass" ? "✓" : "✗";
        console.log(
          `  ${tag} ${testCase.id} ${
            formatDuration(result.totalLatencyMs)
          } json=${jsonValid} schema=${schemaValid} tmx=${thermomixPresent} items=${usefulItemsCount}`,
        );

        const outputTokensPerSec = response.usage.outputTokens > 0
          ? Math.round(
            (response.usage.outputTokens / result.totalLatencyMs) * 1000,
          )
          : 0;

        return {
          modelId: model.id,
          role: "recipe_modification" as const,
          testCaseId: testCase.id,
          testCaseDescription: testCase.description,
          status,
          latencyMs: result.totalLatencyMs,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          outputTokensPerSec,
          costUsd: result.totalCostUsd,
          reasoningEffort,
          attempts: result.attempts,
          failureType: (status === "fail" ? "quality" : null) as TestCaseResult[
            "failureType"
          ],
          responseContent: content,
          jsonValid,
          schemaValid,
          thermomixPresent,
          usefulItemsPresent,
          usefulItemsCount,
        };
      } catch (error) {
        const testLatency = Math.round(performance.now() - testStart);
        const err = error instanceof Error ? error : new Error(String(error));
        console.log(`  ✗ ${testCase.id} ERROR: ${err.message}`);

        return {
          modelId: model.id,
          role: "recipe_modification" as const,
          testCaseId: testCase.id,
          testCaseDescription: testCase.description,
          status: "fail" as const,
          latencyMs: testLatency,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          reasoningEffort,
          attempts: [],
          failureType: "transient" as const,
          responseContent: `ERROR: ${err.message}`,
          error: err.message,
          jsonValid: false,
          schemaValid: false,
          thermomixPresent: false,
        };
      }
    })()
  );

  return await Promise.all(promises);
}
