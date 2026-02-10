/**
 * Session Management
 *
 * Handles chat session creation, validation, and title generation.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { SessionResult } from "./types.ts";
import { SessionOwnershipError } from "./types.ts";

/**
 * Generate a session title from the first user message.
 * Truncates to 50 characters and adds ellipsis if needed.
 */
export function generateSessionTitle(message: string): string {
  // Clean up the message - remove extra whitespace
  const cleaned = message.trim().replace(/\s+/g, " ");

  // Truncate to 50 characters max
  if (cleaned.length <= 50) {
    return cleaned;
  }

  // Find a good break point (word boundary) before 50 chars
  const truncated = cleaned.substring(0, 50);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 20) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * Ensure a chat session exists. If no sessionId is provided, create one.
 * When creating a new session, sets the title from the first user message.
 */
export async function ensureSessionId(
  supabase: SupabaseClient,
  userId: string,
  sessionId?: string,
  initialMessage?: string,
): Promise<SessionResult> {
  if (sessionId) {
    const { data: session, error } = await supabase
      .from("user_chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to validate session ownership:", error);
      throw new Error("Failed to validate session");
    }

    if (!session) {
      throw new SessionOwnershipError("Session not found or not owned by user");
    }

    return { sessionId, created: false };
  }

  // Generate title from the first message
  const title = initialMessage ? generateSessionTitle(initialMessage) : null;

  const { data, error } = await supabase
    .from("user_chat_sessions")
    .insert({ user_id: userId, title })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Failed to create chat session: ${error?.message ?? "unknown error"}`,
    );
  }

  return { sessionId: data.id, created: true };
}
