/**
 * Custom Recipe Generation Tool
 *
 * Generates a personalized recipe based on user-provided ingredients,
 * preferences, and constraints. Validates safety and allergens.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  GeneratedRecipe,
  GeneratedRecipeSchema,
  SafetyFlags,
  UserContext,
} from '../irmixy-schemas.ts';
import { validateGenerateRecipeParams, GenerateRecipeParams } from './tool-validators.ts';
import { checkIngredientForAllergens, getAllergenWarning } from '../allergen-filter.ts';
import { checkRecipeSafety, buildSafetyReminders } from '../food-safety.ts';

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const generateCustomRecipeTool = {
  type: 'function' as const,
  function: {
    name: 'generate_custom_recipe',
    description:
      'Generate a custom recipe based on ingredients the user has available. ' +
      'Use this when the user wants to create a new recipe from scratch, ' +
      'tells you what ingredients they have, or asks what they can make. ' +
      'Before calling this tool, gather at least: ingredients and time available. ' +
      'Cuisine preference is helpful but optional.',
    parameters: {
      type: 'object',
      properties: {
        ingredients: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of ingredients the user has available (e.g., ["chicken", "rice", "broccoli"])',
        },
        cuisinePreference: {
          type: 'string',
          description:
            'Preferred cuisine style (e.g., "Italian", "Mexican", "Asian", "Mediterranean")',
        },
        targetTime: {
          type: 'integer',
          description: 'Target total time in minutes',
          minimum: 5,
          maximum: 480,
        },
        difficulty: {
          type: 'string',
          enum: ['easy', 'medium', 'hard'],
          description: 'Desired difficulty level',
        },
        additionalRequests: {
          type: 'string',
          description:
            'Additional requests or constraints (e.g., "make it spicy", "kid-friendly", "low carb")',
        },
      },
      required: ['ingredients'],
    },
  },
};

// ============================================================
// Recipe Generation
// ============================================================

export interface GenerateRecipeResult {
  recipe: GeneratedRecipe;
  safetyFlags?: SafetyFlags;
}

/**
 * Generate a custom recipe using AI.
 * Validates params, checks allergens, generates recipe, validates safety.
 */
export async function generateCustomRecipe(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
  openaiApiKey: string,
): Promise<GenerateRecipeResult> {
  // Validate and sanitize params
  const params = validateGenerateRecipeParams(rawParams);

  // Check ingredients against user's allergen restrictions
  const allergenCheck = await checkIngredientsForAllergens(
    supabase,
    params.ingredients,
    userContext.dietaryRestrictions,
    userContext.customAllergies,
    userContext.language,
  );

  if (!allergenCheck.safe) {
    return {
      recipe: createEmptyRecipe(userContext),
      safetyFlags: {
        allergenWarning: allergenCheck.warning,
        error: true,
      },
    };
  }

  // Build safety reminders for the prompt
  const safetyReminders = await buildSafetyReminders(
    supabase,
    params.ingredients,
    userContext.measurementSystem,
  );

  // Generate the recipe using AI
  const recipe = await callRecipeGenerationAI(
    openaiApiKey,
    params,
    userContext,
    safetyReminders,
  );

  // Enrich ingredients with images from database
  recipe.ingredients = await enrichIngredientsWithImages(
    recipe.ingredients,
    supabase,
  );

  // Validate the generated recipe against food safety rules
  const safetyCheck = await checkRecipeSafety(
    supabase,
    recipe.ingredients,
    recipe.totalTime,
    userContext.measurementSystem,
    userContext.language,
  );

  if (!safetyCheck.safe) {
    return {
      recipe,
      safetyFlags: {
        allergenWarning: safetyCheck.warnings.join(' '),
      },
    };
  }

  return { recipe };
}

// ============================================================
// AI Generation
// ============================================================

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * Check if an error is retryable (transient failure).
 */
function isRetryableError(status: number): boolean {
  // Retry on rate limits (429), server errors (5xx), or timeout-like errors
  return status === 429 || status >= 500;
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call OpenAI to generate the recipe with retry logic.
 */
async function callRecipeGenerationAI(
  apiKey: string,
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
): Promise<GeneratedRecipe> {
  const prompt = buildRecipePrompt(params, userContext, safetyReminders);
  const requestBody = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: getSystemPrompt(userContext) },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Recipe generation API error (attempt ${attempt + 1}):`, response.status, errorText);

        // Retry on transient errors
        if (isRetryableError(response.status) && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt] || 4000;
          console.log(`Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw new Error(`Failed to generate recipe: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in recipe generation response');
      }

      // Parse and validate the generated recipe
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error('Failed to parse recipe JSON:', content.slice(0, 500));
        throw new Error('Invalid recipe JSON from AI');
      }

      const result = GeneratedRecipeSchema.safeParse(parsed);
      if (!result.success) {
        console.error('Recipe validation failed:', result.error.issues);
        throw new Error('Generated recipe does not match schema');
      }

      return result.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on network errors (fetch failures)
      if (error instanceof TypeError && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt] || 4000;
        console.log(`Network error, retrying in ${delay}ms...`, error.message);
        await sleep(delay);
        continue;
      }

      // Non-retryable error or last attempt
      throw lastError;
    }
  }

  throw lastError || new Error('Failed to generate recipe after retries');
}

/**
 * Build the system prompt for recipe generation.
 */
function getSystemPrompt(userContext: UserContext): string {
  const lang = userContext.language === 'es' ? 'Spanish' : 'English';
  const units = userContext.measurementSystem === 'imperial'
    ? 'cups, tablespoons, teaspoons, ounces, pounds, °F'
    : 'ml, liters, grams, kg, °C';

  return `You are a professional recipe creator for a cooking app.
Generate recipes in ${lang} using ${userContext.measurementSystem} measurements (${units}).

CRITICAL RULES:
1. Use ONLY ${userContext.measurementSystem} units - never mix systems
2. All text (recipe name, instructions, ingredient names) must be in ${lang}
3. Include proper cooking temperatures for meat/poultry in the instructions
4. Steps should be clear and numbered
5. Quantities must be practical (no "0.333 cups" - use "1/3 cup" or nearest practical measure)

OUTPUT FORMAT:
You MUST output valid JSON matching this exact schema:
{
  "schemaVersion": "1.0",
  "suggestedName": "Recipe Name Here",
  "measurementSystem": "${userContext.measurementSystem}",
  "language": "${userContext.language}",
  "ingredients": [
    { "name": "ingredient name", "quantity": 1.5, "unit": "cups" }
  ],
  "steps": [
    { "order": 1, "instruction": "Step instruction here" }
  ],
  "totalTime": 30,
  "difficulty": "easy",
  "portions": 4,
  "tags": ["tag1", "tag2"]
}

Never include markdown, code fences, or explanations - ONLY the JSON object.`;
}

/**
 * Build the user prompt with recipe requirements.
 */
function buildRecipePrompt(
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
): string {
  const parts: string[] = [];

  // Core request
  parts.push(`Create a recipe using these ingredients: ${params.ingredients.join(', ')}`);

  // Time constraint
  if (params.targetTime) {
    parts.push(`Total time should be around ${params.targetTime} minutes or less.`);
  }

  // Cuisine preference
  if (params.cuisinePreference) {
    parts.push(`Style: ${params.cuisinePreference} cuisine.`);
  }

  // Difficulty
  if (params.difficulty) {
    parts.push(`Difficulty level: ${params.difficulty}.`);
  }

  // Additional requests
  if (params.additionalRequests) {
    parts.push(`Additional requirements: ${params.additionalRequests}`);
  }

  // User preferences
  const preferences: string[] = [];

  if (userContext.skillLevel) {
    preferences.push(`Skill level: ${userContext.skillLevel}`);
  }

  if (userContext.householdSize) {
    preferences.push(`Default portions: ${userContext.householdSize}`);
  }

  if (userContext.dietTypes.length > 0) {
    preferences.push(`Diet types: ${userContext.dietTypes.join(', ')}`);
  }

  if (userContext.ingredientDislikes.length > 0) {
    preferences.push(`Avoid these ingredients: ${userContext.ingredientDislikes.join(', ')}`);
  }

  if (userContext.kitchenEquipment.length > 0) {
    preferences.push(`Available equipment: ${userContext.kitchenEquipment.join(', ')}`);
  }

  if (preferences.length > 0) {
    parts.push('\nUser preferences:');
    parts.push(preferences.join('\n'));
  }

  // Safety reminders
  if (safetyReminders) {
    parts.push(`\n${safetyReminders}`);
  }

  return parts.join('\n');
}

// ============================================================
// Allergen Checking
// ============================================================

interface AllergenCheckResult {
  safe: boolean;
  warning?: string;
}

/**
 * Check all ingredients against user's allergen restrictions.
 */
async function checkIngredientsForAllergens(
  supabase: SupabaseClient,
  ingredients: string[],
  dietaryRestrictions: string[],
  customAllergies: string[],
  language: 'en' | 'es',
): Promise<AllergenCheckResult> {
  const allRestrictions = [...dietaryRestrictions, ...customAllergies];

  if (allRestrictions.length === 0) {
    return { safe: true };
  }

  for (const ingredient of ingredients) {
    const result = await checkIngredientForAllergens(
      supabase,
      ingredient,
      allRestrictions,
      language,
    );

    if (!result.safe) {
      const warning = await getAllergenWarning(
        supabase,
        result.allergen!,
        result.category!,
        language,
      );
      return { safe: false, warning };
    }
  }

  return { safe: true };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Enrich generated ingredients with image URLs from the ingredients table.
 * Matches ingredient names (case-insensitive) and adds imageUrl if found.
 */
async function enrichIngredientsWithImages(
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    imageUrl?: string;
  }>,
  supabase: SupabaseClient,
): Promise<
  Array<{
    name: string;
    quantity: number;
    unit: string;
    imageUrl?: string;
  }>
> {
  const enriched = await Promise.all(
    ingredients.map(async (ingredient) => {
      try {
        // Query ingredients table for matching name (case-insensitive)
        const { data, error } = await supabase
          .from('ingredients')
          .select('image_url')
          .ilike('name_en', `%${ingredient.name}%`)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn(`Failed to fetch image for ingredient "${ingredient.name}":`, error);
          return ingredient;
        }

        return {
          ...ingredient,
          imageUrl: data?.image_url || undefined,
        };
      } catch (err) {
        console.warn(`Error enriching ingredient "${ingredient.name}":`, err);
        return ingredient;
      }
    })
  );

  return enriched;
}

/**
 * Create an empty recipe for error cases.
 */
function createEmptyRecipe(userContext: UserContext): GeneratedRecipe {
  return {
    schemaVersion: '1.0',
    suggestedName: userContext.language === 'es' ? 'Receta no disponible' : 'Recipe unavailable',
    measurementSystem: userContext.measurementSystem,
    language: userContext.language,
    ingredients: [],
    steps: [],
    totalTime: 0,
    difficulty: 'easy',
    portions: 4,
    tags: [],
  };
}
