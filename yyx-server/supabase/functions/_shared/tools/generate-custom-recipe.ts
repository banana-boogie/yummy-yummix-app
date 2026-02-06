/**
 * Custom Recipe Generation Tool
 *
 * Generates a personalized recipe based on user-provided ingredients,
 * preferences, and constraints. Validates safety and allergens.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  GeneratedRecipe,
  GeneratedRecipeSchema,
  SafetyFlags,
  UserContext,
} from "../irmixy-schemas.ts";
import {
  GenerateRecipeParams,
  validateGenerateRecipeParams,
} from "./tool-validators.ts";
import {
  checkIngredientForAllergens,
  getAllergenWarning,
} from "../allergen-filter.ts";
import { buildSafetyReminders, checkRecipeSafety } from "../food-safety.ts";

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const generateCustomRecipeTool = {
  type: "function" as const,
  function: {
    name: "generate_custom_recipe",
    description:
      "Generate a custom recipe based on ingredients the user has available. " +
      "Use this when the user wants to create a new recipe from scratch, " +
      "tells you what ingredients they have, or asks what they can make. " +
      "Before calling this tool, gather at least: ingredients and time available. " +
      "Cuisine preference is helpful but optional.",
    parameters: {
      type: "object",
      properties: {
        ingredients: {
          type: "array",
          items: { type: "string" },
          description:
            'List of ingredients the user has available (e.g., ["chicken", "rice", "broccoli"])',
        },
        cuisinePreference: {
          type: "string",
          description:
            'Preferred cuisine style (e.g., "Italian", "Mexican", "Asian", "Mediterranean")',
        },
        targetTime: {
          type: "integer",
          description: "Target total time in minutes",
          minimum: 5,
          maximum: 480,
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard"],
          description: "Desired difficulty level",
        },
        additionalRequests: {
          type: "string",
          description:
            'Additional requests or constraints (e.g., "make it spicy", "kid-friendly", "low carb")',
        },
        useful_items: {
          type: "array",
          items: { type: "string" },
          description:
            'Specific kitchen equipment to prioritize for this recipe (e.g., ["thermomix", "air fryer"]). Overrides user\'s general equipment preferences.',
        },
      },
      required: ["ingredients"],
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
    userContext.language,
  );

  // Generate the recipe using AI
  const recipe = await callRecipeGenerationAI(
    openaiApiKey,
    params,
    userContext,
    safetyReminders,
  );

  // Validate Thermomix parameters if present
  recipe.steps = validateThermomixSteps(recipe.steps);

  // Check Thermomix usage if user has Thermomix
  const hasThermomix = userContext.kitchenEquipment.some((eq) =>
    eq.toLowerCase().includes("thermomix")
  );
  validateThermomixUsage(recipe, hasThermomix);

  // Run post-recipe enrichment and validation in parallel
  const [enrichedIngredients, usefulItems, safetyCheck] = await Promise.all([
    enrichIngredientsWithImages(recipe.ingredients, supabase, userContext.language),
    getRelevantUsefulItems(supabase, recipe, userContext.language, hasThermomix),
    checkRecipeSafety(
      supabase,
      recipe.ingredients,
      recipe.totalTime,
      userContext.measurementSystem,
      userContext.language,
    ),
  ]);

  recipe.ingredients = enrichedIngredients;
  recipe.usefulItems = usefulItems;

  if (!safetyCheck.safe) {
    return {
      recipe,
      safetyFlags: {
        allergenWarning: safetyCheck.warnings.join(" "),
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
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: getSystemPrompt(userContext) },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: requestBody,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Recipe generation API error (attempt ${attempt + 1}):`,
          response.status,
          errorText,
        );

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
        throw new Error("No content in recipe generation response");
      }

      // Parse and validate the generated recipe
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("Failed to parse recipe JSON:", content.slice(0, 500));
        throw new Error("Invalid recipe JSON from AI");
      }

      const result = GeneratedRecipeSchema.safeParse(parsed);
      if (!result.success) {
        console.error("Recipe validation failed:", result.error.issues);
        throw new Error("Generated recipe does not match schema");
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

  throw lastError || new Error("Failed to generate recipe after retries");
}

/**
 * Build the system prompt for recipe generation.
 */
function getSystemPrompt(userContext: UserContext): string {
  const lang = userContext.language === "es" ? "Spanish" : "English";
  const units = userContext.measurementSystem === "imperial"
    ? "cups, tablespoons, teaspoons, ounces, pounds, °F"
    : "ml, liters, grams, kg, °C";

  const hasThermomix = userContext.kitchenEquipment.some((eq) =>
    eq.toLowerCase().includes("thermomix")
  );

  console.log("[Recipe Generation] Equipment check:", {
    kitchenEquipment: userContext.kitchenEquipment,
    hasThermomix,
  });

  if (!hasThermomix && userContext.kitchenEquipment.length > 0) {
    console.warn(
      "[Recipe Generation] User has equipment but no Thermomix:",
      userContext.kitchenEquipment,
    );
  }

  const thermomixSection = hasThermomix
    ? `

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
  "ingredientsUsed": ["onion", "garlic"],
  "thermomixTime": 180,
  "thermomixTemp": "100°C",
  "thermomixSpeed": "1"
}

**Example non-Thermomix step:**
{
  "order": 5,
  "instruction": "Transfer to a serving plate and garnish with fresh herbs",
  "ingredientsUsed": ["fresh herbs"]
}

REMEMBER: The user specifically has Thermomix - they expect Thermomix-first recipes!`
    : "";

  return `You are a professional recipe creator for a cooking app.
Generate recipes in ${lang} using ${userContext.measurementSystem} measurements (${units}).

CRITICAL RULES:
1. Use ONLY ${userContext.measurementSystem} units - never mix systems
2. All text (recipe name, instructions, ingredient names) must be in ${lang}
3. Include proper cooking temperatures for meat/poultry in the instructions
4. Steps should be clear and numbered
5. Quantities must be practical (no "0.333 cups" - use "1/3 cup" or nearest practical measure)

RECIPE NAMING:
- Give the recipe a natural, appetizing name that describes what it IS, not what it ISN'T
- BAD: "Sugar-Free Chicken Ramen", "Low-Carb Mediterranean Bowl", "Gluten-Free Asian Stir-Fry"
- GOOD: "Chicken Ramen", "Mediterranean Grain Bowl", "Vegetable Stir-Fry"
- Never include dietary restrictions in the recipe name unless the dish is famous for it (e.g., "Keto Fat Bombs")
- The name should make someone hungry, not remind them of restrictions

PREFERENCE BALANCE:
- User preferences are hints to GUIDE your creativity, not rigid constraints
- If user enjoys Mediterranean cuisine, you CAN make non-Mediterranean dishes - match cuisine to ingredients
- Focus on making delicious food FIRST, then accommodate preferences where natural
- Hard requirements (allergens, ingredients to avoid) MUST be followed
- Soft preferences (cuisine style, diet types) are suggestions only
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
    { "order": 1, "instruction": "Step instruction here", "ingredientsUsed": ["ingredient name"] }
  ],
  "totalTime": 30,
  "difficulty": "easy",
  "portions": 4,
  "tags": ["tag1", "tag2"]
}

IMPORTANT: Each step MUST include "ingredientsUsed" - an array of ingredient names (matching exactly from the ingredients list) that are used in that step. This is used to display ingredient images in the cooking guide.

Never include markdown, code fences, or explanations - ONLY the JSON object.`;
}

/**
 * Build the user prompt with recipe requirements.
 *
 * Preference hierarchy:
 * 1. HARD REQUIREMENTS: Must be followed (allergies, ingredient dislikes)
 * 2. EXPLICIT REQUESTS: Cuisine/style from current request overrides defaults
 * 3. MEDIUM CONSTRAINTS: Diet types affect ingredient selection (vegan, keto, etc.)
 * 4. SOFT PREFERENCES: Cuisine preferences are inspirational only (not every recipe needs to match)
 */
function buildRecipePrompt(
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
): string {
  const parts: string[] = [];

  // Core request
  parts.push(
    `Create a recipe using these ingredients: ${params.ingredients.join(", ")}`,
  );

  // Time constraint
  if (params.targetTime) {
    parts.push(
      `Total time should be around ${params.targetTime} minutes or less.`,
    );
  }

  // Cuisine preference - explicit request takes priority
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

  // === HARD REQUIREMENTS (must be followed) ===
  const requirements: string[] = [];

  if (userContext.ingredientDislikes.length > 0) {
    requirements.push(
      `MUST AVOID these ingredients: ${
        userContext.ingredientDislikes.join(", ")
      }`,
    );
  }

  if (requirements.length > 0) {
    parts.push("\n⚠️ HARD REQUIREMENTS (must follow):");
    parts.push(requirements.join("\n"));
  }

  // === MEDIUM CONSTRAINTS (diet types - affect ingredient selection) ===
  // Diet types like vegan, keto, paleo affect WHAT ingredients can be used
  // These are more than preferences but less than hard requirements
  if (userContext.dietTypes.length > 0) {
    const validDietTypes = userContext.dietTypes.filter((d) =>
      d !== "none" && d !== "other"
    );
    if (validDietTypes.length > 0) {
      parts.push("\n🥗 DIETARY APPROACH (follow for ingredient selection):");
      parts.push(`User follows: ${validDietTypes.join(", ")}`);
      parts.push(
        "Select ingredients compatible with these dietary approaches.",
      );
    }
  }

  // === SOFT PREFERENCES (consider but don't force) ===
  const preferences: string[] = [];

  if (userContext.skillLevel) {
    preferences.push(`Skill level: ${userContext.skillLevel}`);
  }

  if (userContext.householdSize) {
    preferences.push(`Default portions: ${userContext.householdSize}`);
  }

  // Cuisine preferences are SOFT/INSPIRATIONAL - they should NOT dominate every recipe
  // Only mention them if no explicit cuisine was requested, and frame them as hints
  if (
    userContext.cuisinePreferences &&
    userContext.cuisinePreferences.length > 0 && !params.cuisinePreference
  ) {
    const validCuisines = userContext.cuisinePreferences.filter((c) =>
      c && c.trim()
    );
    if (validCuisines.length > 0) {
      // Frame as very soft inspiration - the AI should feel free to ignore
      preferences.push(
        `Cuisine inspiration (OPTIONAL, vary styles): User enjoys ${
          validCuisines.join(", ")
        } cooking. ` +
          `Feel free to explore other cuisines that suit the ingredients - variety is welcome!`,
      );
    }
  }

  // Equipment: prioritize useful_items over general equipment
  if (params.useful_items && params.useful_items.length > 0) {
    preferences.push(
      `PRIORITY EQUIPMENT for this recipe: ${params.useful_items.join(", ")}`,
    );
  } else if (userContext.kitchenEquipment.length > 0) {
    preferences.push(
      `Available equipment: ${userContext.kitchenEquipment.join(", ")}`,
    );
  }

  if (preferences.length > 0) {
    parts.push("\n📝 Soft preferences (consider but be creative):");
    parts.push(preferences.join("\n"));
  }

  // Safety reminders
  if (safetyReminders) {
    parts.push(`\n${safetyReminders}`);
  }

  return parts.join("\n");
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
 * Uses parallel processing for performance (was sequential N+1 query).
 */
async function checkIngredientsForAllergens(
  supabase: SupabaseClient,
  ingredients: string[],
  dietaryRestrictions: string[],
  customAllergies: string[],
  language: "en" | "es",
): Promise<AllergenCheckResult> {
  const allRestrictions = [...dietaryRestrictions, ...customAllergies];

  if (allRestrictions.length === 0) {
    return { safe: true };
  }

  // Check all ingredients in parallel for performance
  const results = await Promise.all(
    ingredients.map((ingredient) =>
      checkIngredientForAllergens(
        supabase,
        ingredient,
        allRestrictions,
        language,
      )
    ),
  );

  // Find the first unsafe ingredient
  const unsafeResult = results.find((result) => !result.safe);

  if (unsafeResult) {
    const warning = await getAllergenWarning(
      supabase,
      unsafeResult.allergen!,
      unsafeResult.category!,
      language,
    );
    return { safe: false, warning };
  }

  return { safe: true };
}

// ============================================================
// Validation Constants
// ============================================================

/** Valid Thermomix numeric speeds. Exported for testing. */
export const VALID_NUMERIC_SPEEDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
] as const;

/** Valid Thermomix special speeds (lowercase for comparison). Exported for testing. */
export const VALID_SPECIAL_SPEEDS = ["spoon", "reverse"] as const;

/** Valid Thermomix special temperatures. Exported for testing. */
export const VALID_SPECIAL_TEMPS = ["Varoma"] as const;

/** Regex for validating temperature strings (e.g., "100°C", "212°F"). Exported for testing. */
export const TEMP_REGEX = /^\d+(\.\d+)?°[CF]$/;

// ============================================================
// Helpers
// ============================================================

/**
 * Batch result type from batch_find_ingredients RPC
 */
type BatchIngredientMatch = {
  input_name: string;
  matched_name: string | null;
  matched_name_es: string | null;
  image_url: string | null;
  match_score: number | null;
};

/**
 * Enrich ingredients with image URLs from the database.
 * Uses batch lookup for performance (single query instead of N+1).
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
  language: "en" | "es" = "en",
): Promise<
  Array<{
    name: string;
    quantity: number;
    unit: string;
    imageUrl?: string;
  }>
> {
  if (ingredients.length === 0) {
    return ingredients;
  }

  // Single batch query for all ingredients
  const ingredientNames = ingredients.map((i) => i.name);
  const { data: matches, error } = await supabase.rpc("batch_find_ingredients", {
    ingredient_names: ingredientNames,
    preferred_lang: language,
  });

  if (error) {
    console.warn("[Batch lookup] RPC error:", error.message);
    // Return original ingredients without images on error
    return ingredients;
  }

  // Create a lookup map from input_name to match result
  const matchMap = new Map<string, BatchIngredientMatch>();
  for (const match of (matches as BatchIngredientMatch[]) || []) {
    if (match.input_name) {
      matchMap.set(match.input_name.toLowerCase(), match);
    }
  }

  // Enrich ingredients with matched image URLs
  const enriched = ingredients.map((ingredient) => {
    const match = matchMap.get(ingredient.name.toLowerCase());

    if (match?.image_url) {
      const matchType = match.match_score === 1.0 ? "exact" : "fuzzy";
      const scoreStr = match.match_score?.toFixed(2) || "N/A";
      console.log(
        `✓ ${matchType} match: "${ingredient.name}" → "${match.matched_name}" (score: ${scoreStr}) → ${match.image_url}`,
      );
      return { ...ingredient, imageUrl: match.image_url };
    }

    console.log(`✗ No match for "${ingredient.name}"`);
    return { ...ingredient, imageUrl: undefined };
  });

  return enriched;
}

/**
 * Get relevant useful items for a recipe based on recipe context.
 * Matches items based on cooking techniques and equipment used.
 */
type UsefulItemRow = {
  id: string;
  name_en: string;
  name_es: string;
  image_url: string | null;
};

const USEFUL_ITEMS_CACHE_TTL_MS = 5 * 60 * 1000;
let usefulItemsCache: UsefulItemRow[] | null = null;
let usefulItemsCacheTimestamp = 0;

async function getRelevantUsefulItems(
  supabase: SupabaseClient,
  recipe: GeneratedRecipe,
  language: "en" | "es",
  hasThermomix: boolean,
): Promise<Array<{ name: string; imageUrl?: string; notes?: string }>> {
  try {
    // Query useful items from database (cached)
    const nameField = language === "es" ? "name_es" : "name_en";
    let allItems = usefulItemsCache;
    const cacheAge = Date.now() - usefulItemsCacheTimestamp;

    if (!allItems || cacheAge > USEFUL_ITEMS_CACHE_TTL_MS) {
      const { data, error } = await supabase
        .from("useful_items")
        .select(`id, name_en, name_es, image_url`)
        .limit(50);

      if (error || !data || data.length === 0) {
        console.warn(
          "[Useful Items] Failed to fetch or no items available:",
          error?.message,
        );
        return [];
      }

      allItems = data as UsefulItemRow[];
      usefulItemsCache = allItems;
      usefulItemsCacheTimestamp = Date.now();
    }

    if (!allItems) {
      return [];
    }

    // Define keywords for matching items to recipe context
    const recipeText = (
      recipe.suggestedName +
      " " +
      recipe.steps.map((s) => s.instruction).join(" ")
    ).toLowerCase();

    // Keywords that suggest specific useful items
    const itemKeywords: Record<string, string[]> = {
      "spatula": ["stir", "flip", "fold", "mix", "mezclar", "revolver"],
      "whisk": ["whisk", "beat", "whip", "batir"],
      "tongs": ["flip", "turn", "grill", "voltear", "asar"],
      "thermometer": [
        "temperature",
        "internal",
        "meat",
        "temperatura",
        "carne",
      ],
      "timer": ["minutes", "timer", "cook for", "minutos", "cocinar por"],
      "cutting board": ["chop", "dice", "slice", "cut", "picar", "cortar"],
      "knife": ["chop", "dice", "slice", "cut", "mince", "picar", "cortar"],
      "bowl": ["mix", "combine", "toss", "mezclar", "combinar"],
      "pan": ["sauté", "fry", "cook", "saltear", "freír"],
      "pot": ["boil", "simmer", "stew", "hervir", "cocinar a fuego lento"],
      "baking sheet": ["bake", "roast", "oven", "hornear", "asar"],
      "varoma": ["steam", "varoma", "vapor"],
      "butterfly": ["butterfly", "mariposa", "whip", "cream"],
    };

    // Score each item based on keyword matches
    const scoredItems = allItems.map((item) => {
      const itemName = (item.name_en + " " + item.name_es).toLowerCase();
      let score = 0;

      // Check if item name keywords appear in recipe
      for (const [itemType, keywords] of Object.entries(itemKeywords)) {
        if (itemName.includes(itemType.toLowerCase())) {
          for (const keyword of keywords) {
            if (recipeText.includes(keyword)) {
              score += 1;
            }
          }
        }
      }

      // Boost Thermomix accessories if user has Thermomix
      if (
        hasThermomix &&
        (itemName.includes("varoma") || itemName.includes("butterfly") ||
          itemName.includes("mariposa"))
      ) {
        const usesVaroma = recipeText.includes("steam") ||
          recipeText.includes("varoma") || recipeText.includes("vapor");
        const usesButterfly = recipeText.includes("whip") ||
          recipeText.includes("cream") || recipeText.includes("batir");
        if (usesVaroma || usesButterfly) {
          score += 3;
        }
      }

      return { item, score };
    });

    // Sort by score and take top 3-5 items with score > 0
    const relevantItems = scoredItems
      .filter((si) => si.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((si) => ({
        name: si.item[nameField as keyof typeof si.item] as string,
        imageUrl: si.item.image_url || undefined,
      }));

    console.log(
      "[Useful Items] Found relevant items:",
      relevantItems.map((i) => i.name),
    );
    return relevantItems;
  } catch (error) {
    console.error("[Useful Items] Error fetching useful items:", error);
    return [];
  }
}

/**
 * Validate that Thermomix-enabled recipes include proper parameters
 */
function validateThermomixUsage(
  recipe: GeneratedRecipe,
  hasThermomix: boolean,
): void {
  if (!hasThermomix) return;

  const thermomixSteps = recipe.steps.filter(
    (step) => step.thermomixTime || step.thermomixTemp || step.thermomixSpeed,
  );

  const totalSteps = recipe.steps.length;
  const thermomixPercentage = (thermomixSteps.length / totalSteps) * 100;

  console.log("[Thermomix Validation]", {
    totalSteps,
    thermomixSteps: thermomixSteps.length,
    percentage: thermomixPercentage.toFixed(1) + "%",
  });

  if (thermomixSteps.length === 0) {
    console.warn(
      "[Thermomix Validation] WARNING: User has Thermomix but NO steps use it!",
      {
        recipeName: recipe.suggestedName,
        recommendation: "AI may not be following system prompt",
      },
    );
  } else if (thermomixPercentage < 30) {
    console.warn("[Thermomix Validation] Low Thermomix usage:", {
      recipeName: recipe.suggestedName,
      percentage: thermomixPercentage.toFixed(1) + "%",
    });
  }
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
  }>,
): Array<{
  order: number;
  instruction: string;
  thermomixTime?: number;
  thermomixTemp?: string;
  thermomixSpeed?: string;
}> {
  return steps.map((step) => {
    // Skip if no Thermomix params
    if (!step.thermomixTime && !step.thermomixTemp && !step.thermomixSpeed) {
      return step;
    }

    const validated = { ...step };

    // Validate time (must be positive number, not NaN)
    if (step.thermomixTime !== undefined) {
      if (
        typeof step.thermomixTime !== "number" ||
        Number.isNaN(step.thermomixTime) || step.thermomixTime <= 0
      ) {
        console.warn(
          `Invalid Thermomix time for step ${step.order}: ${step.thermomixTime}. Removing.`,
        );
        delete validated.thermomixTime;
      }
    }

    // Validate speed (case-insensitive for special speeds)
    if (step.thermomixSpeed !== undefined) {
      const normalizedSpeed = step.thermomixSpeed.toLowerCase();
      const isValid =
        VALID_NUMERIC_SPEEDS.includes(step.thermomixSpeed as any) ||
        VALID_SPECIAL_SPEEDS.includes(normalizedSpeed as any);
      if (!isValid) {
        console.warn(
          `Invalid Thermomix speed for step ${step.order}: ${step.thermomixSpeed}. Removing.`,
        );
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
        console.warn(
          `Invalid Thermomix temperature for step ${step.order}: ${step.thermomixTemp}. Removing.`,
        );
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
    schemaVersion: "1.0",
    suggestedName: userContext.language === "es"
      ? "Receta no disponible"
      : "Recipe unavailable",
    measurementSystem: userContext.measurementSystem,
    language: userContext.language,
    ingredients: [],
    steps: [],
    totalTime: 0,
    difficulty: "easy",
    portions: 4,
    tags: [],
  };
}
