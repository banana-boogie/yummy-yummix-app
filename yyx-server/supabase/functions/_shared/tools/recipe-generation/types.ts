/**
 * Types for the custom recipe generation pipeline.
 */

import type { GeneratedRecipe, SafetyFlags } from "../../irmixy-schemas.ts";

export interface GenerateRecipeResult {
  recipe: GeneratedRecipe;
  safetyFlags?: SafetyFlags;
}

export interface AIUsageLogContext {
  userId: string;
  requestId: string;
  sessionId?: string;
  functionName: string;
}

/**
 * Callback for two-phase SSE: called with partial recipe before enrichment.
 * This allows the UI to display the recipe immediately while enrichment happens.
 */
export type PartialRecipeCallback = (partialRecipe: GeneratedRecipe) => void;

/**
 * Result of checking ingredients against allergen restrictions.
 */
export interface AllergenCheckResult {
  safe: boolean;
  warning?: string;
  systemUnavailable?: boolean;
}
