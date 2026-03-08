/**
 * AI Model Tournament — Conversation/Orchestrator Runner
 *
 * Tests models on tool selection, clarification behavior, and conversation flow.
 * For tool-capable models: evaluates tool calls directly.
 * For Anthropic: evaluates text response for intent (no tool calling support).
 */

import type {
  AICompletionRequest,
  AIMessage,
} from "../../_shared/ai-gateway/types.ts";
import { buildSystemPrompt } from "../../irmixy-chat-orchestrator/system-prompt.ts";
import { getRegisteredAiTools } from "../../_shared/tools/tool-registry.ts";
import { TEST_USER_CONTEXT } from "../config.ts";
import {
  type ApiKeys,
  callModelWithRetry,
  formatDuration,
} from "../helpers.ts";
import type {
  ConversationTestCase,
  ModelConfig,
  TestCaseResult,
} from "../types.ts";
import { RECIPE_CONVERSATION_HISTORY } from "../test-cases/fixtures.ts";

// ============================================================
// Intent Analysis (for Anthropic models without tool calling)
// ============================================================

const TOOL_INTENT_PATTERNS: Record<string, RegExp[]> = {
  generate_custom_recipe: [
    /generar|crear|preparar|hacer.*receta/i,
    /generate_custom_recipe/i,
    /voy a (?:crear|generar|preparar)/i,
  ],
  search_recipes: [
    /buscar|busco|búsqueda|encontrar.*recetas?/i,
    /search_recipes/i,
    /voy a buscar/i,
  ],
  modify_recipe: [
    /modificar|ajustar|cambiar.*receta/i,
    /modify_recipe/i,
    /voy a modificar/i,
  ],
  retrieve_cooked_recipes: [
    /historial|cocinaste|cocinado|cooked/i,
    /retrieve_cooked_recipes/i,
    /buscar.*historial/i,
  ],
};

function analyzeIntent(response: string): string | null {
  for (const [tool, patterns] of Object.entries(TOOL_INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(response)) return tool;
    }
  }
  return null;
}

// ============================================================
// Runner
// ============================================================

export async function runConversationTests(
  model: ModelConfig,
  testCases: ConversationTestCase[],
  apiKey: string,
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  const systemPrompt = buildSystemPrompt(TEST_USER_CONTEXT);
  const tools = getRegisteredAiTools();
  const useToolCalling = model.capabilities.toolCalling;
  const reasoningEffort = model.reasoningEffort.orchestrator ?? null;

  for (const testCase of testCases) {
    const testCaseId = testCase.id;
    const isMultiTurn = testCase.turns.length > 1;
    const messages: AIMessage[] = [{ role: "system", content: systemPrompt }];

    // For conv-5-modify, add conversation history context
    if (testCaseId === "conv-5-modify") {
      messages.push(...RECIPE_CONVERSATION_HISTORY);
    }

    let finalStatus: TestCaseResult["status"] = "pass";
    let totalLatencyMs = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let allAttempts: TestCaseResult["attempts"] = [];
    let finalResponseContent = "";
    let finalToolCalled: string | null = null;
    let finalError: string | undefined;
    let failureType: TestCaseResult["failureType"] = null;

    // Process each turn
    const lastTurnIndex = testCase.turns.length - 1;

    for (let turnIdx = 0; turnIdx < testCase.turns.length; turnIdx++) {
      const turn = testCase.turns[turnIdx];
      const isLastTurn = turnIdx === lastTurnIndex;

      messages.push({ role: "user", content: turn.userMessage });

      const request: AICompletionRequest = {
        usageType: "text",
        messages: [...messages],
        maxTokens: 2048,
        ...(reasoningEffort ? { reasoningEffort } : {}),
        ...(useToolCalling ? { tools, toolChoice: "auto" as const } : {}),
      };

      try {
        const result = await callModelWithRetry(model, request, apiKey);
        const response = result.response;

        totalLatencyMs += result.totalLatencyMs;
        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;
        totalCostUsd += result.totalCostUsd;
        allAttempts = allAttempts.concat(result.attempts);
        finalResponseContent = response.content;

        // Append assistant response for multi-turn
        messages.push({ role: "assistant", content: response.content });

        // Only evaluate the last turn (or the only turn for single-turn)
        if (isLastTurn) {
          if (useToolCalling) {
            finalToolCalled =
              response.toolCalls && response.toolCalls.length > 0
                ? response.toolCalls[0].name
                : null;
          } else {
            finalToolCalled = analyzeIntent(response.content);
          }

          // Evaluate correctness
          const expected = turn.expectedTool;
          if (expected === null) {
            // Should NOT call any tool
            if (finalToolCalled !== null) {
              finalStatus = "fail";
              failureType = "quality";
            }
          } else {
            // Should call a specific tool
            if (finalToolCalled !== expected) {
              finalStatus = "fail";
              failureType = "quality";
            }
          }
        } else {
          // For non-last turns: check that no tool was called (should be clarifying)
          const intermediateTool = useToolCalling
            ? (response.toolCalls && response.toolCalls.length > 0
              ? response.toolCalls[0].name
              : null)
            : analyzeIntent(response.content);

          if (turn.expectedTool === null && intermediateTool !== null) {
            // Model jumped ahead — fail
            finalStatus = "fail";
            failureType = "quality";
            finalToolCalled = intermediateTool;
            finalResponseContent = `[Turn ${turnIdx + 1}] ${response.content}`;
            break;
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        finalStatus = "fail";
        failureType = "transient";
        finalError = err.message;
        finalResponseContent = `ERROR: ${err.message}`;
        break;
      }
    }

    const tag = finalStatus === "pass" ? "✓" : "✗";
    const evalMethod = useToolCalling ? "tool" : "intent";
    console.log(
      `  ${tag} ${testCaseId} (${evalMethod}) ${
        formatDuration(totalLatencyMs)
      } [${allAttempts.length} attempt(s)]`,
    );

    results.push({
      modelId: model.id,
      role: "orchestrator",
      testCaseId,
      testCaseDescription: testCase.description,
      status: finalStatus,
      latencyMs: totalLatencyMs,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd: totalCostUsd,
      reasoningEffort: reasoningEffort,
      attempts: allAttempts,
      failureType,
      responseContent: finalResponseContent,
      error: finalError,
      toolCalled: finalToolCalled,
      expectedTool: testCase.turns[lastTurnIndex].expectedTool,
      toolCorrect: finalStatus === "pass",
      evaluationMethod: useToolCalling ? "tool_call" : "intent_analysis",
      turns: isMultiTurn ? testCase.turns.length : 1,
    });
  }

  return results;
}
