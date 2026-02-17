/**
 * Irmixy Chat Orchestrator
 *
 * Text-chat entry point for Irmixy AI interactions.
 * Handles context loading, LLM tool calls (with proper tool loop),
 * and structured response generation.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  createServiceClient,
  createUserClient,
} from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createContextBuilder,
  sanitizeContent,
} from "../_shared/context-builder.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getProviderConfig } from "../_shared/ai-gateway/index.ts";
import type { RecipeCard, UserContext } from "../_shared/irmixy-schemas.ts";
import { ValidationError } from "../_shared/irmixy-schemas.ts";
import type {
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "../_shared/tools/generate-custom-recipe.ts";
import { generateCustomRecipe } from "../_shared/tools/generate-custom-recipe.ts";
import type { RetrieveCustomRecipeResult } from "../_shared/tools/retrieve-custom-recipe.ts";
import { ToolValidationError } from "../_shared/tools/tool-validators.ts";
import { executeTool } from "../_shared/tools/execute-tool.ts";
import { shapeToolResponse } from "../_shared/tools/shape-tool-response.ts";
import { hasHighRecipeIntent } from "./recipe-intent.ts";

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
import {
  buildNoResultsFallback,
  getContextualSuggestions,
} from "./suggestions.ts";
import { detectModificationIntent } from "./modification.ts";
import { buildSystemPrompt } from "./system-prompt.ts";
import { callAI, callAIStream } from "./ai-calls.ts";
import { errorResponse, finalizeResponse } from "./response-builder.ts";

// ============================================================
// Config
// ============================================================

const STREAM_TIMEOUT_MS = 30_000;

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
      | { message: string; sessionId?: string; bypassAllergenBlock?: boolean }
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
    const bypassAllergenBlock = body?.bypassAllergenBlock === true;

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

    const rateLimit = await checkRateLimit(createServiceClient(), user.id);
    if (!rateLimit.allowed) {
      const retryAfterMs = rateLimit.retryAfterMs ?? 60_000;
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfterMs,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(retryAfterMs / 1000).toString(),
          },
        },
      );
    }

    // Sanitize the incoming message
    const sanitizedMessage = sanitizeContent(message);

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
      bypassAllergenBlock,
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
  bypassAllergenBlock?: boolean,
): Promise<ToolExecutionResult> {
  const toolMessages: ChatMessage[] = [];
  let recipes: RecipeCard[] | undefined;
  let customRecipeResult: GenerateRecipeResult | undefined;
  let retrievalResult: RetrieveCustomRecipeResult | undefined;

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
            bypassAllergenBlock,
          },
        );

        return {
          toolMessage: {
            role: "tool" as const,
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          },
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
    } else if (execution.shaped.customRecipe) {
      customRecipeResult = {
        recipe: execution.shaped.customRecipe,
        safetyFlags: execution.shaped.safetyFlags,
      };
    } else if (execution.shaped.retrievalResult) {
      retrievalResult = execution.shaped
        .retrievalResult as RetrieveCustomRecipeResult;
    }
  }

  return { toolMessages, recipes, customRecipeResult, retrievalResult };
}

// ============================================================
// Streaming
// ============================================================

/**
 * Handle streaming request with SSE.
 */
function handleStreamingRequest(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | undefined,
  message: string,
  log: Logger,
  bypassAllergenBlock: boolean,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let streamTimedOut = false;

      const resetStreamTimeout = () => {
        if (streamTimeoutId) clearTimeout(streamTimeoutId);
        streamTimeoutId = setTimeout(() => {
          streamTimedOut = true;
          controller.enqueue(
            encoder.encode(
              `data: ${
                JSON.stringify({
                  type: "error",
                  error: "Stream timeout — no data for 30 seconds",
                })
              }\n\n`,
            ),
          );
          controller.close();
        }, STREAM_TIMEOUT_MS);
      };

      const clearStreamTimeout = () => {
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
          streamTimeoutId = null;
        }
      };

      const send = (data: Record<string, unknown>) => {
        if (streamTimedOut) return;
        controller.enqueue(
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
        let customRecipeResult: GenerateRecipeResult | undefined;
        let retrievalResult: RetrieveCustomRecipeResult | undefined;
        let streamMessages = messages;
        let selectedModel: string | undefined;

        // Check for modification of existing custom recipe (same logic as non-streaming)
        const lastCustomRecipeMessage = userContext.conversationHistory
          .slice()
          .reverse()
          .find((m) => m.role === "assistant" && m.metadata?.customRecipe);

        if (lastCustomRecipeMessage?.metadata?.customRecipe) {
          const modIntent = detectModificationIntent(message, {
            hasRecipe: true,
            lastRecipeName:
              lastCustomRecipeMessage.metadata.customRecipe.suggestedName ||
              "previous recipe",
          });

          timings.mod_detection_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();

          if (modIntent.isModification) {
            log.info("Modification detected, forcing regeneration");
            send({ type: "status", status: "cooking_it_up" });

            // Two-phase SSE for modification flow
            const onPartialRecipe: PartialRecipeCallback = (partialRecipe) => {
              send({ type: "recipe_partial", recipe: partialRecipe });
              send({ type: "status", status: "enriching" });
            };

            const lastRecipe = lastCustomRecipeMessage.metadata.customRecipe;
            try {
              const recipeStepsSummary = Array.isArray(lastRecipe.steps)
                ? lastRecipe.steps
                  .slice(0, 25)
                  .map((step: { order?: number; instruction?: string }) =>
                    `${step.order ?? "?"}. ${step.instruction ?? ""}`
                  )
                  .join(" | ")
                : "";
              const richModificationContext = [
                `ORIGINAL RECIPE: "${
                  lastRecipe.suggestedName || "previous recipe"
                }"`,
                `Steps: ${recipeStepsSummary || "not available"}`,
                `Difficulty: ${lastRecipe.difficulty || "not specified"}`,
                `Portions: ${lastRecipe.portions || "not specified"}`,
                `MODIFICATION REQUESTED: ${modIntent.modifications}`,
              ].join("\n");

              const { recipe: modifiedRecipe, safetyFlags } =
                await generateCustomRecipe(
                  supabase,
                  {
                    ingredients: lastRecipe.ingredients.map((i: any) => i.name),
                    targetTime: lastRecipe.totalTime,
                    difficulty: lastRecipe.difficulty,
                    additionalRequests: richModificationContext,
                    useful_items: Array.isArray(lastRecipe.usefulItems)
                      ? lastRecipe.usefulItems
                        .map((item: { name?: string }) => item.name)
                        .filter((name: unknown): name is string =>
                          typeof name === "string" && name.length > 0
                        )
                      : [],
                  },
                  userContext,
                  undefined,
                  onPartialRecipe,
                  { bypassAllergenBlock },
                );

              customRecipeResult = { recipe: modifiedRecipe, safetyFlags };
              timings.recipe_gen_ms = Math.round(
                performance.now() - phaseStart,
              );
              phaseStart = performance.now();

              // Use fixed message for modification
              const finalText = userContext.language === "es"
                ? "¡Aquí está tu receta actualizada!"
                : "Here's your updated recipe!";

              // No suggestions for recipes - the prompt text invites modifications
              timings.suggestions_ms = 0;

              const response = await finalizeResponse(
                supabase,
                sessionId,
                message,
                finalText,
                userContext,
                undefined,
                customRecipeResult,
                undefined,
              );
              timings.finalize_ms = Math.round(performance.now() - phaseStart);
              timings.total_ms = Math.round(performance.now() - startTime);

              log.info("Modification flow complete", {
                type: "modification",
                model: getProviderConfig("generation").model,
                ...timings,
              });
              log.info("PERF_SUMMARY", {
                type: "modification",
                model: getProviderConfig("generation").model,
                ...timings,
              });

              // Send content right before completion
              send({ type: "content", content: response.message });
              send({ type: "done", response });
              clearStreamTimeout();
              controller.close();
              return;
            } catch (error) {
              log.error("Modification failed", error);
              // Fall through to normal AI flow
            }
          }
        }

        // Detect high recipe intent to force tool use (prevents AI from just chatting)
        const forceToolUse = hasHighRecipeIntent(message);
        if (forceToolUse) {
          log.info("High recipe intent detected, forcing tool use");
        }

        const firstResponse = await callAI(
          messages,
          true,
          forceToolUse ? "required" : "auto",
        );
        selectedModel = firstResponse.model;
        timings.llm_call_ms = Math.round(performance.now() - phaseStart);
        phaseStart = performance.now();
        const assistantMessage = firstResponse.choices[0].message;

        log.info("AI response", {
          hasToolCalls: !!assistantMessage.tool_calls?.length,
          toolNames: assistantMessage.tool_calls?.map((tc) => tc.function.name),
          forcedToolUse: forceToolUse,
        });

        if (
          assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0
        ) {
          const toolName = assistantMessage.tool_calls[0].function.name;
          send({
            type: "status",
            status: toolName === "search_recipes"
              ? "searching"
              : toolName === "generate_custom_recipe"
              ? "cooking_it_up"
              : "generating",
          });

          // Two-phase SSE: emit partial recipe before enrichment for perceived latency
          const onPartialRecipe: PartialRecipeCallback = (partialRecipe) => {
            send({ type: "recipe_partial", recipe: partialRecipe });
            send({ type: "status", status: "enriching" });
          };

          const toolResult = await executeToolCalls(
            supabase,
            assistantMessage.tool_calls,
            userContext,
            log,
            onPartialRecipe,
            bypassAllergenBlock,
          );
          timings.tool_exec_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();
          recipes = toolResult.recipes;
          customRecipeResult = toolResult.customRecipeResult;
          retrievalResult = toolResult.retrievalResult;

          log.info("Tool execution result", {
            hasRecipes: !!recipes?.length,
            hasCustomRecipe: !!customRecipeResult?.recipe,
            hasRetrieval: !!retrievalResult,
          });

          streamMessages = [...messages, {
            role: "assistant" as const,
            content: assistantMessage.content,
            tool_calls: assistantMessage.tool_calls,
          }, ...toolResult.toolMessages];

          // No-results fallback for search
          if (
            recipes !== undefined && recipes.length === 0 &&
            !customRecipeResult && !retrievalResult
          ) {
            const fallback = buildNoResultsFallback(userContext.language);
            send({ type: "content", content: fallback.message });
            const response = await finalizeResponse(
              supabase,
              sessionId,
              message,
              fallback.message,
              userContext,
              undefined,
              undefined,
              fallback.suggestions,
              undefined,
            );
            timings.total_ms = Math.round(performance.now() - startTime);
            log.info("No-results fallback", timings);
            log.info("PERF_SUMMARY", {
              type: "recipe_search",
              model: selectedModel,
              ...timings,
            });
            send({ type: "done", response });
            clearStreamTimeout();
            controller.close();
            return;
          }
        }

        // If a custom recipe was generated, use a fixed short message instead of streaming AI text
        // NOTE: Don't send content here when recipe exists - it will be included in the "done" response
        // This ensures the recipe card renders before/with the text, not after
        let finalText: string;
        let suggestions:
          | import("../_shared/irmixy-schemas.ts").SuggestionChip[]
          | undefined;

        if (customRecipeResult?.recipe) {
          // Fixed message asking about changes - sent with completion, not streamed
          finalText = userContext.language === "es"
            ? "¡Listo! ¿Quieres cambiar algo?"
            : "Ready! Want to change anything?";

          // No suggestions for recipes - the prompt text invites modifications
          suggestions = undefined;
          timings.suggestions_ms = 0;
        } else if (retrievalResult) {
          // Retrieval result: stream AI response grounded in tool results, use retrieval suggestions
          finalText = await callAIStream(
            streamMessages,
            (token) => send({ type: "content", content: token }),
          );
          timings.stream_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();
          send({ type: "stream_complete" });
          suggestions = retrievalResult.suggestions;
          timings.suggestions_ms = 0;
        } else {
          // Normal streaming for non-recipe responses
          finalText = await callAIStream(
            streamMessages,
            (token) => send({ type: "content", content: token }),
          );
          timings.stream_ms = Math.round(performance.now() - phaseStart);
          phaseStart = performance.now();

          // Signal that streaming is complete - frontend can enable input now
          send({ type: "stream_complete" });

          // Use template suggestions immediately to avoid blocking
          // This eliminates the 2.9s AI call for suggestions
          suggestions = getContextualSuggestions({
            language: userContext.language,
            hasRecipes: !!recipes?.length,
            recipeNames: recipes?.map((recipe) => recipe.name),
            hasCustomRecipe: !!customRecipeResult?.recipe,
          });
          timings.suggestions_ms = 0; // No AI call needed
        }

        const response = await finalizeResponse(
          supabase,
          sessionId,
          message,
          finalText,
          userContext,
          recipes,
          customRecipeResult,
          suggestions,
        );
        timings.finalize_ms = Math.round(performance.now() - phaseStart);
        timings.total_ms = Math.round(performance.now() - startTime);

        // If we have a custom recipe, send the content right before completion
        // so they arrive together and the recipe card renders with the text
        if (customRecipeResult?.recipe) {
          send({ type: "content", content: response.message });
        }

        // Performance timing log
        const requestType = customRecipeResult?.recipe
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
        controller.close();
      } catch (error) {
        log.error("Streaming error", error);
        send({
          type: "error",
          error: "An unexpected error occurred",
        });
        clearStreamTimeout();
        controller.close();
      }
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
