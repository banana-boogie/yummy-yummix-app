/**
 * Context Loader
 *
 * Builds the request context: user profile, conversation history,
 * system prompt, and the message array for the LLM.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createContextBuilder } from "../_shared/context-builder.ts";
import type { ChatMessage, RequestContext } from "./types.ts";
import { detectMealContext } from "./meal-context.ts";
import { buildSystemPrompt } from "./system-prompt.ts";
import type { CookingContext } from "./system-prompt.ts";
import { loadPlanContext, type PlanContext } from "./plan-context.ts";

export type { PlanContext };

/**
 * Build request context: user profile, conversation history, and message array.
 */
export async function buildRequestContext(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | undefined,
  message: string,
  cookingContext?: CookingContext,
): Promise<RequestContext> {
  const contextBuilder = createContextBuilder(supabase);
  const [userContext, planContext] = await Promise.all([
    contextBuilder.buildContext(userId, sessionId),
    loadPlanContext(supabase, userId),
  ]);

  // Detect meal context from user message
  const mealContext = detectMealContext(message);

  const systemPrompt = buildSystemPrompt(
    userContext,
    mealContext,
    cookingContext,
    planContext,
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

  return { userContext, messages, planContext };
}
