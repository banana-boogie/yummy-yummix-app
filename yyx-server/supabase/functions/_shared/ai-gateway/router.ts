/**
 * AI Gateway - Router
 *
 * Routes AI requests to the appropriate provider/model based on usage type.
 * Supports environment variable overrides with provider:model format.
 */

import {
  AIProvider,
  AIProviderConfig,
  AIRoutingConfig,
  AIUsageType,
} from "./types.ts";

/**
 * Map provider names to their API key environment variable.
 */
const providerApiKeyMap: Record<AIProvider, string> = {
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/**
 * Default routing configuration.
 * Maps usage types to specific providers and models.
 * Can be overridden via environment variables.
 */
const defaultRoutingConfig: AIRoutingConfig = {
  // Chat completions (orchestrator tool calling + streaming)
  text: {
    provider: "google",
    model: "gemini-3-flash-preview",
    apiKeyEnvVar: "GEMINI_API_KEY",
  },
  // Recipe generation (structured JSON output) — quality + speed critical
  recipe_generation: {
    provider: "google",
    model: "gemini-3-flash-preview",
    apiKeyEnvVar: "GEMINI_API_KEY",
  },
  // Recipe modification (transform existing recipe JSON)
  recipe_modification: {
    provider: "google",
    model: "gemini-3-flash-preview",
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
 * Parse a provider:model override string.
 * Supports two formats:
 * - "provider:model"  → switch provider and model (e.g., "openai:gpt-4.1-mini")
 * - "model"           → keep same provider, override model only (e.g., "gemini-2.5-flash")
 *
 * Exported for testing.
 */
export function parseModelOverride(
  override: string,
  currentConfig: AIProviderConfig,
): AIProviderConfig {
  if (override.includes(":")) {
    const [providerStr, ...modelParts] = override.split(":");
    const provider = providerStr as AIProvider;
    const model = modelParts.join(":"); // Rejoin in case model has colons

    const apiKeyEnvVar = providerApiKeyMap[provider];
    if (!apiKeyEnvVar) {
      console.warn(
        `[ai-gateway:router] Unknown provider '${provider}' in override '${override}', using default`,
      );
      return currentConfig;
    }

    return { provider, model, apiKeyEnvVar };
  }

  // Model-only override: keep same provider
  return { ...currentConfig, model: override };
}

/**
 * Get the provider configuration for a given usage type.
 * Checks for environment variable overrides first.
 *
 * Override examples:
 * - AI_TEXT_MODEL=openai:gpt-4.1-mini          → switch to OpenAI
 * - AI_RECIPE_GENERATION_MODEL=gemini-2.5-flash → same provider, different model
 * - AI_PARSING_MODEL=gpt-5-nano                → same provider, different model
 */
export function getProviderConfig(usageType: AIUsageType): AIProviderConfig {
  const envOverride = Deno.env.get(`AI_${usageType.toUpperCase()}_MODEL`);
  const config = defaultRoutingConfig[usageType];

  if (envOverride) {
    return parseModelOverride(envOverride, config);
  }

  return config;
}

/**
 * Get all available usage types.
 */
export function getAvailableUsageTypes(): AIUsageType[] {
  return Object.keys(defaultRoutingConfig) as AIUsageType[];
}
