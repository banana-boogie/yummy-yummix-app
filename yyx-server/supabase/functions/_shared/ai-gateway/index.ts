/**
 * AI Gateway - Main Entry Point
 *
 * Unified interface for making AI requests.
 * ALL operations are routed through this gateway, which uses
 * the router to determine the appropriate provider and model.
 *
 * To switch providers:
 * 1. Modify router.ts default config, OR
 * 2. Set environment variables: AI_TEXT_MODEL, AI_PARSING_MODEL, AI_REASONING_MODEL
 */

import {
  AICompletionRequest,
  AICompletionResponse,
} from "./types.ts";
import { getProviderConfig } from "./router.ts";
import {
  callOpenAI,
  callOpenAIStream,
} from "./providers/openai.ts";

/**
 * Make an AI chat request.
 * Routes to the appropriate provider based on usageType.
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

  switch (config.provider) {
    case "openai":
      return callOpenAI(request, model, apiKey);

    case "anthropic":
      throw new Error("Anthropic provider not yet implemented");

    case "google":
      throw new Error("Google provider not yet implemented");

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Make an AI chat request with streaming.
 * Returns an async generator that yields content chunks.
 */
export async function* chatStream(
  request: AICompletionRequest,
): AsyncGenerator<string, void, unknown> {
  const config = getProviderConfig(request.usageType);
  const model = request.model ?? config.model;
  const apiKey = Deno.env.get(config.apiKeyEnvVar);

  if (!apiKey) {
    throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
  }

  switch (config.provider) {
    case "openai":
      yield* callOpenAIStream(request, model, apiKey);
      break;

    case "anthropic":
      throw new Error("Anthropic streaming not yet implemented");

    case "google":
      throw new Error("Google streaming not yet implemented");

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Re-export types for convenience
export * from "./types.ts";
export { getAvailableUsageTypes, getProviderConfig } from "./router.ts";
