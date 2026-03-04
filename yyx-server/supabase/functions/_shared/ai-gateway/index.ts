/**
 * AI Gateway - Main Entry Point
 *
 * Unified interface for making AI requests.
 * ALL operations are routed through this gateway, which uses
 * the router to determine the appropriate provider and model.
 *
 * To switch providers, modify router.ts default config and redeploy.
 */

import {
  AICompletionRequest,
  AICompletionResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIStreamResult,
  CostContext,
} from "./types.ts";
import { getProviderConfig } from "./router.ts";
import { calculateCost } from "./pricing.ts";
import {
  callOpenAI,
  callOpenAIEmbedding,
  callOpenAIStream,
} from "./providers/openai.ts";
import { callGemini, callGeminiStream } from "./providers/google.ts";
import { callAnthropic } from "./providers/anthropic.ts";
import { callXAI, callXAIStream } from "./providers/xai.ts";

/**
 * Fire-and-forget cost recording. Imported lazily to avoid circular deps.
 */
function autoRecordCost(
  costContext: CostContext,
  model: string,
  usageType: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
): void {
  import("../ai-budget/index.ts").then(({ recordCost }) => {
    recordCost({
      userId: costContext.userId,
      model,
      usageType,
      inputTokens,
      outputTokens,
      costUsd,
      edgeFunction: costContext.edgeFunction,
      metadata: costContext.metadata,
    }).catch((err) =>
      console.error("[ai-gateway] Failed to record cost:", err)
    );
  }).catch((err) =>
    console.error("[ai-gateway] Failed to import ai-budget:", err)
  );
}

/**
 * Make an AI chat request.
 * Routes to the appropriate provider based on usageType.
 * Calculates cost and auto-records if costContext is provided.
 */
export async function chat(
  request: AICompletionRequest,
): Promise<AICompletionResponse> {
  const config = getProviderConfig(request.usageType);
  const model = request.model ?? config.model;
  const apiKey = Deno.env.get(config.apiKeyEnvVar);

  if (!apiKey) {
    throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
  }

  let response: AICompletionResponse;

  switch (config.provider) {
    case "openai":
      response = await callOpenAI(request, model, apiKey);
      break;

    case "anthropic":
      response = await callAnthropic(request, model, apiKey);
      break;

    case "google":
      response = await callGemini(request, model, apiKey);
      break;

    case "xai":
      response = await callXAI(request, model, apiKey);
      break;

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }

  // Calculate cost
  response.costUsd = await calculateCost(
    response.model,
    response.usage.inputTokens,
    response.usage.outputTokens,
  );

  // Auto-record if cost context provided
  if (request.costContext) {
    autoRecordCost(
      request.costContext,
      response.model,
      request.usageType,
      response.usage.inputTokens,
      response.usage.outputTokens,
      response.costUsd,
    );
  }

  return response;
}

/**
 * Make an AI chat request with streaming.
 * Returns an AIStreamResult with a stream generator and deferred usage/cost.
 */
export async function chatStream(
  request: AICompletionRequest,
): Promise<AIStreamResult> {
  const config = getProviderConfig(request.usageType);
  const model = request.model ?? config.model;
  const apiKey = Deno.env.get(config.apiKeyEnvVar);

  if (!apiKey) {
    throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
  }

  let providerResult: {
    stream: AsyncGenerator<string, void, unknown>;
    usage: () => Promise<{ inputTokens: number; outputTokens: number }>;
  };

  switch (config.provider) {
    case "openai":
      providerResult = await callOpenAIStream(request, model, apiKey);
      break;

    case "anthropic":
      throw new Error(
        "Anthropic streaming not implemented — use chat() instead",
      );

    case "google":
      providerResult = await callGeminiStream(request, model, apiKey);
      break;

    case "xai":
      providerResult = await callXAIStream(request, model, apiKey);
      break;

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }

  return {
    stream: providerResult.stream,
    usage: async () => {
      const usage = await providerResult.usage();
      const costUsd = await calculateCost(
        model,
        usage.inputTokens,
        usage.outputTokens,
      );

      // Auto-record if cost context provided
      if (request.costContext) {
        autoRecordCost(
          request.costContext,
          model,
          request.usageType,
          usage.inputTokens,
          usage.outputTokens,
          costUsd,
        );
      }

      return {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd,
        model,
      };
    },
  };
}

/**
 * Generate a text embedding.
 * Routes to the appropriate provider based on the "embedding" usage type.
 * Calculates cost and auto-records if costContext is provided.
 */
export async function embed(
  request: AIEmbeddingRequest,
): Promise<AIEmbeddingResponse> {
  const config = getProviderConfig(request.usageType);
  const model = request.model ?? config.model;
  const apiKey = Deno.env.get(config.apiKeyEnvVar);

  if (!apiKey) {
    throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
  }

  let response: AIEmbeddingResponse;

  try {
    switch (config.provider) {
      case "openai":
        response = await callOpenAIEmbedding(request.text, model, apiKey);
        break;

      case "anthropic":
        throw new Error("Anthropic embeddings not supported");

      case "google":
        throw new Error("Google embeddings not yet implemented");

      case "xai":
        throw new Error("xAI embeddings not supported");

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  } catch (error) {
    console.error(
      "[ai-gateway:embedding] Failed:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  // Calculate cost (embeddings have no output tokens)
  response.costUsd = await calculateCost(model, response.usage.inputTokens, 0);

  // Auto-record if cost context provided
  if (request.costContext) {
    autoRecordCost(
      request.costContext,
      response.model,
      "embedding",
      response.usage.inputTokens,
      0,
      response.costUsd,
    );
  }

  return response;
}

// Re-export types for convenience
export * from "./types.ts";
export { getAvailableUsageTypes, getProviderConfig } from "./router.ts";
