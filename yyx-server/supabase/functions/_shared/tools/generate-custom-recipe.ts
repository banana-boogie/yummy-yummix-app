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
  loadAllergenGroups,
} from "../allergen-filter.ts";
import { buildSafetyReminders, checkRecipeSafety } from "../food-safety.ts";
import { chat } from "../ai-gateway/index.ts";
import type { CostContext } from "../ai-gateway/types.ts";
import {
  getThermomixModel,
  hasAirFryer,
  hasThermomix,
  VALID_THERMOMIX_MODES,
} from "../equipment-utils.ts";
import {
  buildLocaleChain,
  getBaseLanguage,
  getLanguageName,
  pickTranslation,
} from "../locale-utils.ts";
import { logAIUsage } from "../usage-logger.ts";

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const generateCustomRecipeTool = {
  type: "function" as const,
  function: {
    name: "generate_custom_recipe",
    description:
      "Generate a custom recipe when the user wants a specific dish that isn't in the database, " +
      "or when they ask you to make/create a recipe. Also use this when search_recipes returned " +
      "results that don't match what the user wanted. " +
      "The user must have provided SPECIFIC details: a dish name (e.g. 'mole') or ingredients (e.g. 'chicken and rice'). " +
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
        kitchen_tools: {
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

  // Run allergen check, allergen prompt section, and safety reminders in parallel
  const allRestrictions = [
    ...userContext.dietaryRestrictions,
    ...userContext.customAllergies,
  ];
  const [allergenCheck, allergenPromptSection, safetyReminders] = await Promise
    .all([
      checkIngredientsForAllergens(
        supabase,
        params.ingredients,
        userContext.dietaryRestrictions,
        userContext.customAllergies,
        userContext.locale,
      ),
      buildAllergenPromptSection(
        supabase,
        allRestrictions,
        userContext.language,
      ),
      buildSafetyReminders(
        supabase,
        params.ingredients,
        userContext.measurementSystem,
        userContext.locale,
      ),
    ]);
  timings.allergen_and_safety_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Allergens are non-blocking: always proceed, but set warning for display
  if (!allergenCheck.safe) {
    const baseLang = getBaseLanguage(userContext.locale);
    allergenWarning = allergenCheck.warning || (
      baseLang === "es"
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
      allergenPromptSection: allergenPromptSection || undefined,
    },
    costContext,
  );
  timings.recipe_llm_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Validate Thermomix parameters if present
  recipe.steps = validateThermomixSteps(recipe.steps);
  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);

  timings.thermomix_validation_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Post-generation allergen scan on AI-generated ingredients (safety net)
  if (allRestrictions.length > 0) {
    const generatedIngredientNames = recipe.ingredients.map((i) => i.name);
    const postGenAllergenCheck = await checkIngredientsForAllergens(
      supabase,
      generatedIngredientNames,
      userContext.dietaryRestrictions,
      userContext.customAllergies,
      userContext.language,
    );
    if (!postGenAllergenCheck.safe && postGenAllergenCheck.warning) {
      console.warn(
        "[GenerateRecipe] Post-gen allergen scan caught unsafe ingredient",
        { warning: postGenAllergenCheck.warning },
      );
      allergenWarning = allergenWarning
        ? `${allergenWarning} ${postGenAllergenCheck.warning}`
        : postGenAllergenCheck.warning;
    }
    timings.postgen_allergen_ms = Math.round(performance.now() - phaseStart);
    phaseStart = performance.now();
  }

  // Two-phase SSE: emit partial recipe before enrichment for perceived latency reduction
  // The frontend can start rendering the recipe card immediately
  if (onPartialRecipe) {
    onPartialRecipe(recipe);
    console.log("[GenerateRecipe] Partial recipe emitted, starting enrichment");
  }

  // Run post-recipe enrichment and validation in parallel
  const [enrichedIngredients, enrichedKitchenTools, safetyCheck] = await Promise
    .all([
      enrichIngredientsWithImages(
        recipe.ingredients,
        supabase,
        userContext.locale,
      ),
      enrichKitchenTools(
        supabase,
        recipe,
        userContext.locale,
        isThermomixUser,
      ),
      checkRecipeSafety(
        supabase,
        recipe.ingredients,
        recipe.totalTime,
        userContext.measurementSystem,
        userContext.locale,
      ),
    ]);
  timings.enrichment_ms = Math.round(performance.now() - phaseStart);

  recipe.ingredients = enrichedIngredients;
  recipe.kitchenTools = enrichedKitchenTools;

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
    stepProperties.thermomixMode = { type: ["string", "null"] };
    stepRequired.push(
      "thermomixTime",
      "thermomixTemp",
      "thermomixSpeed",
      "thermomixMode",
    );
  }

  // Timer field — for non-Thermomix steps with a specific duration
  stepProperties.timerSeconds = {
    type: ["integer", "null"],
    description:
      "Duration in seconds for non-Thermomix steps that have a specific time duration. Thermomix steps use thermomixTime instead — never set both. Examples: let dough rise 30 min → 1800, marinate 15 min → 900.",
  };
  stepRequired.push("timerSeconds");

  // Tips field — always included regardless of equipment
  stepProperties.tip = {
    type: ["string", "null"],
    description:
      "Optional practical cooking tip for this step. Short, actionable advice: technique, timing, doneness cues, substitutions, or equipment tips. 1-2 sentences max. Null for straightforward steps.",
  };
  stepRequired.push("tip");

  return {
    type: "object",
    properties: {
      schemaVersion: { type: "string", enum: ["1.0"] },
      suggestedName: { type: "string" },
      description: { type: "string" },
      measurementSystem: { type: "string", enum: ["imperial", "metric"] },
      locale: { type: "string" },
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
      kitchenTools: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            notes: { type: ["string", "null"] },
          },
          required: ["name", "notes"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "schemaVersion",
      "suggestedName",
      "description",
      "measurementSystem",
      "locale",
      "ingredients",
      "steps",
      "totalTime",
      "difficulty",
      "portions",
      "tags",
      "kitchenTools",
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
    allergenPromptSection?: string;
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
  let systemPrompt = getSystemPrompt(userContext);

  // Append allergen ingredient list if available
  if (options?.allergenPromptSection) {
    systemPrompt += options.allergenPromptSection;
  }

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
 * Build a prompt section listing specific allergen ingredients the AI must avoid.
 * Uses the same allergen_groups DB table as the runtime checker — single source of truth.
 */
export async function buildAllergenPromptSection(
  supabase: SupabaseClient,
  restrictions: string[],
  language: "en" | "es",
): Promise<string> {
  if (restrictions.length === 0) return "";

  const allergens = await loadAllergenGroups(supabase); // cached, zero-cost after first call
  const sections: string[] = [];

  for (const restriction of restrictions) {
    const entries = allergens.filter((a) => a.category === restriction);
    if (entries.length === 0) continue;

    const names = entries.map((e) =>
      e.names[language] ?? e.names["en"] ?? e.ingredient_canonical
    );
    const header = language === "es"
      ? `**${restriction}**: NUNCA uses estos ingredientes:`
      : `**${restriction}**: NEVER use these ingredients:`;
    sections.push(`${header}\n${names.join(", ")}`);
  }

  if (sections.length === 0) return "";

  const title = language === "es"
    ? "## RESTRICCIONES DE ALERGENOS — PROHIBIDO usar estos ingredientes"
    : "## ALLERGEN RESTRICTIONS — NEVER use these ingredients";

  return `\n\n${title}\n\n${sections.join("\n\n")}`;
}

/**
 * Build the system prompt for recipe generation.
 */
export function getSystemPrompt(userContext: UserContext): string {
  const lang = getLanguageName(userContext.locale);
  const units = userContext.measurementSystem === "imperial"
    ? "cups, tablespoons, teaspoons, ounces, pounds, °F"
    : "ml, liters, grams, kg, °C";

  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);
  const isAirFryerUser = hasAirFryer(userContext.kitchenEquipment);
  const thermomixModel = isThermomixUser
    ? getThermomixModel(userContext.kitchenEquipment)
    : null;

  if (
    !isThermomixUser && !isAirFryerUser &&
    userContext.kitchenEquipment.length > 0
  ) {
    console.warn(
      "[Recipe Generation] User has equipment but no Thermomix or Air Fryer:",
      userContext.kitchenEquipment,
    );
  }

  // Build model-aware temperature guide
  const isTM7 = thermomixModel === "TM7";
  const maxManualTemp = isTM7 ? "160°C" : "120°C";
  const modelLabel = thermomixModel ?? "TM6";

  const temperatureGuide = isTM7
    ? `TEMPERATURE GUIDE (TM7 — manual up to 160°C):
- 37-50°C: Melting chocolate/butter, warming
- 60-90°C: Simmering sauces, custards, béchamel
- 90-100°C: Boiling, cooking rice/pasta, soups, stews
- 100-120°C: Sautéing, caramelizing, light browning
- 120-160°C: Higher-heat browning, searing, deep caramelization
- Varoma: Steam cooking (needs 500ml+ water in bowl, speed 2)`
    : `TEMPERATURE GUIDE (${modelLabel} — manual up to 120°C):
- 37-50°C: Melting chocolate/butter, warming
- 60-90°C: Simmering sauces, custards, béchamel
- 90-100°C: Boiling, cooking rice/pasta, soups, stews
- 100-120°C: Sautéing, caramelizing, browning
- Varoma: Steam cooking (needs 500ml+ water in bowl, speed 2)`;

  const openCookingNote = isTM7
    ? `\nOPEN COOKING (TM7 only): No blade rotation. Temperature + time only. Stir manually with spatula. Lid is unlocked. Up to 100°C. This is a dedicated cooking mode — NOT manual cooking with the lid open.`
    : "";

  const cutterNote = isTM7
    ? `- Cutter+ accessory: Speed 4 only, max 28oz. For uniform slicing/grating of firm vegetables and hard cheese.`
    : `- Cutter disc accessory: Speed 4 only, max 28oz. For uniform slicing/grating of firm vegetables and hard cheese.`;

  const thermomixSection = isThermomixUser
    ? `

## THERMOMIX USAGE (User has a Thermomix ${modelLabel} — you are an expert Thermomix cook)

Choose optimal time, speed, temperature, and cooking mode for each step based on the technique.

PARAMETERS:
- **thermomixTime** (seconds) and **thermomixSpeed** ("1"-"10", "Spoon", or "Reverse") are a REQUIRED PAIR — if you set one, you MUST set both.
- **thermomixTemp** ("37°C"-"${maxManualTemp}" or "Varoma") is OPTIONAL — only when the step needs heat. Null = no heat (chopping, blending, kneading).
- **thermomixMode** is OPTIONAL — set it when the step uses a named cooking mode. Null = manual mode (the default).

COOKING MODES (set thermomixMode when applicable):
- "slow_cook": Reverse, Speed 1, blade cover, 70-100°C, up to 12h. For stews, braises, casseroles.${
      isTM7 ? "" : " (TM6: available)"
    }
- "rice_cooker": Automatic temp/speed/time for rice and grains.
- "sous_vide": Precise temp hold, no stirring. For proteins, vegetables.
- "fermentation": Low temp hold (30-45°C), extended time. For yogurt, dough proofing, tempeh. Available on both TM6 and TM7.
- "dough": Kneading mode, max 500g flour. For bread, pasta, pizza dough.
- "turbo": Brief pulse at max speed. For crushing ice, quick grind.
- "high_temperature" (displayed as "Browning" / "Dorar" on the device): 120-160°C, max 10min per step. Browning, searing, caramelizing. Blade ROTATES — unsuitable for delicate formed items. This mode has NO speed setting — always set thermomixSpeed to null.${
      isTM7
        ? ' TM7: two intensity levels — "gentle" (vegetables, onions, garlic, delicate browning) and "intense" (searing meats, deep caramelization).'
        : " (TM6: Guided Cooking only)"
    }
${
      isTM7
        ? `- "open_cooking": No blade rotation. Temperature + time only. Stir manually with spatula. Lid is unlocked. Up to 100°C. A dedicated cooking mode — NOT manual cooking with lid open. (TM7 only)`
        : ""
    }

SPEED GUIDE:
- Spoon/1-2: Gentle stirring, simmering, slow cooking (cooking speeds)
- 3-5: Mixing, rough chopping
- 5-7: Fine chopping, sauces
- 7-10: Pureeing, grinding, blending, smoothies
- REVERSE: Use when cooking ingredients that must stay intact (stews, sautéing, pasta). Blunt edge stirs without cutting. Combine with Spoon/1-2.

${temperatureGuide}
${openCookingNote}
CRITICAL RULES:
- Above 60°C: max speed 6. Never use high speeds with hot food.
- Chopping is SECONDS (3-10 sec), not minutes. Start short, check.
- Sautéing always uses Reverse (e.g. ${
      isTM7 ? "140°C" : "120°C"
    } / Reverse / Speed 1 / 5-10 min).
- Browning/searing: 100-250g per batch, blade rotates in this mode. For larger quantities (>250g), recommend using a pan or skillet instead.
- Delicate formed items (meatballs, dumplings, stuffed pasta): NEVER brown in the Thermomix bowl. Blade rotation destroys them. Pan-fry or oven-bake instead.
- When a step uses a mixture from a previous step, reference it as "the [name] mixture" in instructions. In ingredientsUsed, list only NEW ingredients added in this step — not the components of an already-combined mixture.

Skip Thermomix for: plating, garnishing, oven/grill tasks, manual shaping — leave all four params null.
For non-Thermomix steps that have a specific time duration (e.g. resting, marinating, oven baking), set timerSeconds instead of thermomixTime. Never set both on the same step.

PHYSICAL CONSTRAINTS (bowl = 2.2 liters):
- Total volume of ingredients + liquid must not exceed 2.2L. For hot foods (soups, stews), keep under 1.8L.
- Dough: max 500g flour per batch.
- Browning/searing: 100-250g per batch. Multiple batches for larger quantities.
- Slow cooking meat: max 800g per batch.
- Above 95°C: replace measuring cup with simmering basket.
- Speed 7+: measuring cup MUST be in place.
- Butterfly whisk: max speed 4.
${cutterNote}
- If the recipe exceeds bowl capacity, instruct to cook in batches and note it in a tip.

Examples:
- Sauté: {"order": 2, "instruction": "Sauté onions", "ingredientsUsed": ["onion"], "thermomixTime": 300, "thermomixTemp": "100°C", "thermomixSpeed": "Reverse", "thermomixMode": null, "tip": "The onion is ready when translucent, about 3-4 minutes."}
- Chop: {"order": 1, "instruction": "Chop vegetables", "ingredientsUsed": ["carrot"], "thermomixTime": 5, "thermomixTemp": null, "thermomixSpeed": "5", "thermomixMode": null, "tip": "Start with 3-second pulses and check — you can always chop more."}
- Steam: {"order": 3, "instruction": "Steam vegetables in Varoma", "ingredientsUsed": ["broccoli", "zucchini"], "thermomixTime": 1200, "thermomixTemp": "Varoma", "thermomixSpeed": "2", "thermomixMode": null, "tip": null}
- Slow Cook: {"order": 2, "instruction": "Slow cook the stew", "ingredientsUsed": ["beef", "potato"], "thermomixTime": 7200, "thermomixTemp": "90°C", "thermomixSpeed": "Reverse", "thermomixMode": "slow_cook", "tip": "Check after 1 hour — add water if needed."}
- Non-Thermomix: {"order": 5, "instruction": "Plate and garnish", "ingredientsUsed": ["parsley"], "thermomixTime": null, "thermomixTemp": null, "thermomixSpeed": null, "thermomixMode": null, "tip": null}`
    : "";

  const airFryerSection = isAirFryerUser
    ? `

## AIR FRYER USAGE (User owns Air Fryer — suggest it when it's the best tool for the job)

Use the Air Fryer for steps where it produces better results than conventional methods: crisping, roasting, reheating, and quick baking. Include Air Fryer temperature and time in the step instruction text.

BEST USES:
- Crisping/browning: proteins (chicken wings, fish fillets, chicken thighs), vegetables (broccoli, Brussels sprouts, cauliflower), breaded items
- Quick roasting: root vegetables, peppers, garlic
- Frozen foods: cook directly from frozen — nuggets, fries, breaded items (no thawing needed)
- Reheating: leftovers come out crispy, not soggy
- Baking small items: individual portions, small cakes
- Tofu: crispy exterior without pan-sticking

MEXICAN KITCHEN FAVORITES:
- Tostadas: lightly oil corn tortillas, air fry at 190°C for 4-5 minutes until crisp
- Tortilla chips: cut tortillas into triangles, light oil, 180°C for 5-7 minutes
- Empanadas: 190°C for 10-12 minutes until golden — crispy without deep frying
- Chimichangas: 200°C for 8-10 minutes, flipping halfway
- Churros: pipe and chill dough, air fry at 190°C for 8-10 minutes, coat in cinnamon sugar after
- Chiles rellenos (breaded): 180°C for 10-12 minutes — use dry breadcrumb coating, not wet batter
- Quesadillas: 190°C for 5-6 minutes for extra-crispy tortilla

TEMPERATURE GUIDE:
- 150-160°C (300-320°F): Delicate items, reheating, dehydrating
- 170-180°C (340-360°F): Chicken pieces, fish, roasted vegetables
- 190-200°C (375-400°F): Crispy items, fries, wings, empanadas, tostadas
- 200-220°C (400-430°F): Quick searing, very crispy finishes (short time only)

KEY RULES:
- Preheat 3-5 minutes for crispy results on proteins, vegetables, and reheating. Skip preheating for thick raw meats and baked goods — they cook better starting cold.
- Don't overcrowd the basket — air needs to circulate. For large batches, cook in rounds.
- Shake or flip halfway through for even cooking.
- Pat proteins and vegetables dry before cooking — moisture prevents crispiness.
- A light brush or mist of high smoke point oil (avocado, sunflower) improves crispiness. Avoid aerosol cooking sprays which damage nonstick coatings.
- Loose dry seasonings blow off in the airflow — use oil to help them stick, or season after cooking.
- Always verify meat reaches safe internal temperature (poultry: 74°C/165°F, beef/pork/fish: 63°C/145°F).
- Include temperature and time in the step instruction (e.g., "Air fry at 200°C for 12-15 minutes, shaking halfway").

WHEN NOT TO USE:
- Soups, stews, sauces, or anything liquid-based
- Large roasts or whole chickens that don't fit properly
- Wet batters (beer batter, tempura) — they drip through the basket. Use dry breadcrumb coatings instead.
- Loose leafy greens (they blow around and burn)
- Raw rice, pasta, or grains (need water immersion)
- When Thermomix or stovetop gives better results for that specific step

Example: {"order": 3, "instruction": "Place the chicken thighs in the air fryer basket in a single layer. Air fry at 190°C for 18-20 minutes, flipping halfway, until golden and cooked through.", "ingredientsUsed": ["chicken thighs"]}`
    : "";

  return `Expert cook and recipe writer. Output in ${lang}, ${userContext.measurementSystem} units (${units}).

RULES: Use practical quantities (e.g. 1/3 not 0.333, round to common fractions). Kitchen-friendly minimums: salt (min 1/4 tsp), spices/seeds (min 1/2 tsp), herbs (min 1 tbsp). Never output sub-gram quantities like "1g sesame seeds" — for small amounts use teaspoons/tablespoons. Name recipes naturally without dietary labels (GOOD: "Chicken Ramen", BAD: "Sugar-Free Ramen"). Preferences guide creativity; ingredient dislikes are strict. Avoid allergen ingredients by default.
${thermomixSection}
${airFryerSection}

## TIPS
Add a practical tip to steps where it genuinely helps. Good tips:
- Technique advice ("Chop while the Thermomix sautés to save time")
- Doneness cues ("The onion is ready when translucent, ~3-4 minutes")
- Make-ahead suggestions ("This sauce freezes well for up to 3 months")
- Equipment tips ("Use butterfly whisk for lighter textures")
- Substitution ideas ("No crema? Use Greek yogurt")
Keep tips short (1-2 sentences). Not every step needs a tip — only where it adds value. Set to null for simple steps.

OUTPUT: Return ONLY valid JSON (no markdown, no code fences). Each step needs "ingredientsUsed" matching ingredient names exactly. Set "timerSeconds" for steps with a specific duration (resting, baking, marinating) — it powers a countdown timer in the app. Include "kitchenTools" — kitchen tools and accessories that would be helpful for this recipe. Not just required tools, but things that make the cooking experience easier — like a waste bowl for peels and trimmings. Think like a seasoned home cook setting up their station. Use this structure:
{"schemaVersion":"1.0","suggestedName":"...","description":"A brief 1-2 sentence description of the dish","measurementSystem":"${userContext.measurementSystem}","locale":"${userContext.locale}","ingredients":[{"name":"...","quantity":1,"unit":"..."}],"steps":[{"order":1,"instruction":"...","ingredientsUsed":["..."]}],"totalTime":30,"difficulty":"easy","portions":4,"tags":[],"kitchenTools":[{"name":"...","notes":"..."}]}`;
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
  if (params.kitchen_tools && params.kitchen_tools.length > 0) {
    parts.push("\n🍳 EQUIPMENT for this recipe:");
    parts.push(
      `Use these where they fit best: ${params.kitchen_tools.join(", ")}`,
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
  locale: string,
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
        locale,
      )
    ),
  );

  // Find the first unsafe ingredient
  const unsafeResult = results.find((result) => !result.safe);

  if (unsafeResult) {
    const baseLang = getBaseLanguage(locale);
    if (unsafeResult.systemUnavailable) {
      const SYSTEM_UNAVAILABLE_WARNINGS: Record<string, string> = {
        es:
          "No pude verificar alergias en este momento. Para tu seguridad, no puedo generar esta receta ahora.",
        en:
          "I couldn't verify allergens right now. For your safety, I can't generate this recipe at the moment.",
      };
      return {
        safe: false,
        systemUnavailable: true,
        warning: SYSTEM_UNAVAILABLE_WARNINGS[baseLang] ||
          SYSTEM_UNAVAILABLE_WARNINGS["en"],
      };
    }

    const warning = await getAllergenWarning(
      supabase,
      unsafeResult.allergen!,
      unsafeResult.category!,
      locale,
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
  locale: string = "en",
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
      preferred_locale: locale,
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
 * Kitchen tool enrichment: uses LLM output as primary source, enriches with
 * DB data (images, translated names), and gap-fills Thermomix accessories.
 */
interface KitchenToolTranslationRow {
  locale: string;
  name: string | null;
}

type KitchenToolRow = {
  id: string;
  kitchen_tool_translations: KitchenToolTranslationRow[];
  image_url: string | null;
};

const KITCHEN_TOOLS_CACHE_TTL_MS = 5 * 60 * 1000;
let kitchenToolsCache: KitchenToolRow[] | null = null;
let kitchenToolsCacheTimestamp = 0;

/** Clear the kitchen tools cache (exported for testing). */
export function clearKitchenToolsCache(): void {
  kitchenToolsCache = null;
  kitchenToolsCacheTimestamp = 0;
}

/**
 * Fetch all kitchen tools from the database, with in-memory caching.
 */
async function fetchKitchenToolsFromDB(
  supabase: SupabaseClient,
): Promise<KitchenToolRow[] | null> {
  let allItems = kitchenToolsCache;
  const cacheAge = Date.now() - kitchenToolsCacheTimestamp;

  if (!allItems || cacheAge > KITCHEN_TOOLS_CACHE_TTL_MS) {
    const { data, error } = await supabase
      .from("kitchen_tools")
      .select(`id, kitchen_tool_translations ( locale, name ), image_url`)
      .limit(50);

    if (error || !data || data.length === 0) {
      console.warn(
        "[Kitchen Tools] Failed to fetch or no items available:",
        error?.message,
      );
      return null;
    }

    allItems = data as unknown as KitchenToolRow[];
    kitchenToolsCache = allItems;
    kitchenToolsCacheTimestamp = Date.now();
  }

  return allItems;
}

/**
 * Fuzzy-match an LLM tool name against a DB kitchen tool's translations.
 * Returns true if either name contains the other (case-insensitive), or if
 * they share a significant word (length > 2).
 */
export function fuzzyMatchToolName(
  llmName: string,
  dbTranslations: KitchenToolTranslationRow[],
): boolean {
  const llmLower = llmName.toLowerCase().trim();

  for (const t of dbTranslations) {
    if (!t.name) continue;
    const dbLower = t.name.toLowerCase().trim();

    // Substring match in either direction
    if (dbLower.includes(llmLower) || llmLower.includes(dbLower)) {
      return true;
    }

    // Word overlap: if LLM name shares any significant word with DB name
    const llmWords = llmLower.split(/\s+/).filter((w) => w.length > 2);
    const dbWords = dbLower.split(/\s+/).filter((w) => w.length > 2);
    for (const lw of llmWords) {
      for (const dw of dbWords) {
        if (lw === dw || dw.includes(lw) || lw.includes(dw)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Enrich LLM-generated kitchen tools with DB data (imageUrl, translated names)
 * and gap-fill Thermomix-specific accessories the LLM may not know about.
 *
 * The LLM output is treated as the primary source of truth for tool selection.
 * This function only adds images, corrects names to DB translations, and
 * appends Thermomix accessories (Varoma, butterfly whisk) when relevant.
 */
export async function enrichKitchenTools(
  supabase: SupabaseClient,
  recipe: GeneratedRecipe,
  locale: string,
  hasThermomix: boolean,
): Promise<Array<{ name: string; imageUrl?: string; notes?: string }>> {
  try {
    const llmTools = recipe.kitchenTools || [];
    const dbTools = await fetchKitchenToolsFromDB(supabase);

    // If DB is unavailable, return LLM tools as-is (they still have names + notes)
    if (!dbTools || dbTools.length === 0) {
      console.warn(
        "[Kitchen Tools] No DB tools available, using LLM output as-is",
      );
      return llmTools.map((t) => ({
        name: t.name,
        notes: t.notes || undefined,
      }));
    }

    const localeChain = buildLocaleChain(locale);

    // 1. Enrich each LLM tool by matching against DB for imageUrl and translated name
    const enrichedTools: Array<{
      name: string;
      imageUrl?: string;
      notes?: string;
    }> = llmTools.map((llmTool) => {
      // Find best DB match via fuzzy matching
      const dbMatch = dbTools.find((dbTool) =>
        fuzzyMatchToolName(
          llmTool.name,
          dbTool.kitchen_tool_translations || [],
        )
      );

      if (dbMatch) {
        // Use locale-appropriate translated name from DB
        const translation = pickTranslation(
          dbMatch.kitchen_tool_translations || [],
          localeChain,
        );
        return {
          name: translation?.name || llmTool.name,
          imageUrl: dbMatch.image_url || undefined,
          notes: llmTool.notes || undefined,
        };
      }

      // No DB match — keep LLM tool as-is (no image available)
      return {
        name: llmTool.name,
        notes: llmTool.notes || undefined,
      };
    });

    // 2. Gap-fill: add Thermomix accessories if relevant and not already present
    if (hasThermomix) {
      const recipeText = (
        recipe.suggestedName +
        " " +
        recipe.steps.map((s) => s.instruction).join(" ")
      ).toLowerCase();

      const existingNamesLower = new Set(
        enrichedTools.map((t) => t.name.toLowerCase()),
      );

      // Check for Varoma (steaming)
      const usesVaroma = recipeText.includes("steam") ||
        recipeText.includes("varoma") || recipeText.includes("vapor") ||
        recipeText.includes("al vapor");
      if (usesVaroma) {
        const varomaDb = dbTools.find((dbTool) => {
          const names = (dbTool.kitchen_tool_translations || [])
            .map((t) => t.name?.toLowerCase() || "")
            .join(" ");
          return names.includes("varoma");
        });
        if (varomaDb) {
          const translation = pickTranslation(
            varomaDb.kitchen_tool_translations || [],
            localeChain,
          );
          const varomaName = translation?.name || "Varoma";
          if (!existingNamesLower.has(varomaName.toLowerCase())) {
            enrichedTools.push({
              name: varomaName,
              imageUrl: varomaDb.image_url || undefined,
            });
            existingNamesLower.add(varomaName.toLowerCase());
          }
        }
      }

      // Check for butterfly whisk (whipping/creaming)
      const usesButterfly = recipeText.includes("whip") ||
        recipeText.includes("cream") || recipeText.includes("batir") ||
        recipeText.includes("montar") || recipeText.includes("butterfly") ||
        recipeText.includes("mariposa");
      if (usesButterfly) {
        const butterflyDb = dbTools.find((dbTool) => {
          const names = (dbTool.kitchen_tool_translations || [])
            .map((t) => t.name?.toLowerCase() || "")
            .join(" ");
          return names.includes("butterfly") || names.includes("mariposa");
        });
        if (butterflyDb) {
          const translation = pickTranslation(
            butterflyDb.kitchen_tool_translations || [],
            localeChain,
          );
          const butterflyName = translation?.name || "Butterfly Whisk";
          if (!existingNamesLower.has(butterflyName.toLowerCase())) {
            enrichedTools.push({
              name: butterflyName,
              imageUrl: butterflyDb.image_url || undefined,
            });
            existingNamesLower.add(butterflyName.toLowerCase());
          }
        }
      }
    }

    // 3. Deduplicate by name (case-insensitive), keeping the first occurrence
    const seen = new Set<string>();
    const deduped = enrichedTools.filter((tool) => {
      const key = tool.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 4. Sanity cap at 8 tools
    const result = deduped.slice(0, 8);

    console.log(
      "[Kitchen Tools] Enriched tools:",
      result.map((t) => t.name),
    );
    return result;
  } catch (error) {
    console.error("[Kitchen Tools] Error enriching kitchen tools:", error);
    // Fallback: return LLM tools without enrichment
    return (recipe.kitchenTools || []).map((t) => ({
      name: t.name,
      notes: t.notes || undefined,
    }));
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
    thermomixMode?: string | null;
    tip?: string | null;
  }>,
): Array<{
  order: number;
  instruction: string;
  thermomixTime?: number | null;
  thermomixTemp?: string | null;
  thermomixSpeed?: string | null;
  thermomixMode?: string | null;
  tip?: string | null;
}> {
  return steps.map((step) => {
    // Skip if no Thermomix params (check for both null and undefined)
    if (
      step.thermomixTime == null &&
      step.thermomixTemp == null &&
      step.thermomixSpeed == null &&
      step.thermomixMode == null
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

    // Validate cooking mode (must be a known mode string)
    if (step.thermomixMode != null) {
      if (
        !(VALID_THERMOMIX_MODES as readonly string[]).includes(
          step.thermomixMode,
        )
      ) {
        console.warn(
          `Invalid Thermomix mode for step ${step.order}: ${step.thermomixMode}. Removing.`,
        );
        validated.thermomixMode = undefined;
      }
    }

    // High temperature (browning) mode has NO speed — force null
    if (validated.thermomixMode === "high_temperature") {
      if (validated.thermomixSpeed != null) {
        console.warn(
          `Step ${step.order}: high_temperature mode has no speed setting. Forcing speed to null.`,
        );
        validated.thermomixSpeed = undefined;
      }
    }

    // Pair completion: time + speed must appear together (skip for high_temperature which has no speed)
    const hasTime = validated.thermomixTime != null;
    const hasSpeed = validated.thermomixSpeed != null;
    if (validated.thermomixMode === "high_temperature") {
      // high_temperature only needs time, no speed
    } else if (hasTime && !hasSpeed) {
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
