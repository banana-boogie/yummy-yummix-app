/**
 * AI Gateway - OpenAI Provider
 *
 * Implementation of the AI provider interface for OpenAI.
 * Includes: chat completions and streaming chat completions.
 */

import {
  AICompletionRequest,
  AICompletionResponse,
  AIEmbeddingResponse,
  AITool,
} from "../types.ts";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

// =============================================================================
// Chat Completions
// =============================================================================

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  reasoning_effort?: string;
  max_completion_tokens?: number;
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

interface OpenAIResponse {
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

function safeParseToolArguments(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[OpenAI] Failed to parse tool arguments:", error);
    return {};
  }
}

/**
 * Call OpenAI's chat completions API.
 */
export async function callOpenAI(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AICompletionResponse> {
  const startedAt = performance.now();
  const openaiRequest: OpenAIRequest = {
    model,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_completion_tokens: request.maxTokens ?? 4096,
  };

  // Add reasoning effort for models that support it
  if (request.reasoningEffort) {
    if (model.startsWith("gpt-5") || model.startsWith("o")) {
      openaiRequest.reasoning_effort = request.reasoningEffort;
    } else {
      console.warn(
        `[ai-gateway:openai] reasoningEffort '${request.reasoningEffort}' ignored for model '${model}'`,
      );
    }
  }

  // Add response format if specified
  if (request.responseFormat) {
    openaiRequest.response_format = {
      type: "json_schema",
      json_schema: {
        name: "response",
        schema: request.responseFormat.schema,
        strict: true,
      },
    };
  }

  // Add tools if specified
  if (request.tools && request.tools.length > 0) {
    openaiRequest.tools = request.tools.map((tool: AITool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    // Add tool_choice if specified
    if (request.toolChoice) {
      openaiRequest.tool_choice = request.toolChoice;
    }
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(openaiRequest),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:openai] Chat request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const data: OpenAIResponse = await response.json();
  const choice = data.choices[0];
  const durationMs = Math.round(performance.now() - startedAt);
  console.log("[ai-gateway:openai] Chat request complete", {
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

/**
 * Call OpenAI's chat completions API with streaming.
 * Returns an async generator that yields content chunks.
 */
export async function* callOpenAIStream(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): AsyncGenerator<string, void, unknown> {
  const startedAt = performance.now();
  const openaiRequest: Record<string, unknown> = {
    model,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_completion_tokens: request.maxTokens ?? 4096,
    stream: true,
  };

  // Add reasoning effort for models that support it
  if (request.reasoningEffort) {
    if (model.startsWith("gpt-5") || model.startsWith("o")) {
      openaiRequest.reasoning_effort = request.reasoningEffort;
    } else {
      console.warn(
        `[ai-gateway:openai] reasoningEffort '${request.reasoningEffort}' ignored for model '${model}'`,
      );
    }
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(openaiRequest),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:openai] Stream request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }
  console.log("[ai-gateway:openai] Stream connected", {
    model,
    connect_ms: Math.round(performance.now() - startedAt),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
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

  console.log("[ai-gateway:openai] Stream completed", {
    model,
    total_ms: Math.round(performance.now() - startedAt),
  });
}

// =============================================================================
// Embeddings
// =============================================================================

/**
 * Call OpenAI's embeddings API.
 */
export async function callOpenAIEmbedding(
  text: string,
  model: string,
  apiKey: string,
): Promise<AIEmbeddingResponse> {
  const startedAt = performance.now();
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[ai-gateway:embedding] OpenAI API error (${response.status}):`,
      errorBody,
    );
    console.error("[ai-gateway:openai] Embedding request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(
      `OpenAI embeddings API error (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error("Invalid embedding response from OpenAI");
  }

  console.log("[ai-gateway:openai] Embedding request complete", {
    model: data.model || model,
    duration_ms: Math.round(performance.now() - startedAt),
    input_tokens: data.usage?.prompt_tokens ?? 0,
    input_length: text.length,
  });

  return {
    embedding,
    model: data.model,
    usage: { inputTokens: data.usage?.prompt_tokens ?? 0 },
  };
}
