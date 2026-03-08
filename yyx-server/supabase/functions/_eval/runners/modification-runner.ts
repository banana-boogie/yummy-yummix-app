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
import { TEST_USER_CONTEXT } from "../config.ts";
import { callModelWithRetry, formatDuration } from "../helpers.ts";
import type {
  ModelConfig,
  ModificationTestCase,
  TestCaseResult,
} from "../types.ts";
import { BASE_RECIPE } from "../test-cases/fixtures.ts";

// ============================================================
// Runner
// ============================================================

export async function runModificationTests(
  model: ModelConfig,
  testCases: ModificationTestCase[],
  apiKey: string,
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  const systemPrompt = getModificationSystemPrompt(TEST_USER_CONTEXT);
  const hasThermomix = true;
  const recipeSchema = buildRecipeJsonSchema(hasThermomix);
  const useJsonSchema = model.capabilities.jsonSchema;
  const reasoningEffort = model.reasoningEffort.recipe_modification ?? null;

  for (const testCase of testCases) {
    // Build the modification prompt using the production function
    const modParams = { modificationRequest: testCase.modificationRequest };
    const userPrompt = buildModificationPrompt(
      BASE_RECIPE,
      modParams,
      TEST_USER_CONTEXT,
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

    try {
      const result = await callModelWithRetry(model, request, apiKey);
      const response = result.response;
      const content = response.content;

      // Evaluate
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

      const status = schemaValid ? "pass" : "fail";
      const tag = status === "pass" ? "✓" : "✗";
      console.log(
        `  ${tag} ${testCase.id} ${
          formatDuration(result.totalLatencyMs)
        } json=${jsonValid} schema=${schemaValid} tmx=${thermomixPresent}`,
      );

      results.push({
        modelId: model.id,
        role: "recipe_modification",
        testCaseId: testCase.id,
        testCaseDescription: testCase.description,
        status,
        latencyMs: result.totalLatencyMs,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: result.totalCostUsd,
        reasoningEffort,
        attempts: result.attempts,
        failureType: status === "fail" ? "quality" : null,
        responseContent: content,
        jsonValid,
        schemaValid,
        thermomixPresent,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.log(`  ✗ ${testCase.id} ERROR: ${err.message}`);

      results.push({
        modelId: model.id,
        role: "recipe_modification",
        testCaseId: testCase.id,
        testCaseDescription: testCase.description,
        status: "fail",
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        reasoningEffort,
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

  return results;
}
