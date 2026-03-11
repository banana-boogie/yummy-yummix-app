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
import type { CostContext } from "../ai-gateway/types.ts";
import { hasThermomix } from "../equipment-utils.ts";
import { logAIUsage } from "../usage-logger.ts";

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const generateCustomRecipeTool = {
  type: "function" as const,
  function: {
    name: "generate_custom_recipe",
    description:
      "Generate a custom recipe. ONLY call this when the user explicitly asks you to create/make a recipe " +
      "or agrees to you making one. Never call this for discovery or vague cravings — use search_recipes instead. " +
      "The user must have provided SPECIFIC details: a dish name (e.g. 'banana bread') or ingredients (e.g. 'chicken and rice'). " +
      "If the user is vague ('make me something', 'I don't know'), ask them what they want first — do NOT call this tool. " +
      "Use their ingredients as the foundation and add complementary ones creatively (seasonings, herbs, pantry staples). " +
      "Never contradict the user's intent (e.g. dessert must be a dessert).",
    parameters: {
      type: "object",
      properties: {
        recipeDescription: {
          type: "string",
          description:
            'What the user wants to eat — the dish concept (e.g. "banana bread loaf", "creamy chicken pasta", "chocolate lava cake"). Always pass this when the user has a specific dish in mind.',
        },
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
        portions: {
          type: "integer",
          description:
            "Number of portions/servings. Infer from conversation (e.g. 'for 2', 'family dinner'). Omit to use user's default.",
          minimum: 1,
          maximum: 50,
        },
        additionalRequests: {
          type: "string",
          description:
            'Additional requests, constraints, or modifications (e.g., "make it spicy", "increase to 8 portions", "kid-friendly")',
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
  onPartialRecipe?: PartialRecipeCallback,
  usageContext?: AIUsageLogContext,
  costContext?: CostContext,
): Promise<GenerateRecipeResult> {
  // Timing instrumentation for performance monitoring
  const timings: Record<string, number> = {};
  const totalStart = performance.now();
  let phaseStart = totalStart;

  // Validate and sanitize params
  const params = validateGenerateRecipeParams(rawParams);
  let allergenWarning: string | undefined;

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

  // Allergens are non-blocking: always proceed, but set warning for display
  if (!allergenCheck.safe) {
    allergenWarning = allergenCheck.warning || (
      userContext.language === "es"
        ? "Advertencia de alérgenos: revisa cuidadosamente los ingredientes."
        : "Allergen warning: please review ingredients carefully."
    );
    console.warn(
      "[GenerateRecipe] Allergen detected, proceeding with warning",
      { warning: allergenWarning },
    );
  }

  // Generate the recipe using AI
  const recipe = await callRecipeGenerationAI(
    params,
    userContext,
    safetyReminders,
    {
      usageContext,
      allergenWarning: allergenWarning || undefined,
    },
    costContext,
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

  const warningMessages: string[] = [];
  if (allergenWarning) {
    warningMessages.push(allergenWarning);
  }
  if (!safetyCheck.safe && safetyCheck.warnings.length > 0) {
    warningMessages.push(safetyCheck.warnings.join(" "));
  }

  if (warningMessages.length > 0) {
    return {
      recipe,
      safetyFlags: {
        allergenWarning: warningMessages.join(" "),
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
      description: { type: "string" },
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
      "description",
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
 * Uses the 'recipe_generation' usage type for structured recipe output.
 * Uses one local retry if parsing/validation fails.
 */
async function callRecipeGenerationAI(
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
  options?: {
    allergenWarning?: string;
    usageContext?: AIUsageLogContext;
  },
  costContext?: CostContext,
): Promise<GeneratedRecipe> {
  const prompt = buildRecipeGenerationPrompt(
    params,
    userContext,
    safetyReminders,
    options,
  );
  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);
  const recipeSchema = buildRecipeJsonSchema(isThermomixUser);
  const systemPrompt = getSystemPrompt(userContext);

  const strictRetryPromptSuffix =
    "\n\nCRITICAL: Return ONLY raw JSON. No markdown, no code fences, no explanation text.";

  let lastError: Error | null = null;

  const usageContext = options?.usageContext;

  /** Fire-and-forget usage log for recipe generation attempts. */
  function fireRecipeUsageLog(
    attemptIndex: number,
    status: "success" | "error",
    startTime: number,
    response?: {
      model: string;
      usage: { inputTokens: number; outputTokens: number };
    },
  ) {
    if (!usageContext) return;
    void logAIUsage({
      userId: usageContext.userId,
      sessionId: usageContext.sessionId,
      requestId: usageContext.requestId,
      callPhase: "recipe_generation",
      attempt: attemptIndex,
      status,
      functionName: usageContext.functionName,
      usageType: "recipe_generation",
      model: response?.model ?? null,
      inputTokens: response?.usage.inputTokens ?? null,
      outputTokens: response?.usage.outputTokens ?? null,
      durationMs: Math.round(performance.now() - startTime),
      metadata: {
        streaming: false,
        request_type: "recipe_generation",
        source: "generate_custom_recipe",
      },
    });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const isRetry = attempt === 1;
    const llmStart = performance.now();
    let response: {
      content: string;
      model: string;
      usage: { inputTokens: number; outputTokens: number };
    };

    try {
      response = await chat({
        usageType: "recipe_generation",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: isRetry ? prompt + strictRetryPromptSuffix : prompt,
          },
        ],
        temperature: 0.7,
        maxTokens: 6144,
        responseFormat: {
          type: "json_schema",
          schema: recipeSchema,
        },
        costContext,
      });
    } catch (error) {
      fireRecipeUsageLog(attempt, "error", llmStart);
      throw error;
    }

    try {
      const parsedRecipe = parseAndValidateGeneratedRecipe(response.content);
      fireRecipeUsageLog(attempt, "success", llmStart, response);
      return parsedRecipe;
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error("Recipe parsing failed");
      fireRecipeUsageLog(attempt, "error", llmStart, response);

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

export function parseAndValidateGeneratedRecipe(
  content: string,
): GeneratedRecipe {
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
export function getSystemPrompt(userContext: UserContext): string {
  const lang = userContext.language === "es" ? "Mexican Spanish" : "English";
  const units = userContext.measurementSystem === "imperial"
    ? "cups, tablespoons, teaspoons, ounces, pounds, °F"
    : "ml, liters, grams, kg, °C";

  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);

  if (!isThermomixUser && userContext.kitchenEquipment.length > 0) {
    console.warn(
      "[Recipe Generation] User has equipment but no Thermomix:",
      userContext.kitchenEquipment,
    );
  }

  const thermomixSection = isThermomixUser
    ? `

## THERMOMIX USAGE (User owns Thermomix — you are an expert Thermomix cook)

Choose optimal time, speed, and temperature for each step based on the technique.

PARAMETERS:
- **thermomixTime** (seconds) and **thermomixSpeed** ("1"-"10", "Spoon", or "Reverse") are a REQUIRED PAIR — if you set one, you MUST set both.
- **thermomixTemp** ("37°C"-"120°C" or "Varoma") is OPTIONAL — only when the step needs heat. Null = no heat (chopping, blending, kneading).

SPEED GUIDE:
- Spoon/1-2: Gentle stirring, simmering, slow cooking (cooking speeds)
- 3-5: Mixing, rough chopping
- 5-7: Fine chopping, sauces
- 7-10: Pureeing, grinding, blending, smoothies
- REVERSE: Use when cooking ingredients that must stay intact (stews, sautéing, pasta). Blunt edge stirs without cutting. Combine with Spoon/1-2.

TEMPERATURE GUIDE:
- 37-50°C: Melting chocolate/butter, warming
- 60-90°C: Simmering sauces, custards, béchamel
- 90-100°C: Boiling, cooking rice/pasta, soups, stews
- 100-120°C: Sautéing, caramelizing, browning
- Varoma: Steam cooking (needs 500ml+ water in bowl, speed 2)

CRITICAL RULES:
- Above 60°C: max speed 6. Never use high speeds with hot food.
- Chopping is SECONDS (3-10 sec), not minutes. Start short, check.
- Sautéing always uses Reverse (e.g. 120°C / Reverse / Speed 1 / 5-10 min).

Skip Thermomix for: plating, garnishing, oven/grill tasks, manual shaping — leave all three params null.

Examples:
- Sauté: {"order": 2, "instruction": "Sauté onions", "ingredientsUsed": ["onion"], "thermomixTime": 300, "thermomixTemp": "100°C", "thermomixSpeed": "Reverse"}
- Chop: {"order": 1, "instruction": "Chop vegetables", "ingredientsUsed": ["carrot"], "thermomixTime": 5, "thermomixTemp": null, "thermomixSpeed": "5"}
- Steam: {"order": 3, "instruction": "Steam vegetables in Varoma", "ingredientsUsed": ["broccoli", "zucchini"], "thermomixTime": 1200, "thermomixTemp": "Varoma", "thermomixSpeed": "2"}
- Non-Thermomix: {"order": 5, "instruction": "Plate and garnish", "ingredientsUsed": ["parsley"], "thermomixTime": null, "thermomixTemp": null, "thermomixSpeed": null}`
    : "";

  return `Expert cook and recipe writer. Output in ${lang}, ${userContext.measurementSystem} units (${units}).

RULES: Use practical quantities (e.g. 1/3 not 0.333, round to common fractions). Name recipes naturally without dietary labels (GOOD: "Chicken Ramen", BAD: "Sugar-Free Ramen"). Preferences guide creativity; ingredient dislikes are strict. Avoid allergen ingredients by default.
${thermomixSection}

OUTPUT: Return ONLY valid JSON (no markdown, no code fences). Each step needs "ingredientsUsed" matching ingredient names exactly. Use this structure:
{"schemaVersion":"1.0","suggestedName":"...","description":"A brief 1-2 sentence description of the dish","measurementSystem":"${userContext.measurementSystem}","language":"${userContext.language}","ingredients":[{"name":"...","quantity":1,"unit":"..."}],"steps":[{"order":1,"instruction":"...","ingredientsUsed":["..."]}],"totalTime":30,"difficulty":"easy","portions":4,"tags":[]}`;
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
function buildRecipeGenerationPrompt(
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
  options?: {
    allergenWarning?: string;
  },
): string {
  const parts: string[] = [];

  // Core request — dish concept first, then ingredients
  if (params.recipeDescription) {
    parts.push(`Create a recipe for: ${params.recipeDescription}`);
    parts.push(`Available ingredients: ${params.ingredients.join(", ")}`);
  } else {
    parts.push(
      `Create a recipe using these ingredients: ${
        params.ingredients.join(", ")
      }`,
    );
  }

  // Portions — explicit param > user default > fallback
  const portions = params.portions ?? userContext.householdSize ?? 4;
  parts.push(`Portions: ${portions}.`);

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

  // === EQUIPMENT (use where appropriate in the recipe) ===
  if (params.useful_items && params.useful_items.length > 0) {
    parts.push("\n🍳 EQUIPMENT for this recipe:");
    parts.push(
      `Use these where they fit best: ${params.useful_items.join(", ")}`,
    );
  } else if (userContext.kitchenEquipment.length > 0) {
    parts.push("\n🍳 AVAILABLE EQUIPMENT:");
    parts.push(
      `User has: ${
        userContext.kitchenEquipment.join(", ")
      }. Use where appropriate for the best result.`,
    );
  }

  // === SOFT PREFERENCES (consider but don't force) ===
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
      parts.push("\n📝 Soft preferences (consider but be creative):");
      parts.push(
        `Cuisine inspiration (OPTIONAL, vary styles): User enjoys ${
          validCuisines.join(", ")
        } cooking. ` +
          `Feel free to explore other cuisines that suit the ingredients - variety is welcome!`,
      );
    }
  }

  // Safety reminders
  if (safetyReminders) {
    parts.push(`\n${safetyReminders}`);
  }

  if (options?.allergenWarning) {
    parts.push("\n⚠️ ALLERGEN SAFETY NOTE:");
    parts.push(
      "Some ingredients may trigger allergen concerns for this user. " +
        "Mention any relevant allergen info naturally in the recipe instructions.",
    );
    parts.push(`Detected: ${options.allergenWarning}`);
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
export async function checkIngredientsForAllergens(
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

export async function getRelevantUsefulItems(
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
export function validateThermomixUsage(
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
 * Parse a Thermomix speed string into a normalized form.
 * Accepts: "1"-"10", "Spoon", "Reverse", "Reverse 1"-"Reverse 10", "Reverse Spoon"
 * Returns: normalized string or null if invalid.
 * Exported for testing.
 */
export function parseThermomixSpeed(raw: string): string | null {
  const lower = raw.toLowerCase().trim();

  // Pure numeric: "1" through "10"
  if (VALID_NUMERIC_SPEEDS.includes(lower as any)) return lower;

  // Standalone special: "spoon", "reverse"
  if (lower === "spoon") return "Spoon";
  if (lower === "reverse") return "Reverse";

  // Composite: "reverse spoon" — spoon attachment in reverse
  if (lower === "reverse spoon" || lower === "spoon reverse") {
    return "Reverse Spoon";
  }

  // Composite: "reverse 1", "Reverse 5", etc.
  const reverseNumeric = lower.match(/^reverse\s+(\d+)$/);
  if (reverseNumeric) {
    const num = reverseNumeric[1];
    if (VALID_NUMERIC_SPEEDS.includes(num as any)) return `Reverse ${num}`;
    return null;
  }

  // Reversed order: "1 reverse", "5 reverse"
  const numericReverse = lower.match(/^(\d+)\s+reverse$/);
  if (numericReverse) {
    const num = numericReverse[1];
    if (VALID_NUMERIC_SPEEDS.includes(num as any)) return `Reverse ${num}`;
    return null;
  }

  return null;
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

    // Validate speed (supports composite like "Reverse 1", "Spoon", "5")
    if (step.thermomixSpeed != null) {
      const parsed = parseThermomixSpeed(step.thermomixSpeed);
      if (!parsed) {
        console.warn(
          `Invalid Thermomix speed for step ${step.order}: ${step.thermomixSpeed}. Removing.`,
        );
        validated.thermomixSpeed = undefined;
      } else {
        validated.thermomixSpeed = parsed;
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

    // Pair completion: time + speed must appear together
    const hasTime = validated.thermomixTime != null;
    const hasSpeed = validated.thermomixSpeed != null;
    if (hasTime && !hasSpeed) {
      console.warn(
        `Step ${step.order}: thermomixTime set without thermomixSpeed. Filling speed with "1" (gentle default).`,
      );
      validated.thermomixSpeed = "1";
    } else if (hasSpeed && !hasTime) {
      console.warn(
        `Step ${step.order}: thermomixSpeed set without thermomixTime. Filling time with 60 (safe default).`,
      );
      validated.thermomixTime = 60;
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
