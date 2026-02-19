/**
 * AI Gateway - Router
 *
 * Routes AI requests to the appropriate provider/model based on usage type.
 */

import { AIProviderConfig, AIRoutingConfig, AIUsageType } from "./types.ts";

/**
 * Default routing configuration.
 * Maps usage types to specific providers and models.
 * Can be overridden via environment variables.
 */
const defaultRoutingConfig: AIRoutingConfig = {
  // Chat completions (orchestrator tool calling + streaming)
  text: {
    provider: "openai",
    model: "gpt-5-mini",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  // Recipe generation (structured JSON output)
  recipe_generation: {
    provider: "openai",
    model: "gpt-5-mini",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  // Structured data parsing (admin, nutrition extraction)
  parsing: {
    provider: "openai",
    model: "gpt-5-nano",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  // Text embeddings for vector search
  embedding: {
    provider: "openai",
    model: "text-embedding-3-large",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
};

/**
 * Get the provider configuration for a given usage type.
 * Checks for environment variable overrides first.
 *
 * Override examples:
 * - AI_TEXT_MODEL=gpt-5
 * - AI_RECIPE_GENERATION_MODEL=gpt-5
 * - AI_PARSING_MODEL=gpt-5-mini
 */
export function getProviderConfig(usageType: AIUsageType): AIProviderConfig {
  const envOverride = Deno.env.get(`AI_${usageType.toUpperCase()}_MODEL`);

  const config = defaultRoutingConfig[usageType];

  if (envOverride) {
    return {
      ...config,
      model: envOverride,
    };
  }

  return config;
}

/**
 * Get all available usage types.
 */
export function getAvailableUsageTypes(): AIUsageType[] {
  return Object.keys(defaultRoutingConfig) as AIUsageType[];
}
