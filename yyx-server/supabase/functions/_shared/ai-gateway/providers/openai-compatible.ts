/**
 * AI Gateway - OpenAI-Compatible Provider Base
 *
 * Shared implementation for OpenAI-format APIs (OpenAI, xAI, and any future
 * OpenAI-compatible provider). Each provider passes a config object to
 * customize URL, field names, capabilities, and log prefix.
 */

import {
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AIStreamChunk,
  AITool,
  AIToolCall,
} from "../types.ts";

// =============================================================================
// Provider Configuration
// =============================================================================

export interface OpenAICompatibleConfig {
  /** API endpoint URL for chat completions */
  chatUrl: string;
  /** Provider name for logs and error messages */
  providerName: string;
  /** Log prefix, e.g. "[ai-gateway:openai]" */
  logPrefix: string;
  /** Field name for max tokens: "max_completion_tokens" (OpenAI) or "max_tokens" (xAI) */
  maxTokensField: "max_completion_tokens" | "max_tokens";
  /** Whether this provider supports reasoning_effort (gpt-5/o models) */
  supportsReasoning: boolean;
  /** Model prefixes that support reasoning (e.g. ["gpt-5", "o"]) */
  reasoningModelPrefixes: string[];
}

// =============================================================================
// Types (OpenAI-compatible format)
// =============================================================================

interface OpenAICompatibleResponse {
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

/** Safely parse tool arguments JSON, returning {} on failure. */
export function safeParseToolArguments(
  raw: string,
  logPrefix: string,
): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`${logPrefix} Failed to parse tool arguments:`, error);
    return {};
  }
}

// =============================================================================
// Message Serialization
// =============================================================================

/**
 * Serialize AIMessage[] to OpenAI-compatible wire format.
 * Handles system, user, assistant (with optional tool_calls), and tool messages.
 */
function serializeMessages(
  messages: AIMessage[],
): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.tool_call_id,
      };
    }
    if (m.role === "assistant") {
      const msg: Record<string, unknown> = {
        role: "assistant",
        content: m.content,
      };
      if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === "string"
              ? tc.arguments
              : JSON.stringify(tc.arguments),
          },
        }));
      }
      return msg;
    }
    return { role: m.role, content: m.content };
  });
}

// =============================================================================
// Chat Completions
// =============================================================================

/**
 * Call an OpenAI-compatible chat completions API.
 */
export async function callOpenAICompatible(
  config: OpenAICompatibleConfig,
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AICompletionResponse> {
  const startedAt = performance.now();

  // Build request body
  const body: Record<string, unknown> = {
    model,
    messages: serializeMessages(request.messages),
    [config.maxTokensField]: request.maxTokens ?? 4096,
  };

  // Reasoning effort (mutually exclusive with temperature)
  if (request.reasoningEffort && config.supportsReasoning) {
    const supportsIt = config.reasoningModelPrefixes.some((prefix) =>
      model.startsWith(prefix)
    );
    if (supportsIt) {
      body.reasoning_effort = request.reasoningEffort;
    } else {
      console.warn(
        `${config.logPrefix} reasoningEffort '${request.reasoningEffort}' ignored for model '${model}'`,
      );
    }
  } else if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  // JSON schema structured output
  if (request.responseFormat) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "response",
        schema: request.responseFormat.schema,
        strict: true,
      },
    };
  }

  // Tools
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool: AITool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    if (request.toolChoice) {
      body.tool_choice = request.toolChoice;
    }
  }

  const response = await fetch(config.chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`${config.logPrefix} Chat request failed`, {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(
      `${config.providerName} API error (${response.status}): ${errorBody}`,
    );
  }

  const data: OpenAICompatibleResponse = await response.json();
  const choice = data.choices[0];
  const durationMs = Math.round(performance.now() - startedAt);
  console.log(`${config.logPrefix} Chat request complete`, {
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
    costUsd: 0, // Calculated by gateway
    toolCalls: choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseToolArguments(
        tc.function.arguments,
        config.logPrefix,
      ),
    })),
  };
}

// =============================================================================
// Streaming Chat Completions
// =============================================================================

export interface OpenAICompatibleStreamUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface OpenAICompatibleStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  usage: () => Promise<OpenAICompatibleStreamUsage>;
}

/**
 * Call an OpenAI-compatible chat completions API with streaming.
 * Returns a stream generator and a deferred usage() promise.
 */
export async function callOpenAICompatibleStream(
  config: OpenAICompatibleConfig,
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<OpenAICompatibleStreamResult> {
  const startedAt = performance.now();

  const body: Record<string, unknown> = {
    model,
    messages: serializeMessages(request.messages),
    [config.maxTokensField]: request.maxTokens ?? 4096,
    stream: true,
    stream_options: { include_usage: true },
  };

  // Reasoning effort
  if (request.reasoningEffort && config.supportsReasoning) {
    const supportsIt = config.reasoningModelPrefixes.some((prefix) =>
      model.startsWith(prefix)
    );
    if (supportsIt) {
      body.reasoning_effort = request.reasoningEffort;
    } else {
      console.warn(
        `${config.logPrefix} reasoningEffort '${request.reasoningEffort}' ignored for model '${model}'`,
      );
    }
  } else if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  const response = await fetch(config.chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`${config.logPrefix} Stream request failed`, {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(
      `${config.providerName} API error (${response.status}): ${errorBody}`,
    );
  }
  console.log(`${config.logPrefix} Stream connected`, {
    model,
    connect_ms: Math.round(performance.now() - startedAt),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  // Deferred usage — resolved when stream completes
  let resolveUsage: (usage: OpenAICompatibleStreamUsage) => void;
  const usagePromise = new Promise<OpenAICompatibleStreamUsage>((resolve) => {
    resolveUsage = resolve;
  });

  async function* generateStream(): AsyncGenerator<string, void, unknown> {
    const decoder = new TextDecoder();
    let buffer = "";
    let capturedUsage: OpenAICompatibleStreamUsage = {
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
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            // Capture usage from the final chunk (choices: [], usage: {...})
            if (json.usage) {
              capturedUsage = {
                inputTokens: json.usage.prompt_tokens ?? 0,
                outputTokens: json.usage.completion_tokens ?? 0,
              };
            }

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
      reader!.releaseLock();
      resolveUsage!(capturedUsage);
    }

    console.log(`${config.logPrefix} Stream completed`, {
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

// =============================================================================
// Streaming Chat Completions with Tool Calls
// =============================================================================

export interface OpenAICompatibleToolStreamResult {
  stream: AsyncGenerator<AIStreamChunk, void, unknown>;
  usage: () => Promise<OpenAICompatibleStreamUsage>;
}

/**
 * Call an OpenAI-compatible chat completions API with streaming + tool call support.
 * Yields AIStreamChunk: text tokens stream immediately, tool calls are yielded
 * as a single chunk once fully accumulated at stream end.
 */
export async function callOpenAICompatibleStreamWithTools(
  config: OpenAICompatibleConfig,
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<OpenAICompatibleToolStreamResult> {
  const startedAt = performance.now();

  const body: Record<string, unknown> = {
    model,
    messages: serializeMessages(request.messages),
    [config.maxTokensField]: request.maxTokens ?? 4096,
    stream: true,
    stream_options: { include_usage: true },
  };

  // Reasoning effort
  if (request.reasoningEffort && config.supportsReasoning) {
    const supportsIt = config.reasoningModelPrefixes.some((prefix) =>
      model.startsWith(prefix)
    );
    if (supportsIt) {
      body.reasoning_effort = request.reasoningEffort;
    }
  } else if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  // Tools
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool: AITool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    if (request.toolChoice) {
      body.tool_choice = request.toolChoice;
    }
  }

  const response = await fetch(config.chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`${config.logPrefix} StreamWithTools request failed`, {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(
      `${config.providerName} API error (${response.status}): ${errorBody}`,
    );
  }
  console.log(`${config.logPrefix} StreamWithTools connected`, {
    model,
    connect_ms: Math.round(performance.now() - startedAt),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  let resolveUsage: (usage: OpenAICompatibleStreamUsage) => void;
  const usagePromise = new Promise<OpenAICompatibleStreamUsage>((resolve) => {
    resolveUsage = resolve;
  });

  async function* generateStream(): AsyncGenerator<
    AIStreamChunk,
    void,
    unknown
  > {
    const decoder = new TextDecoder();
    let buffer = "";
    let capturedUsage: OpenAICompatibleStreamUsage = {
      inputTokens: 0,
      outputTokens: 0,
    };

    // Accumulate tool calls by index
    const toolCallAccumulator: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();

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
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            // Capture usage from the final chunk
            if (json.usage) {
              capturedUsage = {
                inputTokens: json.usage.prompt_tokens ?? 0,
                outputTokens: json.usage.completion_tokens ?? 0,
              };
            }

            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            // Text content
            if (delta.content) {
              yield { type: "text", text: delta.content };
            }

            // Tool calls (streamed incrementally by index)
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                const existing = toolCallAccumulator.get(idx);
                if (!existing) {
                  toolCallAccumulator.set(idx, {
                    id: tc.id || "",
                    name: tc.function?.name || "",
                    arguments: tc.function?.arguments || "",
                  });
                } else {
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) {
                    existing.arguments += tc.function.arguments;
                  }
                }
              }
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

    // Yield accumulated tool calls as a single chunk
    if (toolCallAccumulator.size > 0) {
      const toolCalls: AIToolCall[] = [];
      for (const [, tc] of toolCallAccumulator) {
        toolCalls.push({
          id: tc.id,
          name: tc.name,
          arguments: safeParseToolArguments(tc.arguments, config.logPrefix),
        });
      }
      yield { type: "tool_calls", toolCalls };
    }

    console.log(`${config.logPrefix} StreamWithTools completed`, {
      model,
      total_ms: Math.round(performance.now() - startedAt),
      input_tokens: capturedUsage.inputTokens,
      output_tokens: capturedUsage.outputTokens,
      tool_calls: toolCallAccumulator.size,
    });
  }

  return {
    stream: generateStream(),
    usage: () => usagePromise,
  };
}
