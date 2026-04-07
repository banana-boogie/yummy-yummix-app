/**
 * Request Handler
 *
 * Parses and validates the incoming HTTP request: JSON body, auth,
 * rate limiting, budget check, and cooking context extraction.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createUserClient } from "../_shared/supabase-client.ts";
import { sanitizeContent } from "../_shared/context-builder.ts";
import { errorResponse } from "./response-builder.ts";
import {
  BudgetCheckUnavailableError,
  checkTextBudget,
} from "../_shared/ai-budget/index.ts";
import { checkRateLimit } from "../_shared/ai-budget/rate-limiter.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type { CookingContext } from "./system-prompt.ts";
import type { Logger } from "./logger.ts";

/** Everything the orchestrator needs from a validated request. */
export interface ValidatedRequest {
  supabase: SupabaseClient;
  userId: string;
  sanitizedMessage: string;
  sessionId: string | undefined;
  cookingContext: CookingContext | undefined;
  budgetWarning: { usedUsd: number; budgetUsd: number } | undefined;
}

/**
 * Parse, authenticate, and validate the incoming request.
 *
 * Returns either a `ValidatedRequest` or a ready-to-return `Response`
 * (for errors / rate-limit / budget-exceeded).
 */
export async function parseAndValidateRequest(
  req: Request,
  log: Logger,
): Promise<ValidatedRequest | Response> {
  // --- Parse body ---
  let body:
    | {
      message: string;
      sessionId?: string;
      cookingContext?: {
        recipeTitle: string;
        currentStep: string;
        stepInstructions?: string;
        ingredients?: string;
        kitchenTools?: string;
        allSteps?: string;
        servings?: string;
        totalTime?: string;
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
      stepInstructions: typeof body.cookingContext.stepInstructions === "string"
        ? sanitizeContent(body.cookingContext.stepInstructions)
        : undefined,
      ingredients: typeof body.cookingContext.ingredients === "string"
        ? sanitizeContent(body.cookingContext.ingredients)
        : undefined,
      kitchenTools: typeof body.cookingContext.kitchenTools === "string"
        ? sanitizeContent(body.cookingContext.kitchenTools)
        : undefined,
      allSteps: typeof body.cookingContext.allSteps === "string"
        ? sanitizeContent(body.cookingContext.allSteps)
        : undefined,
      servings: typeof body.cookingContext.servings === "string"
        ? sanitizeContent(body.cookingContext.servings)
        : undefined,
      totalTime: typeof body.cookingContext.totalTime === "string"
        ? sanitizeContent(body.cookingContext.totalTime)
        : undefined,
    }
    : undefined;

  log.info("Request received", {
    hasSessionId: !!sessionId,
    messageLength: message.length,
  });

  // Validate message
  if (!message || !message.trim()) {
    return errorResponse("Message is required", 400);
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createUserClient(authHeader);

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

  // --- Rate limit ---
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

  // --- Budget check ---
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

  // Sanitize message
  const sanitizedMessage = sanitizeContent(message);
  log.info("Message sanitized", {
    messagePreview: sanitizedMessage.slice(0, 180),
  });

  return {
    supabase,
    userId: user.id,
    sanitizedMessage,
    sessionId,
    cookingContext,
    budgetWarning: budget.warningData,
  };
}
