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
      orchestrator: "minimal",
      recipe_generation: "low",
      recipe_modification: "minimal",
    },
    pricing: { inputPerMillion: 0.30, outputPerMillion: 2.50 },
  },
  {
    id: "gemini-3-flash-preview",
    provider: "google",
    apiKeyEnvVar: "GEMINI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: true },
    reasoningEffort: {
      orchestrator: "minimal",
      recipe_generation: "low",
      recipe_modification: "minimal",
    },
    pricing: { inputPerMillion: 0.50, outputPerMillion: 3.00 },
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    apiKeyEnvVar: "OPENAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: false },
    reasoningEffort: {},
    pricing: { inputPerMillion: 0.40, outputPerMillion: 1.60 },
  },
  {
    id: "grok-4-1-fast-non-reasoning",
    provider: "xai",
    apiKeyEnvVar: "XAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: false },
    reasoningEffort: {},
    pricing: { inputPerMillion: 0.20, outputPerMillion: 0.50 },
  },

  // --- Premium tier (recipe gen/mod only) ---

  {
    id: "gpt-4.1",
    provider: "openai",
    apiKeyEnvVar: "OPENAI_API_KEY",
    capabilities: { toolCalling: true, jsonSchema: true, reasoning: false },
    reasoningEffort: {},
    pricing: { inputPerMillion: 2.00, outputPerMillion: 8.00 },
    excludeRoles: ["orchestrator"],
  },
  // --- Removed after Round 2 tournament (March 11, 2026) ---
  // gemini-3.1-flash-lite  — model doesn't exist (404 on all calls)
  // gemini-2.5-pro         — only works at "low" reasoning, 0% mod, $0.021/call
  // gpt-5-mini             — too slow (26-40s), mod 38% pass rate
  // grok-4-1-fast-reasoning — ~50s latency, 58-75% pass rate
  // claude-haiku-4-5       — rate limited (10K TPM), 42% pass rate
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
  kitchenEquipment: ["Thermomix TM6", "Air Fryer"],
};

/**
 * English test user — same constraints, English language + imperial units.
 * Tests whether models produce quality English output.
 */
export const TEST_USER_CONTEXT_EN: UserContext = {
  language: "en",
  measurementSystem: "imperial",
  dietaryRestrictions: ["gluten"],
  ingredientDislikes: ["cilantro"],
  skillLevel: "intermediate",
  householdSize: 4,
  conversationHistory: [],
  dietTypes: [],
  cuisinePreferences: ["Mexican", "Italian"],
  customAllergies: ["gluten"],
  kitchenEquipment: ["Thermomix TM6", "Air Fryer"],
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
