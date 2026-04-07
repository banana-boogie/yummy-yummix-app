/**
 * Tool Loop
 *
 * Runs the streaming tool loop: repeatedly calls the LLM, executes any
 * tool calls, and accumulates results until the model produces a final
 * text response (or the iteration limit is reached).
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { RecipeCard, UserContext } from "../_shared/irmixy-schemas.ts";
import type {
  AIUsageLogContext,
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "../_shared/tools/generate-custom-recipe.ts";
import { getRegisteredToolNames } from "../_shared/tools/tool-registry.ts";
import type { CostContext } from "../_shared/ai-gateway/types.ts";
import { stripToolMarkup } from "../_shared/text-utils.ts";

import type { ChatMessage } from "./types.ts";
import type { Logger } from "./logger.ts";
import type { StreamContext } from "./sse-stream.ts";
import {
  getToolStatus,
  HEARTBEAT_INTERVAL_MS,
  MAX_TOOL_LOOP_ITERATIONS,
} from "./config.ts";
import { callAIStreamWithTools } from "./ai-calls.ts";
import { executeToolCalls } from "./tool-executor.ts";
import { fireUsageLog } from "./usage-logger.ts";

/** Accumulated results from the tool loop. */
export interface ToolLoopResult {
  finalText: string;
  selectedModel: string;
  recipes: RecipeCard[] | undefined;
  recipesSourceTool: string | undefined;
  customRecipeResult: GenerateRecipeResult | undefined;
  appActionResult:
    | import("../_shared/tools/app-action.ts").AppActionResult
    | undefined;
  /** Per-phase timings in milliseconds. */
  timings: Record<string, number>;
}

export interface ToolLoopParams {
  supabase: SupabaseClient;
  messages: ChatMessage[];
  userContext: UserContext;
  userId: string;
  sessionId: string | undefined;
  requestId: string;
  log: Logger;
  stream: StreamContext;
  costContext?: CostContext;
  cookingContext?: unknown;
}

/**
 * Determine which tools to exclude based on conversation mode and history.
 *
 * - Helper mode: exclude all tools (text-only, answer from recipe context)
 * - General chat: exclude modify_recipe unless a recipe exists in session history
 */
export function resolveExcludedTools(
  conversationHistory: Array<
    { role: string; content: string; metadata?: Record<string, unknown> }
  >,
  cookingContext: unknown | undefined,
): string[] {
  if (cookingContext) {
    return getRegisteredToolNames();
  }
  const hasRecipeInHistory = conversationHistory.some(
    (m) => m.role === "assistant" && m.metadata?.customRecipe,
  );
  return hasRecipeInHistory ? [] : ["modify_recipe"];
}

/**
 * Run the streaming tool loop.
 *
 * Each iteration calls the LLM. If the LLM returns tool calls, they are
 * executed and the results fed back for the next iteration. Text tokens
 * are only flushed to the SSE stream on the final (no-tool-call) iteration,
 * unless a recipe tool was invoked (in which case the intro text is flushed
 * before tool execution).
 */
export async function runToolLoop(
  params: ToolLoopParams,
): Promise<ToolLoopResult> {
  const {
    supabase,
    messages,
    userContext,
    userId,
    sessionId,
    requestId,
    log,
    stream,
    costContext,
    cookingContext,
  } = params;

  const usageContext: AIUsageLogContext = {
    userId,
    sessionId,
    requestId,
    functionName: "irmixy-chat-orchestrator",
  };

  // Tool gating
  const excludeTools = resolveExcludedTools(
    userContext.conversationHistory,
    cookingContext,
  );

  const timings: Record<string, number> = {};
  let phaseStart = performance.now();

  let recipes: RecipeCard[] | undefined;
  let recipesSourceTool: string | undefined;
  let customRecipeResult: GenerateRecipeResult | undefined;
  let appActionResult:
    | import("../_shared/tools/app-action.ts").AppActionResult
    | undefined;
  let selectedModel = "unknown";
  let loopMessages = [...messages];
  let finalText = "";
  let iteration = 0;

  for (; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++) {
    const iterationTextBuffer: string[] = [];

    if (stream.signal.aborted) {
      log.info("Request aborted by client (tool loop)");
      return buildResult();
    }

    const llmCallStart = performance.now();
    let streamResult: Awaited<ReturnType<typeof callAIStreamWithTools>>;
    let heartbeatCleared = false;
    const heartbeatId = setInterval(() => {
      stream.send({ type: "heartbeat" });
    }, HEARTBEAT_INTERVAL_MS);

    try {
      streamResult = await callAIStreamWithTools(
        loopMessages,
        (token) => {
          if (!heartbeatCleared) {
            clearInterval(heartbeatId);
            heartbeatCleared = true;
          }
          // Buffer text — only flushed if this iteration has no tool calls
          iterationTextBuffer.push(token);
        },
        stream.signal,
        costContext,
        excludeTools,
      );
    } catch (error) {
      clearInterval(heartbeatId);
      fireUsageLog(
        usageContext,
        "tool_decision",
        "error",
        llmCallStart,
        undefined,
        { request_type: "tool_loop", iteration },
      );
      throw error;
    } finally {
      if (!heartbeatCleared) clearInterval(heartbeatId);
    }

    selectedModel = streamResult.model;

    fireUsageLog(
      usageContext,
      iteration === 0 ? "tool_decision" : "response_stream",
      "success",
      llmCallStart,
      streamResult,
      {
        request_type: "tool_loop",
        iteration,
        has_tool_calls: !!streamResult.toolCalls?.length,
        tool_names: streamResult.toolCalls?.map((tc) => tc.function.name),
      },
    );

    // No tool calls -> final iteration, flush buffered text
    if (!streamResult.toolCalls?.length) {
      // Skip streaming post-tool summary when a recipe was already
      // generated — the intro text + recipe card IS the response.
      if (!customRecipeResult) {
        for (const chunk of iterationTextBuffer) {
          const cleaned = stripToolMarkup(chunk);
          if (cleaned) stream.send({ type: "content", content: cleaned });
        }
      }
      finalText = stripToolMarkup(streamResult.content);
      break;
    }

    // Execute tool calls
    const toolName = streamResult.toolCalls[0].function.name;

    // For recipe generation/modification, flush the model's intro text
    // (e.g. "Let me create that for you!") so the user sees it before
    // the progress bar. For other tools (search), discard narration.
    const isRecipeTool = toolName === "generate_custom_recipe" ||
      toolName === "modify_recipe";
    if (isRecipeTool && iterationTextBuffer.length > 0) {
      for (const chunk of iterationTextBuffer) {
        const cleaned = stripToolMarkup(chunk);
        if (cleaned) stream.send({ type: "content", content: cleaned });
      }
      finalText = stripToolMarkup(streamResult.content);
    }

    timings[`llm_iter${iteration}_ms`] = Math.round(
      performance.now() - phaseStart,
    );
    phaseStart = performance.now();
    stream.send({ type: "status", status: getToolStatus(toolName) });

    const onPartialRecipe: PartialRecipeCallback = (partialRecipe) => {
      stream.send({ type: "recipe_partial", recipe: partialRecipe });
      stream.send({ type: "status", status: "enriching" });
    };

    const toolHeartbeatId = setInterval(() => {
      stream.send({ type: "heartbeat" });
    }, HEARTBEAT_INTERVAL_MS);

    let toolResult: Awaited<ReturnType<typeof executeToolCalls>>;
    try {
      toolResult = await executeToolCalls(
        supabase,
        streamResult.toolCalls,
        userContext,
        log,
        usageContext,
        onPartialRecipe,
        costContext,
      );
    } finally {
      clearInterval(toolHeartbeatId);
    }

    timings[`tool_exec_iter${iteration}_ms`] = Math.round(
      performance.now() - phaseStart,
    );
    phaseStart = performance.now();

    // Accumulate results
    if (toolResult.recipes) {
      recipes = toolResult.recipes;
      recipesSourceTool = toolResult.recipesSourceTool;
    }
    if (toolResult.customRecipeResult) {
      customRecipeResult = toolResult.customRecipeResult;
      // Custom recipe supersedes earlier search results
      recipes = undefined;
      recipesSourceTool = undefined;
    }
    if (toolResult.appActionResult) {
      appActionResult = toolResult.appActionResult;
    }

    log.info("Tool execution result", {
      iteration,
      hasRecipes: !!toolResult.recipes?.length,
      hasCustomRecipe: !!toolResult.customRecipeResult?.recipe,
      hasAppAction: !!toolResult.appActionResult,
    });

    // Append assistant + tool results for next iteration
    loopMessages = [
      ...loopMessages,
      {
        role: "assistant" as const,
        content: streamResult.content || null,
        tool_calls: streamResult.toolCalls,
      },
      ...toolResult.toolMessages,
    ];

    // After successful recipe generation/modification, the intro text +
    // recipe card IS the complete response. Skip the second LLM pass.
    if (customRecipeResult) {
      break;
    }

    stream.send({ type: "status", status: "thinking" });
  }

  if (iteration >= MAX_TOOL_LOOP_ITERATIONS) {
    log.warn("Tool loop reached max iterations", {
      maxIterations: MAX_TOOL_LOOP_ITERATIONS,
    });
  }

  return buildResult();

  function buildResult(): ToolLoopResult {
    return {
      finalText,
      selectedModel,
      recipes,
      recipesSourceTool,
      customRecipeResult,
      appActionResult,
      timings,
    };
  }
}
