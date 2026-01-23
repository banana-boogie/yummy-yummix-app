/**
 * Irmixy Response Schema & Validation
 *
 * Defines the canonical response format for all AI interactions.
 * Uses Zod for runtime validation.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ============================================================
// Zod Schemas
// ============================================================

export const RecipeCardSchema = z.object({
  recipeId: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().optional(),
  totalTime: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  portions: z.number().int().positive(),
});

export const SuggestionChipSchema = z.object({
  label: z.string(),
  message: z.string(),
});

export const QuickActionSchema = z.object({
  type: z.enum(['start_cooking', 'view_recipe', 'save_recipe', 'set_timer']),
  label: z.string(),
  payload: z.record(z.unknown()),
});

export const GeneratedRecipeSchema = z.object({
  schemaVersion: z.literal('1.0'),
  suggestedName: z.string(),
  measurementSystem: z.enum(['imperial', 'metric']),
  language: z.enum(['en', 'es']),
  ingredients: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    imageUrl: z.string().optional(),
  })),
  steps: z.array(z.object({
    order: z.number().int().positive(),
    instruction: z.string(),
    thermomixTime: z.number().optional(),
    thermomixTemp: z.string().optional(),
    thermomixSpeed: z.string().optional(),
  })),
  totalTime: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  portions: z.number().int().positive(),
  tags: z.array(z.string()),
});

export const SafetyFlagsSchema = z.object({
  allergenWarning: z.string().optional(),
  dietaryConflict: z.string().optional(),
  error: z.boolean().optional(),
});

export const IrmixyResponseSchema = z.object({
  version: z.literal('1.0'),
  message: z.string(),
  language: z.enum(['en', 'es']),
  status: z.enum(['thinking', 'searching', 'generating']).nullable().optional(),
  recipes: z.array(RecipeCardSchema).optional(),
  customRecipe: GeneratedRecipeSchema.optional(),
  suggestions: z.array(SuggestionChipSchema).optional(),
  actions: z.array(QuickActionSchema).optional(),
  memoryUsed: z.array(z.string()).optional(),
  safetyFlags: SafetyFlagsSchema.optional(),
});

// ============================================================
// TypeScript Types (derived from Zod)
// ============================================================

export type RecipeCard = z.infer<typeof RecipeCardSchema>;
export type SuggestionChip = z.infer<typeof SuggestionChipSchema>;
export type QuickAction = z.infer<typeof QuickActionSchema>;
export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>;
export type SafetyFlags = z.infer<typeof SafetyFlagsSchema>;
export type IrmixyResponse = z.infer<typeof IrmixyResponseSchema>;

// ============================================================
// Supporting Interfaces
// ============================================================

export interface AllergenEntry {
  category: string;
  ingredient_canonical: string;
  name_en: string;
  name_es: string;
}

export interface SearchRecipesParams {
  query?: string;
  cuisine?: string;
  maxTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  limit?: number;
}

export interface UserContext {
  language: 'en' | 'es';
  measurementSystem: 'imperial' | 'metric';
  dietaryRestrictions: string[];
  ingredientDislikes: string[];
  skillLevel: string | null;
  householdSize: number | null;
  conversationHistory: Array<{ role: string; content: string }>;
}

// ============================================================
// Validation Helpers
// ============================================================

export class ValidationError extends Error {
  public issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super(`Schema validation failed: ${issues.map(i => i.message).join(', ')}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/**
 * Validate data against a Zod schema, throwing ValidationError on failure.
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }
  return result.data;
}
