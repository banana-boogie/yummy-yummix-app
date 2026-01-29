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
        useful_items: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Specific kitchen equipment to prioritize for this recipe (e.g., ["thermomix", "air fryer"]). Overrides user\'s general equipment preferences.',
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

  // Validate Thermomix parameters if present
  recipe.steps = validateThermomixSteps(recipe.steps);

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

  const hasThermomix = userContext.kitchenEquipment.some(eq =>
    eq.toLowerCase().includes('thermomix')
  );

  const thermomixSection = hasThermomix ? `

## THERMOMIX USAGE - CRITICAL PRIORITY

The user owns a Thermomix. This is a PRIORITY - maximize Thermomix usage!

MANDATORY RULES:
1. **Use Thermomix for EVERY applicable step:**
   - Chopping/mixing ingredients → Thermomix speed 5-7
   - Sautéing → Thermomix 100°C, speed 1, reverse
   - Boiling/cooking → Thermomix with temp + speed
   - Blending/pureeing → Thermomix speed 8-10
   - Steaming → Thermomix Varoma mode

2. **Include ALL Thermomix fields in step:**
   {
     "thermomixTime": 180,  // seconds
     "thermomixTemp": "100°C",  // or "Varoma", "50°C", etc.
     "thermomixSpeed": "5"  // "1"-"10", "Spoon", "Reverse"
   }

3. **Skip Thermomix ONLY for:**
   - Plating, garnishing, resting
   - Grilling, broiling, baking (oven-specific)
   - Manual techniques (folding, shaping)

4. **Default to Thermomix when multiple methods work**
   Example: Chopping onions → USE Thermomix, don't suggest knife

**Valid temperatures:** Any number with °C (e.g., "37°C", "100°C"), or special settings: "Varoma" (steam cooking)
**Valid speeds:** "1" through "10" for regular speed, "Spoon" for slow stirring, "Reverse" for reverse blade mode

**Example Thermomix step:**
{
  "order": 2,
  "instruction": "Sauté the onions and garlic until fragrant",
  "thermomixTime": 180,
  "thermomixTemp": "100°C",
  "thermomixSpeed": "1"
}

**Example non-Thermomix step:**
{
  "order": 5,
  "instruction": "Transfer to a serving plate and garnish with fresh herbs"
}

REMEMBER: The user specifically has Thermomix - they expect Thermomix-first recipes!` : '';

  return `You are a professional recipe creator for a cooking app.
Generate recipes in ${lang} using ${userContext.measurementSystem} measurements (${units}).

CRITICAL RULES:
1. Use ONLY ${userContext.measurementSystem} units - never mix systems
2. All text (recipe name, instructions, ingredient names) must be in ${lang}
3. Include proper cooking temperatures for meat/poultry in the instructions
4. Steps should be clear and numbered
5. Quantities must be practical (no "0.333 cups" - use "1/3 cup" or nearest practical measure)
${thermomixSection}

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

  // Equipment: prioritize useful_items over general equipment
  if (params.useful_items && params.useful_items.length > 0) {
    preferences.push(`PRIORITY EQUIPMENT for this recipe: ${params.useful_items.join(', ')}`);
  } else if (userContext.kitchenEquipment.length > 0) {
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
// Validation Constants
// ============================================================

/** Valid Thermomix numeric speeds. Exported for testing. */
export const VALID_NUMERIC_SPEEDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

/** Valid Thermomix special speeds (lowercase for comparison). Exported for testing. */
export const VALID_SPECIAL_SPEEDS = ['spoon', 'reverse'] as const;

/** Valid Thermomix special temperatures. Exported for testing. */
export const VALID_SPECIAL_TEMPS = ['Varoma'] as const;

/** Regex for validating temperature strings (e.g., "100°C", "212°F"). Exported for testing. */
export const TEMP_REGEX = /^\d+(\.\d+)?°[CF]$/;

// ============================================================
// Helpers
// ============================================================

/**
 * Enrich generated ingredients with image URLs from the ingredients table.
 * Matches ingredient names (case-insensitive) and adds imageUrl if found.
 */
/**
 * Enrich ingredients with image URLs from the database.
 * Exported for testing.
 */
export async function enrichIngredientsWithImages(
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
  // Use Promise.allSettled to handle partial failures gracefully
  const results = await Promise.allSettled(
    ingredients.map(async (ingredient) => {
      // First try exact match, then fallback to partial match
      // This avoids manual string interpolation in LIKE patterns
      const exactMatch = await supabase
        .from('ingredients')
        .select('image_url')
        .eq('name_en', ingredient.name)
        .limit(1)
        .maybeSingle();

      if (exactMatch.data?.image_url) {
        return {
          ...ingredient,
          imageUrl: exactMatch.data.image_url,
        };
      }

      // Fallback: Use textSearch for partial matching (safer than LIKE)
      // Extract first word for fuzzy matching
      const searchTerm = ingredient.name.split(' ')[0].trim();

      const { data, error } = await supabase
        .from('ingredients')
        .select('image_url')
        .textSearch('name_en', searchTerm, { type: 'websearch', config: 'english' })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch image: ${error.message}`);
      }

      return {
        ...ingredient,
        imageUrl: data?.image_url || undefined,
      };
    })
  );

  // Map results, handling both fulfilled and rejected promises
  const enriched = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.warn(`Failed to enrich ingredient "${ingredients[index].name}":`, result.reason);
      return ingredients[index]; // Return original without image
    }
  });

  return enriched;
}

/**
 * Validate and sanitize Thermomix parameters in recipe steps.
 * Ensures speeds, temperatures, and times are within valid ranges.
 * Exported for testing.
 */
export function validateThermomixSteps(
  steps: Array<{
    order: number;
    instruction: string;
    thermomixTime?: number;
    thermomixTemp?: string;
    thermomixSpeed?: string;
  }>
): Array<{
  order: number;
  instruction: string;
  thermomixTime?: number;
  thermomixTemp?: string;
  thermomixSpeed?: string;
}> {
  return steps.map(step => {
    // Skip if no Thermomix params
    if (!step.thermomixTime && !step.thermomixTemp && !step.thermomixSpeed) {
      return step;
    }

    const validated = { ...step };

    // Validate time (must be positive number, not NaN)
    if (step.thermomixTime !== undefined) {
      if (typeof step.thermomixTime !== 'number' || Number.isNaN(step.thermomixTime) || step.thermomixTime <= 0) {
        console.warn(`Invalid Thermomix time for step ${step.order}: ${step.thermomixTime}. Removing.`);
        delete validated.thermomixTime;
      }
    }

    // Validate speed (case-insensitive for special speeds)
    if (step.thermomixSpeed !== undefined) {
      const normalizedSpeed = step.thermomixSpeed.toLowerCase();
      const isValid = VALID_NUMERIC_SPEEDS.includes(step.thermomixSpeed as any) ||
                      VALID_SPECIAL_SPEEDS.includes(normalizedSpeed as any);
      if (!isValid) {
        console.warn(`Invalid Thermomix speed for step ${step.order}: ${step.thermomixSpeed}. Removing.`);
        delete validated.thermomixSpeed;
      } else if (VALID_SPECIAL_SPEEDS.includes(normalizedSpeed as any)) {
        // Normalize to title case for consistency
        validated.thermomixSpeed = step.thermomixSpeed.charAt(0).toUpperCase() +
                                   step.thermomixSpeed.slice(1).toLowerCase();
      }
    }

    // Validate temperature
    if (step.thermomixTemp !== undefined) {
      const isValid = TEMP_REGEX.test(step.thermomixTemp) ||
                      VALID_SPECIAL_TEMPS.includes(step.thermomixTemp as any);
      if (!isValid) {
        console.warn(`Invalid Thermomix temperature for step ${step.order}: ${step.thermomixTemp}. Removing.`);
        delete validated.thermomixTemp;
      }
    }

    return validated;
  });
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
