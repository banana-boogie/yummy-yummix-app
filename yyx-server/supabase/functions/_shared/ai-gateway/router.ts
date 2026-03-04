/**
 * AI Gateway - Router
 *
 * Routes AI requests to the appropriate provider/model based on usage type.
 * To swap models, change the defaults below and redeploy.
 */

import { AIProviderConfig, AIRoutingConfig, AIUsageType } from "./types.ts";

/**
 * Routing configuration — hardcoded defaults.
 * To swap models, change the provider/model here and redeploy.
 *
 * Tested alternatives for recipe_creation:
 * - openai / gpt-5          → highest quality, $1.25/$10.00 per 1M tokens
 * - anthropic / claude-sonnet-4-6 → high quality, $3.00/$15.00 per 1M tokens
 * - xai / grok-4.1-fast     → good quality, $0.20/$0.50 per 1M tokens
 * - openai / gpt-5-mini     → good quality, $0.25/$2.00 per 1M tokens (default)
 */
const defaultRoutingConfig: AIRoutingConfig = {
  // Chat completions (orchestrator tool calling + streaming)
  text: {
    provider: "google",
    model: "gemini-2.5-flash",
    apiKeyEnvVar: "GEMINI_API_KEY",
  },
  // Recipe generation — legacy single-stage (kept for modify_recipe compatibility)
  recipe_generation: {
    provider: "google",
    model: "gemini-2.5-flash",
    apiKeyEnvVar: "GEMINI_API_KEY",
  },
  // Stage 1: Creative recipe generation (natural language output, quality critical)
  recipe_creation: {
    provider: "openai",
    model: "gpt-5-mini",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  // Stage 2: Mechanical JSON formatting (structured output, speed critical)
  recipe_formatting: {
    provider: "openai",
    model: "gpt-5-nano",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  // Recipe modification (transform existing recipe JSON)
  recipe_modification: {
    provider: "google",
    model: "gemini-2.5-flash",
    apiKeyEnvVar: "GEMINI_API_KEY",
  },
  // Structured data parsing (admin, nutrition extraction) — speed over quality
  parsing: {
    provider: "openai",
    model: "gpt-4.1-nano",
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
 * Direct lookup — no env var overrides.
 */
export function getProviderConfig(usageType: AIUsageType): AIProviderConfig {
  return defaultRoutingConfig[usageType];
}

/**
 * Get all available usage types.
 */
export function getAvailableUsageTypes(): AIUsageType[] {
  return Object.keys(defaultRoutingConfig) as AIUsageType[];
}
