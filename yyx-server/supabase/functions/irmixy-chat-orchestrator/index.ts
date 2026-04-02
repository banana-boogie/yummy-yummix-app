/**
 * Irmixy Chat Orchestrator
 *
 * Text-chat entry point for Irmixy AI interactions.
 * Handles context loading, LLM tool calls (with proper tool loop),
 * and structured response generation.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createUserClient } from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createContextBuilder,
  sanitizeContent,
} from "../_shared/context-builder.ts";
import type { RecipeCard, UserContext } from "../_shared/irmixy-schemas.ts";
import { ValidationError } from "../_shared/irmixy-schemas.ts";
import type {
  AIUsageLogContext,
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "../_shared/tools/generate-custom-recipe.ts";
import { ToolValidationError } from "../_shared/tools/tool-validators.ts";
import { executeTool } from "../_shared/tools/execute-tool.ts";
import { shapeToolResponse } from "../_shared/tools/shape-tool-response.ts";
// Module imports
import type {
  ChatMessage,
  RequestContext,
  ToolCall,
  ToolExecutionResult,
} from "./types.ts";
import { SessionOwnershipError } from "./types.ts";
import { createLogger, generateRequestId, type Logger } from "./logger.ts";
import { ensureSessionId } from "./session.ts";
import { detectMealContext } from "./meal-context.ts";
import { buildSystemPrompt } from "./system-prompt.ts";
import type { CookingContext } from "./system-prompt.ts";
import { callAIStreamWithTools } from "./ai-calls.ts";
import { errorResponse, finalizeResponse } from "./response-builder.ts";
import { logAIUsage } from "../_shared/usage-logger.ts";
import { buildActions } from "./action-builder.ts";
import {
  BudgetCheckUnavailableError,
  checkTextBudget,
} from "../_shared/ai-budget/index.ts";
import { checkRateLimit } from "../_shared/ai-budget/rate-limiter.ts";
import type { CostContext } from "../_shared/ai-gateway/types.ts";

// ============================================================
// Config
// ============================================================

const STREAM_TIMEOUT_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_TOOL_LOOP_ITERATIONS = 5;

/** Build and fire a usage log entry. Keeps orchestrator DRY. */
function fireUsageLog(
  ctx: AIUsageLogContext,
  phase: "tool_decision" | "response_stream",
  status: "success" | "error",
  startTime: number,
  result?: {
    model: string;
    usage: { inputTokens: number; outputTokens: number };
  },
  metadata?: Record<string, unknown>,
) {
  // Detect missing/zero stream usage — treat as partial rather than fake success
  const hasUsage = result != null &&
    (result.usage.inputTokens > 0 || result.usage.outputTokens > 0);
  const effectiveStatus = status === "success" && result != null && !hasUsage
    ? "partial"
    : status;

  void logAIUsage({
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    callPhase: phase,
    status: effectiveStatus,
    functionName: ctx.functionName,
    usageType: "text",
    model: result?.model ?? null,
    inputTokens: hasUsage ? result!.usage.inputTokens : null,
    outputTokens: hasUsage ? result!.usage.outputTokens : null,
    durationMs: Math.round(performance.now() - startTime),
    metadata: { streaming: phase === "response_stream", ...metadata },
  });
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Generate request ID for tracing
  const requestId = generateRequestId();
  const log = createLogger(requestId);
  const requestStartTime = Date.now();

  try {
    let body:
      | {
        message: string;
        sessionId?: string;
        cookingContext?: {
          recipeTitle: string;
          currentStep: string;
          stepInstructions?: string;
        };
      }
      | null = null;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const message = typeof body?.message === "string" ? body.message : "";
    const sessionId = typeof body?.sessionId === "string"
      ? body.sessionId
      : undefined;

    // Extract cooking context if provided
    const cookingContext: CookingContext | undefined = body?.cookingContext &&
        typeof body.cookingContext.recipeTitle === "string" &&
        typeof body.cookingContext.currentStep === "string"
      ? {
        recipeTitle: sanitizeContent(body.cookingContext.recipeTitle),
        currentStep: sanitizeContent(body.cookingContext.currentStep),
        stepInstructions: typeof body.cookingContext.stepInstructions ===
            "string"
          ? sanitizeContent(body.cookingContext.stepInstructions)
          : undefined,
      }
      : undefined;

    log.info("Request received", {
      hasSessionId: !!sessionId,
      messageLength: message.length,
    });

    // Validate request
    if (!message || !message.trim()) {
      return errorResponse("Message is required", 400);
    }

    // Initialize Supabase client with user's auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("Authorization header required", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createUserClient(authHeader);

    // Get authenticated user by passing the JWT token directly
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      token,
    );
    if (authError) {
      log.error("Auth error", authError);
    }
    if (!user) {
      log.warn("Unauthorized request");
      return errorResponse("Unauthorized", 401);
    }

    log.info("User authenticated", { userId: user.id.substring(0, 8) + "..." });

    // Rate limit check (in-memory, no DB)
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          retryAfterMs: rateCheck.retryAfterMs,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(
              Math.ceil((rateCheck.retryAfterMs || 1000) / 1000),
            ),
          },
        },
      );
    }

    // Budget check
    let budget: Awaited<ReturnType<typeof checkTextBudget>>;
    try {
      budget = await checkTextBudget(user.id);
    } catch (error) {
      if (error instanceof BudgetCheckUnavailableError) {
        log.error("Budget check unavailable", { message: error.message });
        return new Response(
          JSON.stringify({
            error: "budget_unavailable",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw error;
    }

    if (!budget.allowed) {
      log.info("Budget exceeded", {
        tier: budget.tier,
        usedUsd: budget.usedUsd,
        budgetUsd: budget.budgetUsd,
      });
      return new Response(
        JSON.stringify({
          error: "budget_exceeded",
          tier: budget.tier,
          usedUsd: budget.usedUsd,
          budgetUsd: budget.budgetUsd,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Sanitize the incoming message
    const sanitizedMessage = sanitizeContent(message);
    log.info("Message sanitized", {
      messagePreview: sanitizedMessage.slice(0, 180),
    });

    const sessionResult = await ensureSessionId(
      supabase,
      user.id,
      sessionId,
      sanitizedMessage,
    );
    const effectiveSessionId = sessionResult.sessionId ?? sessionId;

    // Build cost context for automatic recording
    const costContext: CostContext = {
      userId: user.id,
      edgeFunction: "irmixy-chat-orchestrator",
    };

    // Always use streaming — all clients use SSE
    return handleStreamingRequest(
      supabase,
      user.id,
      effectiveSessionId,
      sanitizedMessage,
      log,
      requestId,
      req.signal,
      costContext,
      budget.warningData,
      cookingContext,
    );
  } catch (error) {
    log.error("Orchestrator error", error);
    log.timing("Request failed", requestStartTime);

    if (error instanceof SessionOwnershipError) {
      return errorResponse("Invalid session", 403);
    }

    if (error instanceof ValidationError) {
      return errorResponse("Invalid response format", 500);
    }

    // Don't leak error details to client
    return errorResponse("An unexpected error occurred", 500);
  }
});

// ============================================================
// Core Processing
// ============================================================

/**
 * Build request context: user profile, conversation history, and message array.
 */
async function buildRequestContext(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | undefined,
  message: string,
  cookingContext?: CookingContext,
): Promise<RequestContext> {
  const contextBuilder = createContextBuilder(supabase);
  const userContext = await contextBuilder.buildContext(userId, sessionId);

  // Detect meal context from user message
  const mealContext = detectMealContext(message);

  const systemPrompt = buildSystemPrompt(
    userContext,
    mealContext,
    cookingContext,
  );

  // Build message array from conversation history.
  // Tool result summaries are injected as system-role messages (not appended to
  // assistant content) so the LLM interprets them as context, not its own prior
  // output — preventing it from mimicking the format instead of calling tools.
  const historyMessages: ChatMessage[] = [];
  for (const m of userContext.conversationHistory) {
    historyMessages.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
    if (m.toolSummary) {
      historyMessages.push({
        role: "system",
        content: m.toolSummary,
      });
    }
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: message },
  ];

  return { userContext, messages };
}

/**
 * Execute tool calls from the assistant message.
 * Returns tool response messages and any recipe results.
 *
 * @param onPartialRecipe - Optional callback for two-phase SSE. If provided,
 *   called with the recipe immediately after LLM generation (before enrichment).
 */
async function executeToolCalls(
  supabase: SupabaseClient,
  toolCalls: ToolCall[],
  userContext: UserContext,
  log: Logger,
  usageContext: AIUsageLogContext,
  onPartialRecipe?: PartialRecipeCallback,
  costContext?: CostContext,
): Promise<ToolExecutionResult> {
  const toolMessages: ChatMessage[] = [];
  let recipes: RecipeCard[] | undefined;
  let recipesSourceTool: string | undefined;
  let customRecipeResult: GenerateRecipeResult | undefined;
  let appActionResult:
    | import("../_shared/tools/app-action.ts").AppActionResult
    | undefined;

  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const { name, arguments: args } = toolCall.function;
      try {
        const result = await executeTool(
          supabase,
          name,
          args,
          userContext,
          {
            onPartialRecipe,
            usageContext,
            costContext,
          },
        );

        return {
          toolMessage: {
            role: "tool" as const,
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          },
          toolName: name,
          shaped: shapeToolResponse(name, result),
        };
      } catch (toolError) {
        log.error(`Tool ${name} error`, toolError);
        const errorMsg = toolError instanceof ToolValidationError
          ? `Invalid parameters: ${toolError.message}`
          : "Tool execution failed";

        return {
          toolMessage: {
            role: "tool" as const,
            content: JSON.stringify({ error: errorMsg }),
            tool_call_id: toolCall.id,
          },
          toolName: name,
          shaped: undefined,
        };
      }
    }),
  );

  for (const execution of results) {
    toolMessages.push(execution.toolMessage);
    if (!execution.shaped) continue;

    if (execution.shaped.recipes) {
      recipes = execution.shaped.recipes;
      recipesSourceTool = execution.toolName;
    } else if (execution.shaped.customRecipe) {
      customRecipeResult = {
        recipe: execution.shaped.customRecipe,
        safetyFlags: execution.shaped.safetyFlags,
      };
    }
    if (execution.shaped.appActionResult) {
      appActionResult = execution.shaped.appActionResult;
    }
  }

  return {
    toolMessages,
    recipes,
    recipesSourceTool,
    customRecipeResult,
    appActionResult,
  };
}

// ============================================================
// Streaming
// ============================================================

/** Map tool name to a UI status for the frontend. */
const TOOL_STATUS: Record<string, string> = {
  search_recipes: "searching",
  retrieve_cooked_recipes: "searching",
  generate_custom_recipe: "cooking_it_up",
  modify_recipe: "cooking_it_up",
};

function getToolStatus(toolName: string): string {
  return TOOL_STATUS[toolName] ?? "generating";
}

/**
 * Handle streaming request with SSE.
 */
function handleStreamingRequest(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | undefined,
  message: string,
  log: Logger,
  requestId: string,
  reqSignal?: AbortSignal,
  costContext?: CostContext,
  budgetWarning?: { usedUsd: number; budgetUsd: number },
  cookingContext?: CookingContext,
): Response {
  const encoder = new TextEncoder();

  // Unified abort controller: fires when client disconnects OR stream is cancelled
  const abortController = new AbortController();
  const signal = abortController.signal;
  if (reqSignal) {
    reqSignal.addEventListener("abort", () => abortController.abort(), {
      once: true,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let streamClosed = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (!streamClosed) controller.enqueue(chunk);
      };
      const safeClose = () => {
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      };

      const resetStreamTimeout = () => {
        if (streamTimeoutId) clearTimeout(streamTimeoutId);
        streamTimeoutId = setTimeout(() => {
          safeEnqueue(
            encoder.encode(
              `data: ${
                JSON.stringify({
                  type: "error",
                  error: "Stream timeout — no data for 30 seconds",
                })
              }\n\n`,
            ),
          );
          safeClose();
        }, STREAM_TIMEOUT_MS);
      };

      const clearStreamTimeout = () => {
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
          streamTimeoutId = null;
        }
      };

      const send = (data: Record<string, unknown>) => {
        if (streamClosed || signal.aborted) return;
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
        resetStreamTimeout();
      };

      try {
        resetStreamTimeout();
        // Timing instrumentation for performance monitoring
        const timings: Record<string, number> = {};
        const startTime = performance.now();
        let phaseStart = startTime;

        if (sessionId) {
          send({ type: "session", sessionId });
        }
        // Send budget warning early so frontend can display it
        if (budgetWarning) {
          send({
            type: "budget_warning",
            usedUsd: budgetWarning.usedUsd,
            budgetUsd: budgetWarning.budgetUsd,
          });
        }
        send({ type: "status", status: "thinking" });

        const { userContext, messages } = await buildRequestContext(
          supabase,
          userId,
          sessionId,
          message,
          cookingContext,
        );
        timings.context_build_ms = Math.round(performance.now() - phaseStart);
        phaseStart = performance.now();

        let recipes: RecipeCard[] | undefined;
        let recipesSourceTool: string | undefined;
        let customRecipeResult: GenerateRecipeResult | undefined;
        let appActionResult:
          | import("../_shared/tools/app-action.ts").AppActionResult
          | undefined;
        const usageContext: AIUsageLogContext = {
          userId,
          sessionId,
          requestId,
          functionName: "irmixy-chat-orchestrator",
        };

        // ── Tool gating ──
        // Compute which tools to exclude based on conversation context.
        // Cooking helper: text-only (no tools).
        // General chat: exclude modify_recipe if no recipe exists in session.
        const excludeTools: string[] = [];
        if (cookingContext) {
          // Helper mode: no tools at all — answer from recipe context only
          excludeTools.push(
            "search_recipes",
            "generate_custom_recipe",
            "modify_recipe",
            "retrieve_cooked_recipes",
            "app_action",
          );
        } else {
          // General chat: block modify_recipe unless a recipe exists in this session
          const hasRecipeInHistory = messages.some(
            (m) => m.role === "assistant" && m.metadata?.customRecipe,
          );
          if (!hasRecipeInHistory) {
            excludeTools.push("modify_recipe");
          }
        }

        // ── Streaming tool loop ──
        // Single streaming call with tool support. Text from tool-calling
        // iterations is suppressed (not streamed to user). Only the final
        // iteration (no tool calls) streams text to the user. This matches
        // the old behavior and avoids persisting narration text.
        let selectedModel = "unknown";
        let loopMessages = [...messages];
        let finalText = "";
        let iteration = 0;

        for (
          ;
          iteration < MAX_TOOL_LOOP_ITERATIONS;
          iteration++
        ) {
          const iterationTextBuffer: string[] = [];

          if (signal.aborted) {
            log.info("Request aborted by client (tool loop)");
            clearStreamTimeout();
            safeClose();
            return;
          }

          const llmCallStart = performance.now();
          let streamResult: Awaited<
            ReturnType<typeof callAIStreamWithTools>
          >;
          let heartbeatCleared = false;
          const heartbeatId = setInterval(() => {
            send({ type: "heartbeat" });
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
              signal,
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

          // No tool calls → this was the final iteration, flush buffered text
          if (!streamResult.toolCalls?.length) {
            // Skip streaming post-tool summary when a recipe was already
            // generated — the intro text + recipe card IS the response.
            if (!customRecipeResult) {
              for (const chunk of iterationTextBuffer) {
                send({ type: "content", content: chunk });
              }
            }
            finalText = streamResult.content;
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
              send({ type: "content", content: chunk });
            }
            finalText = streamResult.content;
          }

          timings[`llm_iter${iteration}_ms`] = Math.round(
            performance.now() - phaseStart,
          );
          phaseStart = performance.now();
          send({ type: "status", status: getToolStatus(toolName) });

          const onPartialRecipe: PartialRecipeCallback = (partialRecipe) => {
            send({ type: "recipe_partial", recipe: partialRecipe });
            send({ type: "status", status: "enriching" });
          };

          const toolHeartbeatId = setInterval(() => {
            send({ type: "heartbeat" });
          }, HEARTBEAT_INTERVAL_MS);

          let toolResult: ToolExecutionResult;
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
            // Custom recipe supersedes earlier search results — the model
            // decided the search didn't match and generated a new recipe.
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

          // Append assistant + tool results to message history for next iteration
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
          // recipe card IS the complete response. Skip the second LLM pass —
          // it's unnecessary, adds ~2-3s latency, and causes text replacement.
          if (customRecipeResult) {
            break;
          }

          if (!customRecipeResult) {
            send({ type: "status", status: "thinking" });
          }
        }

        if (iteration >= MAX_TOOL_LOOP_ITERATIONS) {
          log.warn("Tool loop reached max iterations", {
            maxIterations: MAX_TOOL_LOOP_ITERATIONS,
          });
        }

        send({ type: "stream_complete" });
        timings.stream_ms = Math.round(performance.now() - phaseStart);
        phaseStart = performance.now();

        if (signal.aborted) {
          log.info("Request aborted by client (after streaming)");
          clearStreamTimeout();
          safeClose();
          return;
        }

        const hasSuccessfulCustomRecipe = !!customRecipeResult?.recipe &&
          customRecipeResult?.safetyFlags?.error !== true;

        const actions = buildActions(userContext.language, appActionResult);

        const response = await finalizeResponse(
          supabase,
          sessionId,
          message,
          finalText,
          userContext,
          recipes,
          customRecipeResult,
          actions.length > 0 ? actions : undefined,
        );
        timings.finalize_ms = Math.round(performance.now() - phaseStart);
        timings.total_ms = Math.round(performance.now() - startTime);

        const perfType = hasSuccessfulCustomRecipe
          ? "recipe_gen"
          : recipes?.length
          ? "recipe_search"
          : "chat";
        log.info("Request complete", {
          type: perfType,
          model: selectedModel,
          ...timings,
        });
        log.info("PERF_SUMMARY", {
          type: perfType,
          model: selectedModel,
          ...timings,
        });

        send({ type: "done", response });
        clearStreamTimeout();
        safeClose();
      } catch (error) {
        if (signal.aborted) {
          log.info("Request aborted by client");
          clearStreamTimeout();
          safeClose();
          return;
        }
        log.error("Streaming error", error);
        send({
          type: "error",
          error: "An unexpected error occurred",
        });
        clearStreamTimeout();
        safeClose();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
