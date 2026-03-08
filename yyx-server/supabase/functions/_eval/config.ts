/**
 * AI Model Tournament — Configuration
 *
 * Model registry, test persona, pricing, and reasoning configs.
 * Prices pinned to provider pricing pages as of run date.
 */

import type { EvalProvider, ModelConfig } from "./types.ts";
import type { UserContext } from "../_shared/irmixy-schemas.ts";

// ============================================================
// Model Registry
// ============================================================

export const MODELS: ModelConfig[] = [
  {
    id: "gemini-2.5-flash",
    provider: "google",
    apiKeyEnvVar: "GEMINI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: true },
    reasoningEffort: {
      orchestrator: "low",
      recipe_generation: "medium",
      recipe_modification: "low",
    },
    pricing: { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  },
  {
    id: "gpt-5-mini",
    provider: "openai",
    apiKeyEnvVar: "OPENAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: true },
    reasoningEffort: {
      orchestrator: "low",
      recipe_generation: "medium",
      recipe_modification: "low",
    },
    pricing: { inputPerMillion: 1.10, outputPerMillion: 4.40 },
  },
  {
    id: "gpt-5",
    provider: "openai",
    apiKeyEnvVar: "OPENAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: true },
    reasoningEffort: {
      orchestrator: "low",
      recipe_generation: "medium",
      recipe_modification: "low",
    },
    pricing: { inputPerMillion: 2.00, outputPerMillion: 8.00 },
  },
  {
    id: "gpt-5-nano",
    provider: "openai",
    apiKeyEnvVar: "OPENAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: true },
    reasoningEffort: {
      orchestrator: "low",
      recipe_generation: "medium",
      recipe_modification: "low",
    },
    pricing: { inputPerMillion: 0.30, outputPerMillion: 1.20 },
  },
  {
    id: "gpt-4.1-nano",
    provider: "openai",
    apiKeyEnvVar: "OPENAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: false },
    reasoningEffort: {},
    pricing: { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  },
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    capabilities: { toolCalling: false, jsonSchema: false, reasoning: false },
    reasoningEffort: {},
    pricing: { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  },
  {
    id: "claude-haiku-4.5",
    provider: "anthropic",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    capabilities: { toolCalling: false, jsonSchema: false, reasoning: false },
    reasoningEffort: {},
    pricing: { inputPerMillion: 0.80, outputPerMillion: 4.00 },
  },
  {
    id: "grok-4.1-fast",
    provider: "xai",
    apiKeyEnvVar: "XAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: false },
    reasoningEffort: {},
    pricing: { inputPerMillion: 0.60, outputPerMillion: 4.00 },
  },
];

// ============================================================
// Test Persona
// ============================================================

/**
 * Canonical test user — Mexican Thermomix owner with gluten restriction.
 * Tests whether models respect HARD constraints (allergens, dislikes).
 */
export const TEST_USER_CONTEXT: UserContext = {
  language: "es",
  measurementSystem: "metric",
  dietaryRestrictions: ["gluten"],
  ingredientDislikes: ["cilantro"],
  skillLevel: "intermediate",
  householdSize: 4,
  conversationHistory: [],
  dietTypes: [],
  cuisinePreferences: ["mexicana", "italiana"],
  customAllergies: ["gluten"],
  kitchenEquipment: ["Thermomix TM6"],
};

// ============================================================
// Helpers
// ============================================================

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === modelId);
}

export function getModelsForProvider(provider: EvalProvider): ModelConfig[] {
  return MODELS.filter((m) => m.provider === provider);
}
