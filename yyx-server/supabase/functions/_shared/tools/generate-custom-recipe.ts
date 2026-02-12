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
import { chat } from "../ai-gateway/index.ts";
import { hasThermomix } from "../equipment-utils.ts";

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
      "Before calling this tool, gather at least: ingredients. " +
      "Time and cuisine preference are helpful but optional.",
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
            'Additional kitchen equipment for this recipe (e.g., ["thermomix", "air fryer"]). Supplements the user\'s general equipment preferences.',
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
 * Callback for two-phase SSE: called with partial recipe before enrichment.
 * This allows the UI to display the recipe immediately while enrichment happens.
 */
export type PartialRecipeCallback = (partialRecipe: GeneratedRecipe) => void;

/**
 * Generate a custom recipe using AI.
 * Validates params, checks allergens, generates recipe, validates safety.
 *
 * @param onPartialRecipe - Optional callback for two-phase SSE. If provided,
 *   called with the recipe immediately after LLM generation (before enrichment).
 *   This enables perceived latency reduction by showing the recipe card early.
 */
export async function generateCustomRecipe(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
  _openaiApiKey?: string,
  onPartialRecipe?: PartialRecipeCallback,
): Promise<GenerateRecipeResult> {
  // Timing instrumentation for performance monitoring
  const timings: Record<string, number> = {};
  const totalStart = performance.now();
  let phaseStart = totalStart;

  // Validate and sanitize params
  const params = validateGenerateRecipeParams(rawParams);

  // Run allergen check and safety reminders in parallel
  const [allergenCheck, safetyReminders] = await Promise.all([
    checkIngredientsForAllergens(
      supabase,
      params.ingredients,
      userContext.dietaryRestrictions,
      userContext.customAllergies,
      userContext.language,
    ),
    buildSafetyReminders(
      supabase,
      params.ingredients,
      userContext.measurementSystem,
      userContext.language,
    ),
  ]);
  timings.allergen_and_safety_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  if (!allergenCheck.safe) {
    timings.total_ms = Math.round(performance.now() - totalStart);
    console.log(
      "[GenerateRecipe Timings] Early exit (allergen):",
      JSON.stringify(timings),
    );
    return {
      recipe: createEmptyRecipe(userContext),
      safetyFlags: {
        allergenWarning: allergenCheck.warning,
        error: true,
      },
    };
  }

  // Generate the recipe using AI
  const recipe = await callRecipeGenerationAI(
    params,
    userContext,
    safetyReminders,
  );
  timings.recipe_llm_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Validate Thermomix parameters if present
  recipe.steps = validateThermomixSteps(recipe.steps);

  // Check Thermomix usage if user has Thermomix
  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);
  validateThermomixUsage(recipe, isThermomixUser);
  timings.thermomix_validation_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Two-phase SSE: emit partial recipe before enrichment for perceived latency reduction
  // The frontend can start rendering the recipe card immediately
  if (onPartialRecipe) {
    onPartialRecipe(recipe);
    console.log("[GenerateRecipe] Partial recipe emitted, starting enrichment");
  }

  // Run post-recipe enrichment and validation in parallel
  const [enrichedIngredients, usefulItems, safetyCheck] = await Promise.all([
    enrichIngredientsWithImages(
      recipe.ingredients,
      supabase,
      userContext.language,
    ),
    getRelevantUsefulItems(
      supabase,
      recipe,
      userContext.language,
      isThermomixUser,
    ),
    checkRecipeSafety(
      supabase,
      recipe.ingredients,
      recipe.totalTime,
      userContext.measurementSystem,
      userContext.language,
    ),
  ]);
  timings.enrichment_ms = Math.round(performance.now() - phaseStart);

  recipe.ingredients = enrichedIngredients;
  recipe.usefulItems = usefulItems;

  timings.total_ms = Math.round(performance.now() - totalStart);
  console.log("[GenerateRecipe Timings]", JSON.stringify(timings));

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
// AI Generation (via AI Gateway)
// ============================================================

/**
 * Build a JSON schema for structured output based on whether user has Thermomix.
 * Non-Thermomix users get a simpler schema (fewer output tokens).
 * Exported for testing.
 */
export function buildRecipeJsonSchema(
  hasThermomix: boolean,
): Record<string, unknown> {
  const stepProperties: Record<string, unknown> = {
    order: { type: "integer" },
    instruction: { type: "string" },
    ingredientsUsed: { type: "array", items: { type: "string" } },
  };
  const stepRequired = ["order", "instruction", "ingredientsUsed"];

  if (hasThermomix) {
    stepProperties.thermomixTime = { type: ["integer", "null"] };
    stepProperties.thermomixTemp = { type: ["string", "null"] };
    stepProperties.thermomixSpeed = { type: ["string", "null"] };
    stepRequired.push("thermomixTime", "thermomixTemp", "thermomixSpeed");
  }

  return {
    type: "object",
    properties: {
      schemaVersion: { type: "string", enum: ["1.0"] },
      suggestedName: { type: "string" },
      measurementSystem: { type: "string", enum: ["imperial", "metric"] },
      language: { type: "string", enum: ["en", "es"] },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
          },
          required: ["name", "quantity", "unit"],
          additionalProperties: false,
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: stepProperties,
          required: stepRequired,
          additionalProperties: false,
        },
      },
      totalTime: { type: "integer" },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      portions: { type: "integer" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: [
      "schemaVersion",
      "suggestedName",
      "measurementSystem",
      "language",
      "ingredients",
      "steps",
      "totalTime",
      "difficulty",
      "portions",
      "tags",
    ],
    additionalProperties: false,
  };
}

/**
 * Call AI Gateway to generate the recipe.
 * Uses the 'parsing' usage type for structured JSON output.
 * Uses one local retry if parsing/validation fails.
 */
async function callRecipeGenerationAI(
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
): Promise<GeneratedRecipe> {
  const prompt = buildRecipePrompt(params, userContext, safetyReminders);
  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);
  const recipeSchema = buildRecipeJsonSchema(isThermomixUser);
  const systemPrompt = getSystemPrompt(userContext);

  const strictRetryPromptSuffix =
    "\n\nCRITICAL: Return ONLY raw JSON. No markdown, no code fences, no explanation text.";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const isRetry = attempt === 1;
    const response = await chat({
      usageType: "parsing",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: isRetry ? prompt + strictRetryPromptSuffix : prompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 2048,
      responseFormat: {
        type: "json_schema",
        schema: recipeSchema,
      },
    });

    try {
      return parseAndValidateGeneratedRecipe(response.content);
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error("Recipe parsing failed");
      if (!isRetry) {
        console.warn(
          "[Recipe Generation] First parse/validation attempt failed, retrying once",
          {
            error: lastError.message,
          },
        );
      }
    }
  }

  throw lastError || new Error("Generated recipe does not match schema");
}

function parseAndValidateGeneratedRecipe(content: string): GeneratedRecipe {
  // Strip code fences if model wraps response in ```json ... ```
  let jsonContent = content.trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch {
    console.error(
      "Failed to parse recipe JSON:",
      jsonContent.slice(0, 500),
    );
    throw new Error("Invalid recipe JSON from AI");
  }

  const result = GeneratedRecipeSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Recipe validation failed:", result.error.issues);
    throw new Error("Generated recipe does not match schema");
  }

  // Force empty tags — AI-generated tags are never displayed in UI
  result.data.tags = [];

  return result.data;
}

/**
 * Build the system prompt for recipe generation.
 */
function getSystemPrompt(userContext: UserContext): string {
  const lang = userContext.language === "es" ? "Mexican Spanish" : "English";
  const units = userContext.measurementSystem === "imperial"
    ? "cups, tablespoons, teaspoons, ounces, pounds, °F"
    : "ml, liters, grams, kg, °C";

  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);

  console.log("[Recipe Generation] Equipment check:", {
    kitchenEquipment: userContext.kitchenEquipment,
    hasThermomix: isThermomixUser,
  });

  if (!isThermomixUser && userContext.kitchenEquipment.length > 0) {
    console.warn(
      "[Recipe Generation] User has equipment but no Thermomix:",
      userContext.kitchenEquipment,
    );
  }

  const thermomixSection = isThermomixUser
    ? `

## THERMOMIX USAGE (User owns Thermomix - maximize usage!)

For each applicable step, include: thermomixTime (seconds), thermomixTemp ("37°C"-"100°C" or "Varoma"), thermomixSpeed ("1"-"10", "Spoon", or "Reverse")

Use Thermomix for: chopping (speed 5-7), sautéing (100°C, speed 1, reverse), cooking/boiling (temp+speed), blending (speed 8-10), steaming (Varoma)
Skip Thermomix for: plating, garnishing, oven/grill tasks, manual shaping

Example step with Thermomix: {"order": 2, "instruction": "Sauté onions", "ingredientsUsed": ["onion"], "thermomixTime": 180, "thermomixTemp": "100°C", "thermomixSpeed": "1"}`
    : "";

  return `Professional recipe creator. Output in ${lang}, ${userContext.measurementSystem} units (${units}).

RULES: Use practical quantities (1/3 cup not 0.333). Include meat cooking temps. Name recipes naturally without dietary labels (GOOD: "Chicken Ramen", BAD: "Sugar-Free Ramen"). Preferences guide creativity; allergens/dislikes are strict.
${thermomixSection}

OUTPUT: Return ONLY valid JSON (no markdown, no code fences). Each step needs "ingredientsUsed" matching ingredient names exactly. Use this structure:
{"schemaVersion":"1.0","suggestedName":"...","measurementSystem":"${userContext.measurementSystem}","language":"${userContext.language}","ingredients":[{"name":"...","quantity":1,"unit":"..."}],"steps":[{"order":1,"instruction":"...","ingredientsUsed":["..."]}],"totalTime":30,"difficulty":"easy","portions":4,"tags":[]}`;
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
  systemUnavailable?: boolean;
}

/**
 * Check all ingredients against user's allergen restrictions.
 * Uses parallel processing for performance.
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
    if (unsafeResult.systemUnavailable) {
      return {
        safe: false,
        systemUnavailable: true,
        warning: language === "es"
          ? "No pude verificar alergias en este momento. Para tu seguridad, no puedo generar esta receta ahora."
          : "I couldn't verify allergens right now. For your safety, I can't generate this recipe at the moment.",
      };
    }

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
  const { data: matches, error } = await supabase.rpc(
    "batch_find_ingredients",
    {
      ingredient_names: ingredientNames,
      preferred_lang: language,
    },
  );

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
      return { ...ingredient, imageUrl: match.image_url };
    }

    return { ...ingredient, imageUrl: undefined };
  });

  // Log summary instead of per-ingredient details
  const matched = enriched.filter((i) => i.imageUrl).length;
  console.log(
    `[Batch lookup] ${matched}/${ingredients.length} ingredients matched with images`,
  );

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
    thermomixTime?: number | null;
    thermomixTemp?: string | null;
    thermomixSpeed?: string | null;
  }>,
): Array<{
  order: number;
  instruction: string;
  thermomixTime?: number | null;
  thermomixTemp?: string | null;
  thermomixSpeed?: string | null;
}> {
  return steps.map((step) => {
    // Skip if no Thermomix params (check for both null and undefined)
    if (
      step.thermomixTime == null &&
      step.thermomixTemp == null &&
      step.thermomixSpeed == null
    ) {
      return step;
    }

    const validated = { ...step };

    // Validate time (must be positive number, not NaN or null)
    if (step.thermomixTime != null) {
      if (
        typeof step.thermomixTime !== "number" ||
        Number.isNaN(step.thermomixTime) || step.thermomixTime <= 0
      ) {
        console.warn(
          `Invalid Thermomix time for step ${step.order}: ${step.thermomixTime}. Removing.`,
        );
        validated.thermomixTime = undefined;
      }
    }

    // Validate speed (case-insensitive for special speeds)
    if (step.thermomixSpeed != null) {
      const normalizedSpeed = step.thermomixSpeed.toLowerCase();
      const isValid =
        VALID_NUMERIC_SPEEDS.includes(step.thermomixSpeed as any) ||
        VALID_SPECIAL_SPEEDS.includes(normalizedSpeed as any);
      if (!isValid) {
        console.warn(
          `Invalid Thermomix speed for step ${step.order}: ${step.thermomixSpeed}. Removing.`,
        );
        validated.thermomixSpeed = undefined;
      } else if (VALID_SPECIAL_SPEEDS.includes(normalizedSpeed as any)) {
        // Normalize to title case for consistency
        validated.thermomixSpeed = step.thermomixSpeed.charAt(0).toUpperCase() +
          step.thermomixSpeed.slice(1).toLowerCase();
      }
    }

    // Validate temperature
    if (step.thermomixTemp != null) {
      const isValid = TEMP_REGEX.test(step.thermomixTemp) ||
        VALID_SPECIAL_TEMPS.includes(step.thermomixTemp as any);
      if (!isValid) {
        console.warn(
          `Invalid Thermomix temperature for step ${step.order}: ${step.thermomixTemp}. Removing.`,
        );
        validated.thermomixTemp = undefined;
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
