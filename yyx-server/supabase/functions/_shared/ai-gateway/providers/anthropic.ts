/**
 * AI Gateway - Anthropic Provider
 *
 * Full implementation for Anthropic's Messages API.
 * Supports: chat completions, streaming, tool calling, and structured JSON output.
 * Translates from the gateway's OpenAI-format interface to Anthropic's format.
 */

import {
  AICompletionRequest,
  AICompletionResponse,
  AITool,
  AIToolCall,
} from "../types.ts";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

// =============================================================================
// Types
// =============================================================================

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  tools?: AnthropicTool[];
  tool_choice?:
    | { type: "auto" }
    | { type: "any" }
    | { type: "tool"; name: string };
  thinking?: {
    type: "enabled";
    budget_tokens: number;
  };
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: AnthropicContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// =============================================================================
// Message Translation (exported for testing)
// =============================================================================

/**
 * Extract system messages and translate remaining messages to Anthropic format.
 * Anthropic uses a top-level `system` param instead of system role messages.
 */
export function translateMessagesForAnthropic(
  messages: AICompletionRequest["messages"],
): { system?: string; messages: AnthropicMessage[] } {
  const systemParts: string[] = [];
  const anthropicMessages: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      anthropicMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: anthropicMessages,
  };
}

/**
 * Translate gateway tools to Anthropic format.
 * Anthropic uses `input_schema` instead of `parameters`.
 */
export function translateToolsForAnthropic(
  tools: AITool[],
): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

/**
 * Translate gateway tool_choice to Anthropic format.
 */
export function translateToolChoiceForAnthropic(
  toolChoice: AICompletionRequest["toolChoice"],
): AnthropicRequest["tool_choice"] {
  if (!toolChoice) return undefined;
  if (toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "required") return { type: "any" };
  if (typeof toolChoice === "object" && toolChoice.function?.name) {
    return { type: "tool", name: toolChoice.function.name };
  }
  return undefined;
}

/**
 * Map gateway reasoning effort to Anthropic thinking budget.
 * Anthropic uses budget_tokens (token count) for extended thinking.
 * Exported for testing.
 */
export function mapReasoningToThinking(
  reasoningEffort: AICompletionRequest["reasoningEffort"],
): AnthropicRequest["thinking"] | undefined {
  if (!reasoningEffort) return undefined;

  const budgetMap: Record<string, number> = {
    minimal: 1024,
    low: 2048,
    medium: 8192,
    high: 32768,
  };

  const budget = budgetMap[reasoningEffort];
  if (!budget) return undefined;

  return { type: "enabled", budget_tokens: budget };
}

/**
 * Extract tool calls from Anthropic response content blocks.
 */
function extractToolCalls(
  content: AnthropicContentBlock[],
): AIToolCall[] | undefined {
  const toolUseBlocks = content.filter((block) => block.type === "tool_use");
  if (toolUseBlocks.length === 0) return undefined;

  return toolUseBlocks.map((block) => ({
    id: block.id!,
    name: block.name!,
    arguments: block.input ?? {},
  }));
}

/**
 * Extract text content from Anthropic response content blocks.
 */
function extractTextContent(content: AnthropicContentBlock[]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text!)
    .join("");
}

// =============================================================================
// Shared Headers
// =============================================================================

function getAnthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_API_VERSION,
  };
}

// =============================================================================
// Chat Completions
// =============================================================================

/**
 * Call Anthropic's Messages API.
 *
 * Supports:
 * - Tool calling via tools[] and tool_choice
 * - Structured JSON output via responseFormat (uses tool_use pattern)
 */
export async function callAnthropic(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AICompletionResponse> {
  const startedAt = performance.now();

  const { system, messages } = translateMessagesForAnthropic(request.messages);

  const anthropicRequest: AnthropicRequest = {
    model,
    max_tokens: request.maxTokens ?? 4096,
    messages,
  };

  if (system) {
    anthropicRequest.system = system;
  }

  // Extended thinking (mutually exclusive with temperature)
  if (request.reasoningEffort) {
    const thinking = mapReasoningToThinking(request.reasoningEffort);
    if (thinking) {
      anthropicRequest.thinking = thinking;
      // Temperature is not allowed with extended thinking
    }
  } else if (request.temperature !== undefined) {
    anthropicRequest.temperature = request.temperature;
  }

  // Structured JSON output via tool_use pattern
  // When responseFormat is requested, we create a tool for structured output
  // and force the model to use it. This gives Anthropic the same schema
  // enforcement as other providers.
  if (request.responseFormat) {
    const jsonTool: AnthropicTool = {
      name: "json_response",
      description:
        "Return the response as structured JSON matching this schema.",
      input_schema: request.responseFormat.schema,
    };

    // Merge with any existing tools
    const existingTools = request.tools
      ? translateToolsForAnthropic(request.tools)
      : [];
    anthropicRequest.tools = [...existingTools, jsonTool];
    // Anthropic doesn't allow forced tool_choice with extended thinking,
    // so fall back to "auto" when reasoning is enabled.
    anthropicRequest.tool_choice = anthropicRequest.thinking
      ? { type: "auto" }
      : { type: "tool", name: "json_response" };
  } else if (request.tools && request.tools.length > 0) {
    // Regular tool calling (no JSON schema)
    anthropicRequest.tools = translateToolsForAnthropic(request.tools);
    anthropicRequest.tool_choice = translateToolChoiceForAnthropic(
      request.toolChoice,
    );
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: getAnthropicHeaders(apiKey),
    body: JSON.stringify(anthropicRequest),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:anthropic] Chat request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(
      `Anthropic API error (${response.status}): ${errorBody}`,
    );
  }

  const data: AnthropicResponse = await response.json();

  const durationMs = Math.round(performance.now() - startedAt);

  // Handle structured JSON output via tool_use
  if (request.responseFormat) {
    const toolUseBlock = data.content.find(
      (block) => block.type === "tool_use" && block.name === "json_response",
    );
    const textContent = extractTextContent(data.content);
    const jsonContent = toolUseBlock
      ? JSON.stringify(toolUseBlock.input)
      : textContent;

    console.log("[ai-gateway:anthropic] Chat request complete", {
      model: data.model || model,
      duration_ms: durationMs,
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens,
      has_tool_calls: false,
      json_schema: true,
    });

    return {
      content: jsonContent,
      model: data.model,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
      costUsd: 0,
    };
  }

  // Standard response (with optional tool calls)
  const content = extractTextContent(data.content);
  const toolCalls = extractToolCalls(data.content);

  console.log("[ai-gateway:anthropic] Chat request complete", {
    model: data.model || model,
    duration_ms: durationMs,
    input_tokens: data.usage.input_tokens,
    output_tokens: data.usage.output_tokens,
    has_tool_calls: !!toolCalls?.length,
  });

  return {
    content,
    model: data.model,
    usage: {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    },
    costUsd: 0,
    toolCalls,
  };
}

// =============================================================================
// Streaming Chat Completions
// =============================================================================

export interface AnthropicStreamUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AnthropicStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  usage: () => Promise<AnthropicStreamUsage>;
}

/**
 * Call Anthropic's Messages API with streaming.
 * Returns a stream generator and a deferred usage() promise.
 *
 * Anthropic uses typed SSE events:
 * - message_start: contains input token count
 * - content_block_delta: text chunks (type: "text_delta")
 * - message_delta: contains output token count and stop_reason
 * - message_stop: stream complete
 */
export async function callAnthropicStream(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AnthropicStreamResult> {
  if (request.tools?.length) {
    throw new Error(
      "Anthropic streaming does not support tool calls. Use non-streaming chat() instead.",
    );
  }

  const startedAt = performance.now();

  const { system, messages } = translateMessagesForAnthropic(request.messages);

  const body: Record<string, unknown> = {
    model,
    max_tokens: request.maxTokens ?? 4096,
    messages,
    stream: true,
  };

  if (system) body.system = system;

  // Extended thinking (mutually exclusive with temperature)
  if (request.reasoningEffort) {
    const thinking = mapReasoningToThinking(request.reasoningEffort);
    if (thinking) body.thinking = thinking;
  } else if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  // Tools in streaming mode
  if (request.tools && request.tools.length > 0) {
    body.tools = translateToolsForAnthropic(request.tools);
    const choice = translateToolChoiceForAnthropic(request.toolChoice);
    if (choice) body.tool_choice = choice;
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: getAnthropicHeaders(apiKey),
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:anthropic] Stream request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(
      `Anthropic API error (${response.status}): ${errorBody}`,
    );
  }
  console.log("[ai-gateway:anthropic] Stream connected", {
    model,
    connect_ms: Math.round(performance.now() - startedAt),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  // Deferred usage — resolved when stream completes
  let resolveUsage: (usage: AnthropicStreamUsage) => void;
  const usagePromise = new Promise<AnthropicStreamUsage>((resolve) => {
    resolveUsage = resolve;
  });

  async function* generateStream(): AsyncGenerator<string, void, unknown> {
    const decoder = new TextDecoder();
    let buffer = "";
    const capturedUsage: AnthropicStreamUsage = {
      inputTokens: 0,
      outputTokens: 0,
    };

    try {
      while (true) {
        if (request.signal?.aborted) break;

        const { done, value } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            switch (json.type) {
              case "message_start":
                // Capture input tokens from the initial message
                capturedUsage.inputTokens = json.message?.usage?.input_tokens ??
                  0;
                break;

              case "content_block_delta":
                // Yield text deltas
                if (json.delta?.type === "text_delta" && json.delta?.text) {
                  yield json.delta.text;
                }
                break;

              case "message_delta":
                // Capture output tokens from the final delta
                capturedUsage.outputTokens = json.usage?.output_tokens ?? 0;
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader!.releaseLock();
      resolveUsage!(capturedUsage);
    }

    console.log("[ai-gateway:anthropic] Stream completed", {
      model,
      total_ms: Math.round(performance.now() - startedAt),
      input_tokens: capturedUsage.inputTokens,
      output_tokens: capturedUsage.outputTokens,
    });
  }

  return {
    stream: generateStream(),
    usage: () => usagePromise,
  };
}
