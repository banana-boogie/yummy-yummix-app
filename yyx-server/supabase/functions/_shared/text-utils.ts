/**
 * Shared text utilities for search and scoring.
 */

/**
 * Check if any word in `text` starts with `term`.
 * Prevents "ice" from matching "r**ice**" — only matches "ice cream".
 */
export function wordStartMatch(text: string, term: string): boolean {
  const words = text.split(/\s+/);
  return words.some((word) => word.startsWith(term));
}
