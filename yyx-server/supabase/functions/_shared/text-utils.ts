/**
 * Shared text utilities for search, scoring, and content sanitization.
 */

/**
 * Check if any word in `text` starts with `term`.
 * Prevents "ice" from matching "r**ice**" — only matches "ice cream".
 */
export function wordStartMatch(text: string, term: string): boolean {
  const words = text.split(/\s+/);
  return words.some((word) => word.startsWith(term));
}

/** Strip LLM-hallucinated tool XML markup (e.g. `<tool>generate_custom_recipe</tool>`) from text. */
const TOOL_XML_RE = /<\/?tool[^>]*>/gi;
export function stripToolMarkup(text: string): string {
  return text.replace(TOOL_XML_RE, "");
}
