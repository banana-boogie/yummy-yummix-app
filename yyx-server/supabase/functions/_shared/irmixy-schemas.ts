/**
 * Irmixy AI Response Schemas
 *
 * Defines the canonical response structure for all Irmixy interactions.
 * Used by both text and voice modes to ensure consistent behavior.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ============================================================================
// Core Response Schema
// ============================================================================

export const IrmixyResponseSchema = z.object({
  version: z.literal('1.0'),
  message: z.string(),
  language: z.enum(['en', 'es']),
  status: z.enum(['thinking', 'searching', 'generating']).nullable().optional(),
  recipes: z.array(z.object({
    recipeId: z.string().uuid(),
    name: z.string(),
    imageUrl: z.string().url().optional(),
    totalTime: z.number().int().positive(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    portions: z.number().int().positive(),
  })).optional(),
  customRecipe: z.object({
    schemaVersion: z.literal('1.0'),
    suggestedName: z.string(),
    measurementSystem: z.enum(['imperial', 'metric']),
    language: z.enum(['en', 'es']),
    ingredients: z.array(z.object({
      name: z.string(),
      quantity: z.number().positive(),
      unit: z.string(),
      imageUrl: z.string().url().optional(),
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
  }).optional(),
  suggestions: z.array(z.object({
    label: z.string(),
    message: z.string(),
  })).optional(),
  actions: z.array(z.object({
    type: z.enum(['start_cooking', 'view_recipe', 'save_recipe', 'set_timer']),
    label: z.string(),
    payload: z.record(z.unknown()),
  })).optional(),
  memoryUsed: z.array(z.string()).optional(),
  safetyFlags: z.object({
    allergenWarning: z.string().optional(),
    dietaryConflict: z.string().optional(),
    error: z.boolean().optional(),
  }).optional(),
});

export type IrmixyResponse = z.infer<typeof IrmixyResponseSchema>;
export type RecipeCard = IrmixyResponse['recipes'][number];
export type GeneratedRecipe = NonNullable<IrmixyResponse['customRecipe']>;
export type SuggestionChip = IrmixyResponse['suggestions'][number];
export type QuickAction = IrmixyResponse['actions'][number];

// ============================================================================
// Tool Schemas
// ============================================================================

export const SearchRecipesParamsSchema = z.object({
  query: z.string().max(200),
  cuisine: z.string().optional(),
  maxTime: z.number().int().min(1).max(480).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

export type SearchRecipesParams = z.infer<typeof SearchRecipesParamsSchema>;

export const GenerateCustomRecipeParamsSchema = z.object({
  ingredients: z.array(z.string()).min(1),
  cuisine: z.string().optional(),
  additionalRequests: z.string().optional(),
});

export type GenerateCustomRecipeParams = z.infer<typeof GenerateCustomRecipeParamsSchema>;

export const RetrieveCustomRecipeParamsSchema = z.object({
  ingredients: z.array(z.string()).optional(),
  timeframe: z.object({
    after: z.string().datetime(),
    before: z.string().datetime(),
  }).optional(),
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type RetrieveCustomRecipeParams = z.infer<typeof RetrieveCustomRecipeParamsSchema>;

export const SaveCustomRecipeParamsSchema = z.object({
  recipe: IrmixyResponseSchema.shape.customRecipe,
  name: z.string().max(100).optional(), // User can override suggestedName
});

export type SaveCustomRecipeParams = z.infer<typeof SaveCustomRecipeParamsSchema>;

// ============================================================================
// User Context Schema
// ============================================================================

export const UserContextSchema = z.object({
  userId: z.string().uuid(),
  language: z.enum(['en', 'es']),
  measurementSystem: z.enum(['imperial', 'metric']),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  householdSize: z.number().int().positive().optional(),
  dietaryRestrictions: z.array(z.string()),
  ingredientDislikes: z.array(z.string()),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
});

export type UserContext = z.infer<typeof UserContextSchema>;

// ============================================================================
// Streaming Event Schemas
// ============================================================================

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    status: z.enum(['thinking', 'searching', 'generating']),
  }),
  z.object({
    type: z.literal('content'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('done'),
    response: IrmixyResponseSchema,
  }),
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage = 'Validation failed',
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(errorMessage, result.error.issues);
  }
  return result.data;
}

// ============================================================================
// Food Safety & Allergen Schemas
// ============================================================================

export interface AllergenEntry {
  category: string;
  ingredientCanonical: string;
  nameEn: string;
  nameEs: string;
}

export interface FoodSafetyRule {
  ingredientCanonical: string;
  category: string;
  minTempC: number;
  minTempF: number;
  minCookMin: number;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}
