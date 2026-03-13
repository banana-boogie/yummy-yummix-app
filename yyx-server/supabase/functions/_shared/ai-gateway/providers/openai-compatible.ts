/**
 * AI Gateway - OpenAI-Compatible Provider Base
 *
 * Shared implementation for OpenAI-format APIs (OpenAI, xAI, and any future
 * OpenAI-compatible provider). Each provider passes a config object to
 * customize URL, field names, capabilities, and log prefix.
 */

import { AICompletionRequest, AICompletionResponse, AITool } from "../types.ts";

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
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
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
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
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
