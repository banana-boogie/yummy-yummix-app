/**
 * AI Gateway - xAI Provider
 *
 * Implementation of the AI provider interface for xAI (Grok models).
 * Uses xAI's OpenAI-compatible API at https://api.x.ai/v1.
 * Includes: chat completions and streaming chat completions.
 */

import { AICompletionRequest, AICompletionResponse, AITool } from "../types.ts";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

// =============================================================================
// Types (OpenAI-compatible)
// =============================================================================

interface XAIRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      schema: Record<string, unknown>;
      strict: boolean;
    };
  };
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?: "auto" | "required" | {
    type: "function";
    function: { name: string };
  };
}

interface XAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

function safeParseToolArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[ai-gateway:xai] Failed to parse tool arguments:", error);
    return {};
  }
}

// =============================================================================
// Chat Completions
// =============================================================================

/**
 * Call xAI's chat completions API.
 */
export async function callXAI(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AICompletionResponse> {
  const startedAt = performance.now();
  const xaiRequest: XAIRequest = {
    model,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: request.maxTokens ?? 4096,
  };

  if (request.temperature !== undefined) {
    xaiRequest.temperature = request.temperature;
  }

  if (request.responseFormat) {
    xaiRequest.response_format = {
      type: "json_schema",
      json_schema: {
        name: "response",
        schema: request.responseFormat.schema,
        strict: true,
      },
    };
  }

  if (request.tools && request.tools.length > 0) {
    xaiRequest.tools = request.tools.map((tool: AITool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    if (request.toolChoice) {
      xaiRequest.tool_choice = request.toolChoice;
    }
  }

  const response = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(xaiRequest),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:xai] Chat request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(`xAI API error (${response.status}): ${errorBody}`);
  }

  const data: XAIResponse = await response.json();
  const choice = data.choices[0];
  const durationMs = Math.round(performance.now() - startedAt);
  console.log("[ai-gateway:xai] Chat request complete", {
    model: data.model || model,
    duration_ms: durationMs,
    input_tokens: data.usage.prompt_tokens,
    output_tokens: data.usage.completion_tokens,
    has_tool_calls: !!choice.message.tool_calls?.length,
  });

  return {
    content: choice.message.content ?? "",
    model: data.model,
    usage: {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    },
    toolCalls: choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseToolArguments(tc.function.arguments),
    })),
  };
}

// =============================================================================
// Streaming Chat Completions
// =============================================================================

/**
 * Call xAI's chat completions API with streaming.
 * Returns an async generator that yields content chunks.
 */
export async function* callXAIStream(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): AsyncGenerator<string, void, unknown> {
  const startedAt = performance.now();
  const xaiRequest: Record<string, unknown> = {
    model,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: request.maxTokens ?? 4096,
    stream: true,
  };

  if (request.temperature !== undefined) {
    xaiRequest.temperature = request.temperature;
  }

  const response = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(xaiRequest),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:xai] Stream request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(`xAI API error (${response.status}): ${errorBody}`);
  }
  console.log("[ai-gateway:xai] Stream connected", {
    model,
    connect_ms: Math.round(performance.now() - startedAt),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (request.signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log("[ai-gateway:xai] Stream completed", {
    model,
    total_ms: Math.round(performance.now() - startedAt),
  });
}
