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
import { callAI, callAIStream } from "./ai-calls.ts";
import { errorResponse, finalizeResponse } from "./response-builder.ts";
import { detectTextToolCall, stripToolCallText } from "./tool-call-text.ts";

// ============================================================
// Config
// ============================================================

const STREAM_TIMEOUT_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

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
      | { message: string; sessionId?: string }
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

    // Always use streaming — all clients use SSE
    return handleStreamingRequest(
      supabase,
      user.id,
      effectiveSessionId,
      sanitizedMessage,
      log,
      req.signal,
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
): Promise<RequestContext> {
  const contextBuilder = createContextBuilder(supabase);
  const userContext = await contextBuilder.buildContext(userId, sessionId);

  // Detect meal context from user message
  const mealContext = detectMealContext(message);

  const systemPrompt = buildSystemPrompt(userContext, mealContext);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...userContext.conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
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
  onPartialRecipe?: PartialRecipeCallback,
): Promise<ToolExecutionResult> {
  const toolMessages: ChatMessage[] = [];
  let recipes: RecipeCard[] | undefined;
  let recipesSourceTool: string | undefined;
  let customRecipeResult: GenerateRecipeResult | undefined;

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
  }

  return { toolMessages, recipes, recipesSourceTool, customRecipeResult };
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
  reqSignal?: AbortSignal,
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
        send({ type: "status", status: "thinking" });

        const { userContext, messages } = await buildRequestContext(
          supabase,
          userId,
          sessionId,
          message,
        );
        timings.context_build_ms = Math.round(performance.now() - phaseStart);
        phaseStart = performance.now();

        let recipes: RecipeCard[] | undefined;
        let recipesSourceTool: string | undefined;
        let customRecipeResult: GenerateRecipeResult | undefined;
        let streamMessages = messages;
        let selectedModel = "unknown";
        const firstResponse = await callAI(
          messages,
          true,
          "auto",
          signal,
        );
        selectedModel = firstResponse.model;
        timings.llm_call_ms = Math.round(performance.now() - phaseStart);
        phaseStart = performance.now();
        const assistantMessage = firstResponse.choices[0].message;
        const detectedTool = assistantMessage.content
          ? detectTextToolCall(assistantMessage.content)
          : null;

        // Gemini sometimes outputs tool-call syntax as plain text instead of
        // structured function calls. Detect this and retry with forced tool calling.
        if (
          !assistantMessage.tool_calls?.length &&
          detectedTool
        ) {
          log.warn(
            "Detected tool call in text, retrying with required tool choice",
            {
              detectedTool,
            },
          );
          // Keep SSE alive before the retry call. `send(...)` resets stream timeout.
          send({ type: "status", status: "thinking" });
          const retryResponse = await callAI(
            messages,
            true,
            "required",
            signal,
          );
          selectedModel = retryResponse.model;
          Object.assign(assistantMessage, retryResponse.choices[0].message);
          timings.llm_retry_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();
        }

        log.info("AI response", {
          hasToolCalls: !!assistantMessage.tool_calls?.length,
          toolNames: assistantMessage.tool_calls?.map((tc) => tc.function.name),
        });

        if (signal.aborted) {
          log.info("Request aborted by client (after first LLM call)");
          clearStreamTimeout();
          closeStream();
          return;
        }

        if (
          assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0
        ) {
          const toolName = assistantMessage.tool_calls[0].function.name;

          send({ type: "status", status: getToolStatus(toolName) });

          // Two-phase SSE: emit partial recipe before enrichment for perceived latency
          const onPartialRecipe: PartialRecipeCallback = (partialRecipe) => {
            send({ type: "recipe_partial", recipe: partialRecipe });
            send({ type: "status", status: "enriching" });
          };

          // Keep stream alive during long tool execution (recipe gen can take 45s+)
          const heartbeatId = setInterval(() => {
            send({ type: "heartbeat" });
          }, HEARTBEAT_INTERVAL_MS);

          let toolResult: ToolExecutionResult;
          try {
            toolResult = await executeToolCalls(
              supabase,
              assistantMessage.tool_calls,
              userContext,
              log,
              onPartialRecipe,
            );
          } finally {
            clearInterval(heartbeatId);
            // Reset stream timeout for the streaming phase that follows
            send({ type: "status", status: "thinking" });
          }
          timings.tool_exec_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();
          recipes = toolResult.recipes;
          recipesSourceTool = toolResult.recipesSourceTool;
          customRecipeResult = toolResult.customRecipeResult;

          log.info("Tool execution result", {
            hasRecipes: !!recipes?.length,
            hasCustomRecipe: !!customRecipeResult?.recipe,
            recipesSourceTool: recipesSourceTool ?? null,
          });

          // Drop the assistant's narration text (e.g. "Calling search_recipes...")
          // so the streaming call doesn't echo or continue that style.
          streamMessages = [...messages, {
            role: "assistant" as const,
            content: null,
            tool_calls: assistantMessage.tool_calls,
          }, ...toolResult.toolMessages];
        }

        if (signal.aborted) {
          log.info("Request aborted by client (after tool execution)");
          clearStreamTimeout();
          safeClose();
          return;
        }

        const hasSuccessfulCustomRecipe = !!customRecipeResult?.recipe &&
          customRecipeResult?.safetyFlags?.error !== true;

        // Keep stream alive while waiting for the AI provider to start responding
        const streamHeartbeatId = setInterval(() => {
          send({ type: "heartbeat" });
        }, HEARTBEAT_INTERVAL_MS);
        let heartbeatCleared = false;

        // Stream AI response — text first, then tool results arrive in the done event.
        let finalText: string;
        try {
          finalText = await callAIStream(
            streamMessages,
            (token) => {
              // First token arrived — stop heartbeat, real data is flowing
              if (!heartbeatCleared) {
                clearInterval(streamHeartbeatId);
                heartbeatCleared = true;
              }
              send({ type: "content", content: token });
            },
            signal,
          );
        } finally {
          if (!heartbeatCleared) clearInterval(streamHeartbeatId);
        }
        timings.stream_ms = Math.round(performance.now() - phaseStart);
        phaseStart = performance.now();

        // Strip any residual tool-call text that leaked into the streamed response
        finalText = stripToolCallText(finalText);

        // Signal that streaming is complete - frontend can enable input now
        send({ type: "stream_complete" });

        if (signal.aborted) {
          log.info("Request aborted by client (after streaming)");
          clearStreamTimeout();
          safeClose();
          return;
        }

        const response = await finalizeResponse(
          supabase,
          sessionId,
          message,
          finalText,
          userContext,
          recipes,
          customRecipeResult,
        );
        timings.finalize_ms = Math.round(performance.now() - phaseStart);
        timings.total_ms = Math.round(performance.now() - startTime);

        // Performance timing log
        const requestType = hasSuccessfulCustomRecipe
          ? "recipe_gen"
          : recipes?.length
          ? "recipe_search"
          : "chat";
        log.info("Request complete", {
          type: requestType,
          model: selectedModel,
          ...timings,
        });
        log.info("PERF_SUMMARY", {
          type: requestType,
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
