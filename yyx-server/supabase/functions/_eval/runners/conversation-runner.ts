/**
 * AI Model Tournament — Conversation/Orchestrator Runner
 *
 * Tests models on tool selection, clarification behavior, and conversation flow.
 * All models use tool calling for evaluation (Anthropic now supports it).
 */

import type {
  AICompletionRequest,
  AIMessage,
} from "../../_shared/ai-gateway/types.ts";
import { buildSystemPrompt } from "../../irmixy-chat-orchestrator/system-prompt.ts";
import { getRegisteredAiTools } from "../../_shared/tools/tool-registry.ts";
import { TEST_USER_CONTEXT, TEST_USER_CONTEXT_EN } from "../config.ts";
import {
  callModelWithRetry,
  formatDuration,
  ROLE_TIMEOUTS,
} from "../helpers.ts";
import type {
  ConversationTestCase,
  ModelConfig,
  TestCaseResult,
} from "../types.ts";
import { RECIPE_CONVERSATION_HISTORY } from "../test-cases/fixtures.ts";

// ============================================================
// Runner
// ============================================================

export async function runConversationTests(
  model: ModelConfig,
  testCases: ConversationTestCase[],
  apiKey: string,
): Promise<TestCaseResult[]> {
  const tools = getRegisteredAiTools();

  // Cache system prompts per language
  const promptCache = new Map<string, string>();
  function getSystemPromptForLang(lang: "en" | "es"): string {
    if (!promptCache.has(lang)) {
      const ctx = lang === "en" ? TEST_USER_CONTEXT_EN : TEST_USER_CONTEXT;
      promptCache.set(lang, buildSystemPrompt(ctx));
    }
    return promptCache.get(lang)!;
  }

  // For reasoning-capable models, test both no-reasoning and minimal
  const effortVariants: Array<string | null> = model.capabilities.reasoning
    ? [null, "minimal"]
    : [null];

  // Run all effort × test case combinations in parallel
  // (multi-turn tests still run turns sequentially within each promise)
  const promises: Promise<TestCaseResult>[] = [];

  for (const reasoningEffort of effortVariants) {
    const effortLabel = reasoningEffort ? ` (${reasoningEffort})` : "";

    for (const testCase of testCases) {
      promises.push((async (): Promise<TestCaseResult> => {
        const testCaseId = testCase.id;
        const isMultiTurn = testCase.turns.length > 1;
        const lang = testCase.language ?? "es";
        const systemPrompt = getSystemPromptForLang(lang);
        const messages: AIMessage[] = [{
          role: "system",
          content: systemPrompt,
        }];

        if (testCaseId === "conv-5-modify") {
          messages.push(...RECIPE_CONVERSATION_HISTORY);
        }

        const testCaseStart = performance.now();
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
            tools,
            toolChoice: "auto" as const,
          };

          try {
            const result = await callModelWithRetry(
              model,
              request,
              apiKey,
              ROLE_TIMEOUTS.orchestrator,
            );
            const response = result.response;

            totalLatencyMs += result.totalLatencyMs;
            totalInputTokens += response.usage.inputTokens;
            totalOutputTokens += response.usage.outputTokens;
            totalCostUsd += result.totalCostUsd;
            allAttempts = allAttempts.concat(result.attempts);
            finalResponseContent = response.content;

            messages.push({ role: "assistant", content: response.content });

            const toolCalled =
              response.toolCalls && response.toolCalls.length > 0
                ? response.toolCalls[0].name
                : null;

            if (isLastTurn) {
              finalToolCalled = toolCalled;
              const expected = turn.expectedTool;
              if (expected === null) {
                if (finalToolCalled !== null) {
                  finalStatus = "fail";
                  failureType = "quality";
                }
              } else {
                if (finalToolCalled !== expected) {
                  finalStatus = "fail";
                  failureType = "quality";
                }
              }
            } else {
              if (turn.expectedTool === null && toolCalled !== null) {
                finalStatus = "fail";
                failureType = "quality";
                finalToolCalled = toolCalled;
                finalResponseContent = `[Turn ${
                  turnIdx + 1
                }] ${response.content}`;
                break;
              }
            }
          } catch (error) {
            const err = error instanceof Error
              ? error
              : new Error(String(error));
            finalStatus = "fail";
            failureType = "transient";
            finalError = err.message;
            finalResponseContent = `ERROR: ${err.message}`;
            totalLatencyMs = Math.round(performance.now() - testCaseStart);
            break;
          }
        }

        const tag = finalStatus === "pass" ? "✓" : "✗";
        console.log(
          `  ${tag} ${testCaseId}${effortLabel} ${
            formatDuration(totalLatencyMs)
          } [${allAttempts.length} attempt(s)]`,
        );

        const outputTokensPerSec = totalOutputTokens > 0 && totalLatencyMs > 0
          ? Math.round((totalOutputTokens / totalLatencyMs) * 1000)
          : 0;

        return {
          modelId: reasoningEffort
            ? `${model.id} (${reasoningEffort})`
            : model.id,
          role: "orchestrator" as const,
          testCaseId,
          testCaseDescription: testCase.description,
          status: finalStatus,
          latencyMs: totalLatencyMs,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          outputTokensPerSec,
          costUsd: totalCostUsd,
          reasoningEffort: reasoningEffort,
          attempts: allAttempts,
          failureType,
          responseContent: finalResponseContent,
          error: finalError,
          toolCalled: finalToolCalled,
          expectedTool: testCase.turns[lastTurnIndex].expectedTool,
          toolCorrect: finalStatus === "pass",
          evaluationMethod: "tool_call" as const,
          turns: isMultiTurn ? testCase.turns.length : 1,
        };
      })());
    }
  }

  return await Promise.all(promises);
}
