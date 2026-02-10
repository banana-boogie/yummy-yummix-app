/**
 * Modification Detection
 *
 * Detects if the user wants to modify an existing recipe
 * using regex heuristics instead of LLM calls (~1.5s → <5ms).
 */

import { detectModificationHeuristic } from "./recipe-intent.ts";

export const CONVERSATIONAL_NEGATION_PATTERNS = [
  /^no(?:\s+thanks|\s+thank you)?[.!]*$/i,
  /^no(?:,\s*|\s+)that'?s?\s+fine[.!]*$/i,
  /^no(?:,\s*|\s+)i'?m\s+good[.!]*$/i,
  /^no(?:,\s*|\s+)est[aá]\s+bien[.!]*$/i,
  /^no(?:,\s*|\s+)gracias[.!]*$/i,
];

export function detectModificationIntent(
  message: string,
  conversationContext: { hasRecipe: boolean; lastRecipeName?: string },
): { isModification: boolean; modifications: string } {
  if (!conversationContext.hasRecipe) {
    return { isModification: false, modifications: "" };
  }

  const normalizedMessage = message.trim();
  if (
    CONVERSATIONAL_NEGATION_PATTERNS.some((pattern) =>
      pattern.test(normalizedMessage)
    )
  ) {
    return { isModification: false, modifications: "" };
  }

  return detectModificationHeuristic(message);
}
