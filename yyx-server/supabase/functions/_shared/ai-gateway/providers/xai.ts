/**
 * AI Gateway - xAI Provider
 *
 * Thin wrapper over the OpenAI-compatible base for xAI (Grok models).
 * Uses xAI's OpenAI-compatible API at https://api.x.ai/v1.
 */

import { AICompletionRequest, AICompletionResponse } from "../types.ts";
import {
  callOpenAICompatible,
  callOpenAICompatibleStream,
  type OpenAICompatibleConfig,
  type OpenAICompatibleStreamResult,
} from "./openai-compatible.ts";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

const XAI_CONFIG: OpenAICompatibleConfig = {
  chatUrl: XAI_CHAT_URL,
  providerName: "xAI",
  logPrefix: "[ai-gateway:xai]",
  maxTokensField: "max_tokens",
  supportsReasoning: false,
  reasoningModelPrefixes: [],
};

// =============================================================================
// Chat Completions
// =============================================================================

export async function callXAI(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AICompletionResponse> {
  return callOpenAICompatible(XAI_CONFIG, request, model, apiKey);
}

// Re-export stream types for backwards compatibility
export type XAIStreamUsage = { inputTokens: number; outputTokens: number };
export type XAIStreamResult = OpenAICompatibleStreamResult;

export async function callXAIStream(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<XAIStreamResult> {
  return callOpenAICompatibleStream(XAI_CONFIG, request, model, apiKey);
}
