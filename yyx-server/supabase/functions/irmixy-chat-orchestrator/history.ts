/**
 * History Management
 *
 * Saves message exchanges to conversation history.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { IrmixyResponse } from "../_shared/irmixy-schemas.ts";

/**
 * Save message exchange to conversation history.
 * Session ownership is already validated by ensureSessionId() in the serve() handler.
 */
export async function saveMessageToHistory(
  supabase: SupabaseClient,
  sessionId: string,
  userMessage: string,
  assistantResponse: IrmixyResponse,
): Promise<void> {
  // Save user message
  await supabase.from("user_chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: userMessage,
  });

  // Save assistant response with recipes/customRecipe if present
  const toolCallsData: Record<string, unknown> = {};
  if (assistantResponse.recipes) {
    toolCallsData.recipes = assistantResponse.recipes;
  }
  if (assistantResponse.customRecipe) {
    toolCallsData.customRecipe = assistantResponse.customRecipe;
  }
  if (assistantResponse.safetyFlags) {
    toolCallsData.safetyFlags = assistantResponse.safetyFlags;
  }

  await supabase.from("user_chat_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: assistantResponse.message,
    // Store recipes/customRecipe in tool_calls column for retrieval on resume
    tool_calls: Object.keys(toolCallsData).length > 0 ? toolCallsData : null,
  });
}
