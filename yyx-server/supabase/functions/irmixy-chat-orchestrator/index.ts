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
import { callAIStream, callAIStreamWithTools } from "./ai-calls.ts";
import { errorResponse, finalizeResponse } from "./response-builder.ts";
import { logAIUsage } from "../_shared/usage-logger.ts";
import { buildActions } from "./action-builder.ts";
import { buildRecipeConfirmationChip } from "./suggestions.ts";
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
        confirmedToolCall?: {
          name: string;
          arguments: Record<string, unknown>;
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

    // Extract confirmed tool call from suggestion chip metadata
    const confirmedToolCall = body?.confirmedToolCall &&
        typeof body.confirmedToolCall.name === "string" &&
        body.confirmedToolCall.arguments &&
        typeof body.confirmedToolCall.arguments === "object"
      ? body.confirmedToolCall
      : undefined;

    log.info("Request received", {
      hasSessionId: !!sessionId,
      messageLength: message.length,
      hasConfirmedToolCall: !!confirmedToolCall,
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
      confirmedToolCall,
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
 * Stream the AI's text-only response via SSE with heartbeat and usage logging.
 * Used by the confirmed recipe fast path (no tool calling needed).
 */
async function streamAIResponse(opts: {
  streamMessages: ChatMessage[];
  send: (data: Record<string, unknown>) => void;
  signal: AbortSignal;
  costContext?: CostContext;
  usageContext: AIUsageLogContext;
  requestType: string;
}): Promise<string> {
  const {
    streamMessages,
    send,
    signal,
    costContext,
    usageContext,
    requestType,
  } = opts;

  const heartbeatId = setInterval(() => {
    send({ type: "heartbeat" });
  }, HEARTBEAT_INTERVAL_MS);
  let heartbeatCleared = false;

  const streamStart = performance.now();

  let finalText: string;
  try {
    const streamResult = await callAIStream(
      streamMessages,
      (token) => {
        if (!heartbeatCleared) {
          clearInterval(heartbeatId);
          heartbeatCleared = true;
        }
        send({ type: "content", content: token });
      },
      signal,
      costContext,
    );
    finalText = streamResult.content;

    fireUsageLog(
      usageContext,
      "response_stream",
      "success",
      streamStart,
      streamResult,
      { request_type: requestType },
    );
  } catch (error) {
    fireUsageLog(
      usageContext,
      "response_stream",
      "error",
      streamStart,
      undefined,
      { request_type: requestType },
    );
    throw error;
  } finally {
    if (!heartbeatCleared) clearInterval(heartbeatId);
  }

  send({ type: "stream_complete" });
  return finalText;
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
  confirmedToolCall?: { name: string; arguments: Record<string, unknown> },
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

        // ── Confirmed recipe fast path ──
        // When user taps a confirmation chip, the frontend sends the tool args
        // via the confirmedToolCall field in the request body.
        const confirmedRecipeArgs =
          confirmedToolCall?.name === "generate_custom_recipe"
            ? confirmedToolCall.arguments
            : null;

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

        // ── Confirmed recipe: execute tool directly, then stream response ──
        if (confirmedRecipeArgs) {
          log.info("Confirmed recipe generation — executing directly", {
            description: confirmedRecipeArgs.recipeDescription,
          });

          send({ type: "status", status: "cooking_it_up" });

          const syntheticToolCall: ToolCall = {
            id: `call_${crypto.randomUUID()}`,
            type: "function",
            function: {
              name: "generate_custom_recipe",
              arguments: JSON.stringify(confirmedRecipeArgs),
            },
          };

          const onPartialRecipe: PartialRecipeCallback = (partialRecipe) => {
            send({ type: "recipe_partial", recipe: partialRecipe });
            send({ type: "status", status: "enriching" });
          };

          const heartbeatId = setInterval(() => {
            send({ type: "heartbeat" });
          }, HEARTBEAT_INTERVAL_MS);

          let toolResult: ToolExecutionResult;
          try {
            toolResult = await executeToolCalls(
              supabase,
              [syntheticToolCall],
              userContext,
              log,
              usageContext,
              onPartialRecipe,
              costContext,
            );
          } finally {
            clearInterval(heartbeatId);
            send({ type: "status", status: "thinking" });
          }
          timings.tool_exec_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();

          recipes = toolResult.recipes;
          customRecipeResult = toolResult.customRecipeResult;

          // Build messages for streaming response (AI summarizes the result)
          const streamMessages = [
            ...messages,
            {
              role: "assistant" as const,
              content: null,
              tool_calls: [syntheticToolCall],
            },
            ...toolResult.toolMessages,
          ];

          const finalText = await streamAIResponse({
            streamMessages,
            send,
            signal,
            costContext,
            usageContext,
            requestType: "recipe_response",
          });
          timings.stream_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();

          const actions = buildActions(userContext.language, undefined);
          const response = await finalizeResponse(
            supabase,
            sessionId,
            message,
            finalText,
            userContext,
            recipes,
            customRecipeResult,
            actions.length > 0 ? actions : undefined,
            undefined,
            { skipUserMessage: true },
          );
          timings.finalize_ms = Math.round(performance.now() - phaseStart);
          timings.total_ms = Math.round(performance.now() - startTime);

          log.info("Request complete", {
            type: "recipe_gen_confirmed",
            ...timings,
          });

          send({ type: "done", response });
          clearStreamTimeout();
          safeClose();
          return;
        }

        // ── Streaming tool loop ──
        // Single streaming call with tool support. Text streams immediately.
        // When the AI calls a tool, we execute it and feed results back.
        let selectedModel = "unknown";
        let loopMessages = [...messages];
        let finalText = "";
        let intercepted = false;

        for (
          let iteration = 0;
          iteration < MAX_TOOL_LOOP_ITERATIONS;
          iteration++
        ) {
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
                send({ type: "content", content: token });
              },
              signal,
              costContext,
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
          finalText += streamResult.content;

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

          // No tool calls → done streaming
          if (!streamResult.toolCalls?.length) {
            break;
          }

          timings[`llm_iter${iteration}_ms`] = Math.round(
            performance.now() - phaseStart,
          );
          phaseStart = performance.now();

          // ── Intercept generate_custom_recipe ──
          const recipeGenToolCall = streamResult.toolCalls.find(
            (tc) => tc.function.name === "generate_custom_recipe",
          );
          if (recipeGenToolCall) {
            log.info(
              "Intercepted generate_custom_recipe — sending confirmation chip",
            );
            let toolArgs: Record<string, unknown>;
            try {
              toolArgs = JSON.parse(recipeGenToolCall.function.arguments);
            } catch {
              toolArgs = {};
            }

            send({ type: "stream_complete" });

            const chip = buildRecipeConfirmationChip(
              toolArgs,
              userContext.language,
            );

            const response = await finalizeResponse(
              supabase,
              sessionId,
              message,
              finalText,
              userContext,
              recipes,
              undefined,
              undefined,
              [chip],
            );

            timings.total_ms = Math.round(performance.now() - startTime);
            log.info("Request complete (recipe intercepted)", {
              type: "recipe_intercepted",
              model: selectedModel,
              iteration,
              ...timings,
            });

            send({ type: "done", response });
            clearStreamTimeout();
            safeClose();
            intercepted = true;
            break;
          }

          // Execute tool calls
          const toolName = streamResult.toolCalls[0].function.name;
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

          // Reset finalText — the next iteration will produce the final response
          finalText = "";
          send({ type: "status", status: "thinking" });
        }

        if (intercepted) return;

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
