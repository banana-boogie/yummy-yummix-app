/**
 * AI Gateway - Anthropic Provider
 *
 * Minimal implementation for Anthropic's Messages API.
 * Supports: chat completions (no streaming).
 * Translates from the gateway's OpenAI-format interface to Anthropic's format.
 */

import { AICompletionRequest, AICompletionResponse } from "../types.ts";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

// =============================================================================
// Types
// =============================================================================

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{
    type: "text";
    text: string;
  }>;
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

// =============================================================================
// Chat Completions
// =============================================================================

/**
 * Call Anthropic's Messages API.
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

  if (request.temperature !== undefined) {
    anthropicRequest.temperature = request.temperature;
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
    },
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

  // Extract text from content blocks
  const content = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const durationMs = Math.round(performance.now() - startedAt);
  console.log("[ai-gateway:anthropic] Chat request complete", {
    model: data.model || model,
    duration_ms: durationMs,
    input_tokens: data.usage.input_tokens,
    output_tokens: data.usage.output_tokens,
  });

  return {
    content,
    model: data.model,
    usage: {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    },
    costUsd: 0, // Calculated by gateway
  };
}
