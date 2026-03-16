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

  // Detect bracket-style markers — AI mimicking history summary format
  // instead of calling the tool (e.g. "[Modified recipe: ...]")
  const lower = content.toLowerCase();
  if (lower.includes("[modified recipe:")) return "modify_recipe";
  if (lower.includes("[generated recipe:")) return "generate_custom_recipe";

  return null;
}

/** Strip residual tool-call text from a final assistant message. */
export function stripToolCallText(text: string): string {
  if (!text) return text;
  return text.replace(TOOL_CALL_TAIL_REGEX, "").trim();
}

/**
 * Streaming filter that buffers tokens when they look like the start of
 * a tool-call leak, then either suppresses (if confirmed) or flushes
 * (if it was a false positive).
 *
 * Normal tokens pass through immediately with zero latency.
 */
export class StreamingToolCallFilter {
  private buffer = "";
  private buffering = false;
  private readonly onFlush: (text: string) => void;
  private readonly disabled: boolean;

  // Patterns that confirm a tool call leak (check against accumulated buffer)
  private static readonly SUPPRESS_PATTERNS = [
    /<tool_calls>/,
    /\ncall:\w+\{/,
    /^call:\w+\{/,
    /^search_recipes\{/,
    /^generate_custom_recipe\{/,
    /^modify_recipe\{/,
    /^retrieve_cooked_recipes\{/,
    /\{"recipeDescription":/,
    /\{"suggestedName":/,
    /\{"query":/,
  ];

  // Max buffer size before we flush as false positive
  private static readonly MAX_BUFFER = 100;

  constructor(onFlush: (text: string) => void, disabled = false) {
    this.onFlush = onFlush;
    this.disabled = disabled;
  }

  /** Process a single token. */
  push(token: string): void {
    if (this.disabled) {
      this.onFlush(token);
      return;
    }

    if (this.buffering) {
      this.buffer += token;

      // Check if buffer matches a known tool-call pattern -> suppress
      if (this.matchesSuppressPattern()) {
        // Confirmed tool call — keep buffering to consume remaining content
        return;
      }

      // Buffer too large without match -> false positive, flush everything
      if (this.buffer.length > StreamingToolCallFilter.MAX_BUFFER) {
        const flushed = this.buffer;
        this.buffer = "";
        this.buffering = false;
        this.onFlush(flushed);
        return;
      }

      return;
    }

    // Not currently buffering — check if this token should trigger buffering
    if (this.shouldStartBuffering(token)) {
      this.buffering = true;
      this.buffer = token;
      return;
    }

    // Normal token — pass through immediately
    this.onFlush(token);
  }

  /** Call when stream ends. Flushes any remaining buffer (partial match = false positive). */
  end(): void {
    if (this.buffer && !this.matchesSuppressPattern()) {
      this.onFlush(this.buffer);
    }
    this.buffer = "";
    this.buffering = false;
  }

  /** Call on abort — discard buffer entirely. */
  abort(): void {
    this.buffer = "";
    this.buffering = false;
  }

  private shouldStartBuffering(token: string): boolean {
    const trimmed = token.trimStart();
    if (trimmed.startsWith("<")) return true; // XML-style <tool_calls>
    if (trimmed.startsWith("{")) return true; // JSON object start

    // Check if token starts with a tool name
    for (const name of TOOL_NAMES) {
      if (trimmed.startsWith(name) || token.includes(`call:${name}`)) {
        return true;
      }
    }

    // Newline followed by "call:" pattern
    if (token.includes("\ncall:")) return true;

    return false;
  }

  private matchesSuppressPattern(): boolean {
    for (const pattern of StreamingToolCallFilter.SUPPRESS_PATTERNS) {
      if (pattern.test(this.buffer)) return true;
    }
    return false;
  }
}
