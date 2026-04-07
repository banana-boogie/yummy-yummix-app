/**
 * Custom Recipe Generation Tool — Orchestrator
 *
 * Generates a personalized recipe based on user-provided ingredients,
 * preferences, and constraints. Validates safety and allergens.
 *
 * Pipeline: params validation → allergen check → LLM call → Thermomix validation
 *   → post-gen allergen scan → partial SSE emit → enrichment → safety check → result
 *
 * Implementation is split across focused modules in ./recipe-generation/:
 *   - types.ts             — Interfaces (GenerateRecipeResult, AIUsageLogContext, etc.)
 *   - tool-definition.ts   — OpenAI function calling tool definition
 *   - allergen-checks.ts   — Allergen detection and prompt building
 *   - prompts.ts           — System/user prompt construction and JSON schema
 *   - ai-call.ts           — AI Gateway call with retry and response parsing
 *   - thermomix-validation.ts — Thermomix parameter validation/sanitization
 *   - enrichment.ts        — Ingredient images and kitchen tool matching
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { UserContext } from "../irmixy-schemas.ts";
import { validateGenerateRecipeParams } from "./tool-validators.ts";
import { buildSafetyReminders, checkRecipeSafety } from "../food-safety.ts";
import type { CostContext } from "../ai-gateway/types.ts";
import { getBaseLanguage } from "../locale-utils.ts";
import { hasThermomix } from "../equipment-utils.ts";

// Import from submodules
import {
  buildAllergenPromptSection,
  checkIngredientsForAllergens,
} from "./recipe-generation/allergen-checks.ts";
import { callRecipeGenerationAI } from "./recipe-generation/ai-call.ts";
import { validateThermomixSteps } from "./recipe-generation/thermomix-validation.ts";
import {
  enrichIngredientsWithImages,
  enrichKitchenTools,
} from "./recipe-generation/enrichment.ts";
import type {
  AIUsageLogContext,
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "./recipe-generation/types.ts";

// ============================================================
// Re-exports — preserve the public API surface
// ============================================================

// Re-export everything from submodules so existing importers
// (tool-registry, execute-tool, modify-recipe, eval runners, tests)
// continue to work without changing their import paths.
export type {
  AIUsageLogContext,
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "./recipe-generation/types.ts";

export {
  generateCustomRecipeTool,
} from "./recipe-generation/tool-definition.ts";

export {
  buildAllergenPromptSection,
  checkIngredientsForAllergens,
} from "./recipe-generation/allergen-checks.ts";

export {
  buildRecipeGenerationPrompt,
  buildRecipeJsonSchema,
  getSystemPrompt,
} from "./recipe-generation/prompts.ts";

export {
  callRecipeGenerationAI,
  parseAndValidateGeneratedRecipe,
} from "./recipe-generation/ai-call.ts";

export {
  parseThermomixSpeed,
  TEMP_REGEX,
  VALID_NUMERIC_SPEEDS,
  VALID_SPECIAL_SPEEDS,
  VALID_SPECIAL_TEMPS,
  validateThermomixSteps,
} from "./recipe-generation/thermomix-validation.ts";

export {
  clearKitchenToolsCache,
  enrichIngredientsWithImages,
  enrichKitchenTools,
  fuzzyMatchToolName,
} from "./recipe-generation/enrichment.ts";

// ============================================================
// Main Orchestrator
// ============================================================

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
