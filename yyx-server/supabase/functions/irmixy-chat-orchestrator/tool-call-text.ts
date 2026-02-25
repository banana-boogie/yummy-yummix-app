/**
 * Helpers for detecting and removing plain-text tool-call leakage.
 *
 * Some providers may occasionally emit tool-call syntax in assistant text
 * (instead of structured tool calls). We detect that pattern for retries and
 * sanitize final text before persistence.
 */

const TOOL_NAMES = [
  "search_recipes",
  "generate_custom_recipe",
  "modify_recipe",
  "retrieve_cooked_recipes",
];

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TOOL_PATTERN = TOOL_NAMES.map(escapeRegex).join("|");
const TOOL_CALL_TAIL_REGEX = new RegExp(
  `\\n?(?:call:)?(?:${TOOL_PATTERN})\\{[\\s\\S]*$`,
  "m",
);

/** Detect if AI output tool-call syntax as plain text instead of structured calls. */
export function detectTextToolCall(content: string): string | null {
  if (!content) return null;
  for (const name of TOOL_NAMES) {
    if (content.includes(`call:${name}`) || content.includes(`${name}{`)) {
      return name;
    }
  }
  return null;
}

/** Strip residual tool-call text from a final assistant message. */
export function stripToolCallText(text: string): string {
  if (!text) return text;
  return text.replace(TOOL_CALL_TAIL_REGEX, "").trim();
}
