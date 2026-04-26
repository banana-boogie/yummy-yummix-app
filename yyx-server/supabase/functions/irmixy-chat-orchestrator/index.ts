/**
 * Irmixy Chat Orchestrator
 *
 * Text-chat entry point for Irmixy AI interactions.
 * Handles context loading, LLM tool calls (with proper tool loop),
 * and structured response generation.
 *
 * Flow: request -> validate -> stream -> context -> tool loop -> finalize
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { ValidationError } from "../_shared/irmixy-schemas.ts";
import type { CostContext } from "../_shared/ai-gateway/types.ts";

import { SessionOwnershipError } from "./types.ts";
import { createLogger, generateRequestId } from "./logger.ts";
import { ensureSessionId } from "./session.ts";
import {
  buildSuggestions,
  errorResponse,
  finalizeResponse,
  type ResponseCategory,
} from "./response-builder.ts";
import { buildActions } from "./action-builder.ts";
import { parseAndValidateRequest } from "./request-handler.ts";
import { createSSEResponse } from "./sse-stream.ts";
import { buildRequestContext } from "./context-loader.ts";
import { runToolLoop } from "./tool-loop.ts";

// ============================================================
// Entry Point
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
    const validated = await parseAndValidateRequest(req, log);

    // If validation returned a Response (error), return it directly
    if (validated instanceof Response) {
      return validated;
    }

    const {
      supabase,
      userId,
      sanitizedMessage,
      sessionId: rawSessionId,
      cookingContext,
      budgetWarning,
      todayLocalDate,
    } = validated;

    const sessionResult = await ensureSessionId(
      supabase,
      userId,
      rawSessionId,
      sanitizedMessage,
    );
    const sessionId = sessionResult.sessionId ?? rawSessionId;

    // Build cost context for automatic recording
    const costContext: CostContext = {
      userId,
      edgeFunction: "irmixy-chat-orchestrator",
    };

    // Stream the response via SSE
    return createSSEResponse(async (stream) => {
      const startTime = performance.now();
      let phaseStart = startTime;

      if (sessionId) {
        stream.send({ type: "session", sessionId });
      }
      if (budgetWarning) {
        stream.send({
          type: "budget_warning",
          usedUsd: budgetWarning.usedUsd,
          budgetUsd: budgetWarning.budgetUsd,
        });
      }
      stream.send({ type: "status", status: "thinking" });

      // Build context (user profile, conversation history, system prompt)
      const { userContext, messages, planContext } = await buildRequestContext(
        supabase,
        userId,
        sessionId,
        sanitizedMessage,
        cookingContext,
        todayLocalDate,
      );
      const contextBuildMs = Math.round(performance.now() - phaseStart);
      phaseStart = performance.now();

      // Run the streaming tool loop
      const loopResult = await runToolLoop({
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
      });

      stream.send({ type: "stream_complete" });
      const streamMs = Math.round(performance.now() - phaseStart);
      phaseStart = performance.now();

      if (stream.signal.aborted) {
        log.info("Request aborted by client (after streaming)");
        return;
      }

      // Finalize: validate response, save to history, send done event
      const hasSuccessfulCustomRecipe =
        !!loopResult.customRecipeResult?.recipe &&
        loopResult.customRecipeResult?.safetyFlags?.error !== true;

      const actions = buildActions(
        userContext.language,
        loopResult.appActionResult,
      );

      // Pick response category for hard-coded follow-up chips.
      // Chips are NOT LLM-generated — see response-builder.buildSuggestions.
      const category: ResponseCategory =
        loopResult.customRecipeResult?.recipe || loopResult.recipes?.length
          ? "recipe"
          : "general";
      const suggestions = buildSuggestions(
        category,
        userContext.language,
        planContext,
      );

      const response = await finalizeResponse(
        supabase,
        sessionId,
        sanitizedMessage,
        loopResult.finalText,
        userContext,
        loopResult.recipes,
        loopResult.customRecipeResult,
        actions.length > 0 ? actions : undefined,
        suggestions,
      );
      const finalizeMs = Math.round(performance.now() - phaseStart);
      const totalMs = Math.round(performance.now() - startTime);

      const timings = {
        context_build_ms: contextBuildMs,
        ...loopResult.timings,
        stream_ms: streamMs,
        finalize_ms: finalizeMs,
        total_ms: totalMs,
      };

      const perfType = hasSuccessfulCustomRecipe
        ? "recipe_gen"
        : loopResult.recipes?.length
        ? "recipe_search"
        : "chat";
      log.info("Request complete", {
        type: perfType,
        model: loopResult.selectedModel,
        ...timings,
      });
      log.info("PERF_SUMMARY", {
        type: perfType,
        model: loopResult.selectedModel,
        ...timings,
      });

      stream.send({ type: "done", response });
    }, req.signal);
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
