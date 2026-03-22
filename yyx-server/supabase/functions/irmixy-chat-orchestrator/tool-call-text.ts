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
  "app_action",
];

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TOOL_PATTERN = TOOL_NAMES.map(escapeRegex).join("|");
const TOOL_CALL_TAIL_REGEX = new RegExp(
  `\\n?(?:call:)?(?:${TOOL_PATTERN})(?:\\{|\\s+\\w)[\\s\\S]*$`,
  "m",
);

/** Detect if AI output tool-call syntax as plain text instead of structured calls. */
export function detectTextToolCall(content: string): string | null {
  if (!content) return null;
  for (const name of TOOL_NAMES) {
    if (content.includes(`call:${name}`) || content.includes(`${name}{`)) {
      return name;
    }
    // Detect space-separated format: toolname word:
    const spaceArgPattern = new RegExp(`${name}\\s+\\w+:`);
    if (spaceArgPattern.test(content)) return name;
  }

  // Detect bracket-style markers — AI mimicking history summary format
  // instead of calling the tool (e.g. "[Modified recipe: ...]")
  const lower = content.toLowerCase();
  if (lower.includes("[modified recipe:")) return "modify_recipe";
  if (lower.includes("[generated recipe:")) return "generate_custom_recipe";

  // Detect XML-format tool call syntax (<function_calls> / <invoke name="..."> / <tool>)
  if (content.includes("<function_calls>")) return TOOL_NAMES[0];
  if (/<tool[\s>]/.test(content)) return TOOL_NAMES[0];
  for (const name of TOOL_NAMES) {
    if (content.includes(`<invoke name="${name}"`)) return name;
  }

  return null;
}

// Regex to strip "The tool returned: ..." text from end of responses
const TOOL_RETURNED_REGEX = /\n?The tool returned:[\s\S]*$/;

// Regex to strip XML <function_calls>...</function_calls> blocks
const XML_FUNCTION_CALLS_REGEX = /<function_calls>[\s\S]*?<\/function_calls>/g;
// Fallback: strip unclosed <function_calls> blocks (stream cut off before closing tag)
const XML_FUNCTION_CALLS_UNCLOSED_REGEX = /<function_calls>[\s\S]*$/;
// Regex to strip <tool>...</tool> blocks (another XML tool call format)
const XML_TOOL_REGEX = /<tool[\s>][\s\S]*?<\/tool>/g;
// Fallback: strip unclosed <tool> blocks
const XML_TOOL_UNCLOSED_REGEX = /<tool[\s>][\s\S]*$/;

/** Strip residual tool-call text from a final assistant message. */
export function stripToolCallText(text: string): string {
  if (!text) return text;
  const result = text
    .replace(TOOL_CALL_TAIL_REGEX, "")
    .replace(TOOL_RETURNED_REGEX, "")
    .replace(XML_FUNCTION_CALLS_REGEX, "")
    .replace(XML_FUNCTION_CALLS_UNCLOSED_REGEX, "")
    .replace(XML_TOOL_REGEX, "")
    .replace(XML_TOOL_UNCLOSED_REGEX, "");
  return result.trim();
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
  private charsFlushed = 0;
  private readonly onFlush: (text: string) => void;
  private readonly disabled: boolean;

  // Cross-token phrase detection: accumulates text that could be the start of
  // "The tool returned:" arriving across multiple streaming tokens.
  private pendingPhrase = "";
  private static readonly CROSS_TOKEN_PHRASE = "The tool returned:";

  // Patterns that confirm a tool call leak (check against accumulated buffer)
  private static readonly SUPPRESS_PATTERNS = [
    /<tool_calls>/,
    /<tool[\s>]/,
    /<function_calls>/,
    /<invoke\s/,
    /<parameter\s/,
    /\ncall:\w+\{/,
    /^call:\w+\{/,
    /^search_recipes\{/,
    /^generate_custom_recipe\{/,
    /^modify_recipe\{/,
    /^retrieve_cooked_recipes\{/,
    /\{"recipeDescription":/,
    /\{"suggestedName":/,
    /\{"query":/,
    /The tool returned:/,
    new RegExp(`^\\n?(?:${TOOL_PATTERN})\\s+\\w`),
  ];

  // Max buffer size before we flush as false positive
  // Increased to 500 to handle multi-line XML tool call blocks
  private static readonly MAX_BUFFER = 500;

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
        this.charsFlushed += flushed.length;
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

    // Cross-token phrase detection for "The tool returned:"
    // Accumulate tokens that could be building up to the phrase
    if (this.pendingPhrase.length > 0 || this.couldStartPhrase(token)) {
      this.pendingPhrase += token;
      const phrase = StreamingToolCallFilter.CROSS_TOKEN_PHRASE;

      // Complete match — start suppression buffering
      if (this.pendingPhrase.includes(phrase)) {
        this.buffering = true;
        this.buffer = this.pendingPhrase;
        this.pendingPhrase = "";
        return;
      }

      // Still a valid prefix of the phrase — keep holding
      if (phrase.startsWith(this.pendingPhrase.trimStart())) {
        return;
      }

      // Broke the pattern — flush pending as normal output
      const flushed = this.pendingPhrase;
      this.pendingPhrase = "";
      this.charsFlushed += flushed.length;
      this.onFlush(flushed);
      return;
    }

    // Normal token — pass through immediately
    this.charsFlushed += token.length;
    this.onFlush(token);
  }

  /** Call when stream ends. Flushes any remaining buffer (partial match = false positive). */
  end(): void {
    // Flush pending phrase buffer (partial cross-token match = false positive)
    if (this.pendingPhrase) {
      this.onFlush(this.pendingPhrase);
      this.pendingPhrase = "";
    }
    if (this.buffer && !this.matchesSuppressPattern()) {
      this.onFlush(this.buffer);
    }
    this.buffer = "";
    this.buffering = false;
    this.charsFlushed = 0;
  }

  /** Call on abort — discard buffer entirely. */
  abort(): void {
    this.buffer = "";
    this.buffering = false;
    this.pendingPhrase = "";
    this.charsFlushed = 0;
  }

  private shouldStartBuffering(token: string): boolean {
    const trimmed = token.trimStart();
    if (trimmed.startsWith("<") && /^<[a-zA-Z]/.test(trimmed)) return true; // XML-style <tool_calls>, <tool>, etc.

    // Only buffer `{` at stream start or after a newline — avoids false positives
    // on legitimate `{` mid-sentence (e.g., "Use {ingredient} for best results")
    if (trimmed.startsWith("{")) {
      const isStreamStart = this.charsFlushed === 0;
      const afterNewline = token.startsWith("\n") || token.startsWith("\r");
      if (isStreamStart || afterNewline) return true;
    }

    // Check if token starts with a tool name
    for (const name of TOOL_NAMES) {
      if (trimmed.startsWith(name) || token.includes(`call:${name}`)) {
        return true;
      }
    }

    // Newline followed by "call:" pattern
    if (token.includes("\ncall:")) return true;

    // "The tool returned:" — parroted tool result summary
    if (trimmed.startsWith("The tool returned:")) return true;

    return false;
  }

  private matchesSuppressPattern(): boolean {
    for (const pattern of StreamingToolCallFilter.SUPPRESS_PATTERNS) {
      if (pattern.test(this.buffer)) return true;
    }
    return false;
  }

  /** Check if a token could be the beginning of "The tool returned:" */
  private couldStartPhrase(token: string): boolean {
    const trimmed = token.trimStart();
    const phrase = StreamingToolCallFilter.CROSS_TOKEN_PHRASE;
    // Check if the trimmed token is a prefix of the phrase
    return trimmed.length > 0 && phrase.startsWith(trimmed);
  }
}
