/**
 * AI Gateway - OpenAI Provider
 *
 * Thin wrapper over the OpenAI-compatible base. Adds OpenAI-specific features:
 * - reasoning_effort support for gpt-5/o models
 * - max_completion_tokens (OpenAI's field name)
 * - Embeddings API
 */

import {
  AICompletionRequest,
  AICompletionResponse,
  AIEmbeddingResponse,
  AIStreamResult,
  AITool,
} from "../types.ts";
import {
  callOpenAICompatible,
  callOpenAICompatibleStream,
  callOpenAICompatibleStreamWithTools,
  type OpenAICompatibleConfig,
  type OpenAICompatibleStreamResult,
  type OpenAICompatibleToolStreamResult,
} from "./openai-compatible.ts";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

const OPENAI_CONFIG: OpenAICompatibleConfig = {
  chatUrl: OPENAI_CHAT_URL,
  providerName: "OpenAI",
  logPrefix: "[ai-gateway:openai]",
  maxTokensField: "max_completion_tokens",
  supportsReasoning: true,
  reasoningModelPrefixes: ["gpt-5", "o"],
};

// =============================================================================
// Chat Completions
// =============================================================================

export async function callOpenAI(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AICompletionResponse> {
  return callOpenAICompatible(OPENAI_CONFIG, request, model, apiKey);
}

// Re-export stream types for backwards compatibility
export type OpenAIStreamUsage = { inputTokens: number; outputTokens: number };
export type OpenAIStreamResult = OpenAICompatibleStreamResult;

export async function callOpenAIStream(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<OpenAIStreamResult> {
  return callOpenAICompatibleStream(OPENAI_CONFIG, request, model, apiKey);
}

export type OpenAIToolStreamResult = OpenAICompatibleToolStreamResult;

export async function callOpenAIStreamWithTools(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<OpenAIToolStreamResult> {
  return callOpenAICompatibleStreamWithTools(
    OPENAI_CONFIG,
    request,
    model,
    apiKey,
  );
}

// =============================================================================
// Embeddings (OpenAI-specific — not shared)
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
    costUsd: 0, // Calculated by gateway
  };
}
