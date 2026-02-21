/**
 * Recipe Modification Tool
 *
 * Modifies a previously generated recipe based on user requests.
 * Receives the full previous recipe as structured input from conversation history,
 * uses a fast model (gpt-4.1-mini via recipe_modification usage type),
 * and produces accurate modifications in ~8-12 seconds.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  GeneratedRecipe,
  GeneratedRecipeSchema,
  UserContext,
} from "../irmixy-schemas.ts";
import {
  ModifyRecipeParams,
  validateModifyRecipeParams,
} from "./tool-validators.ts";
import { ToolValidationError } from "./tool-validators.ts";
import {
  buildRecipeJsonSchema,
  checkIngredientsForAllergens,
  enrichIngredientsWithImages,
  GenerateRecipeResult,
  getRelevantUsefulItems,
  getSystemPrompt,
  parseAndValidateGeneratedRecipe,
  PartialRecipeCallback,
  validateThermomixSteps,
  validateThermomixUsage,
} from "./generate-custom-recipe.ts";
import { checkRecipeSafety } from "../food-safety.ts";
import { chat } from "../ai-gateway/index.ts";
import { hasThermomix } from "../equipment-utils.ts";

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const modifyRecipeTool = {
  type: "function" as const,
  function: {
    name: "modify_recipe",
    description:
      "Modify a previously generated recipe. Use when the user wants to change, adjust, or tweak " +
      "a recipe that was just created (e.g. 'make it for 6', 'without nuts', 'make it spicier'). " +
      "The original recipe is automatically extracted from conversation history.",
    parameters: {
      type: "object",
      properties: {
        modificationRequest: {
          type: "string",
          description:
            'What to change (e.g., "make it for 6", "remove nuts", "make it spicier")',
        },
      },
      required: ["modificationRequest"],
    },
  },
};

// ============================================================
// Recipe Extraction from History
// ============================================================

/**
 * Extract the most recent generated recipe from conversation history.
 * Walks history in reverse, finds most recent metadata.customRecipe.
 */
export function extractLastRecipeFromHistory(
  conversationHistory: Array<{
    role: string;
    content: string;
    // deno-lint-ignore no-explicit-any
    metadata?: any;
  }>,
): GeneratedRecipe {
  // Walk history in reverse to find the most recent recipe
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (msg.metadata?.customRecipe) {
      const result = GeneratedRecipeSchema.safeParse(msg.metadata.customRecipe);
      if (result.success) {
        return result.data;
      }
      console.warn(
        "[ModifyRecipe] Found customRecipe in history but validation failed:",
        result.error.issues,
      );
    }
  }

  throw new ToolValidationError(
    "No previously generated recipe found in this conversation. " +
      "Ask the user what recipe they'd like to create or modify.",
  );
}

// ============================================================
// Modification System Prompt
// ============================================================

/**
 * Build the system prompt for recipe modification.
 * Focused on transformation, not creation from scratch.
 */
export function getModificationSystemPrompt(userContext: UserContext): string {
  const basePrompt = getSystemPrompt(userContext);

  const modificationRules = `

MODIFICATION MODE:
You are modifying an existing recipe, NOT creating one from scratch.
- Only change what the modification asks for. Keep everything else the same.
- When scaling portions, adjust ALL ingredient quantities proportionally.
- When removing an ingredient, update steps that reference it.
- When adding an ingredient, add it to the ingredients list and update relevant steps.
- Ensure the recipe name accurately describes the modified dish.
- Preserve Thermomix parameters; adjust only if the modification requires it.
- Return the COMPLETE modified recipe as JSON, same schema as the original.`;

  return basePrompt + modificationRules;
}

// ============================================================
// Modification User Prompt
// ============================================================

/**
 * Build the user prompt with the original recipe and modification request.
 */
export function buildModificationPrompt(
  originalRecipe: GeneratedRecipe,
  params: ModifyRecipeParams,
  userContext: UserContext,
): string {
  const parts: string[] = [];

  parts.push("ORIGINAL RECIPE:");
  parts.push(JSON.stringify(originalRecipe, null, 2));

  parts.push(`\nMODIFICATION REQUEST:\n${params.modificationRequest}`);

  // Hard requirements
  if (userContext.ingredientDislikes.length > 0) {
    parts.push(
      `\n⚠️ MUST AVOID: ${userContext.ingredientDislikes.join(", ")}`,
    );
  }

  // Diet constraints
  if (userContext.dietTypes.length > 0) {
    const validDietTypes = userContext.dietTypes.filter(
      (d) => d !== "none" && d !== "other",
    );
    if (validDietTypes.length > 0) {
      parts.push(`🥗 User follows: ${validDietTypes.join(", ")}`);
    }
  }

  return parts.join("\n");
}

// ============================================================
// Core Modification Function
// ============================================================

/**
 * Modify an existing recipe using AI.
 * Extracts previous recipe from conversation history, applies modification,
 * validates, and enriches.
 */
export async function modifyRecipe(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
  onPartialRecipe?: PartialRecipeCallback,
): Promise<GenerateRecipeResult> {
  const timings: Record<string, number> = {};
  const totalStart = performance.now();
  let phaseStart = totalStart;

  // Validate params
  const params = validateModifyRecipeParams(rawParams);

  // Extract the previous recipe from conversation history
  const originalRecipe = extractLastRecipeFromHistory(
    userContext.conversationHistory,
  );
  console.log("[ModifyRecipe] Found original recipe:", {
    name: originalRecipe.suggestedName,
    portions: originalRecipe.portions,
    ingredientCount: originalRecipe.ingredients.length,
    stepCount: originalRecipe.steps.length,
  });
  timings.extraction_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Call LLM for modification
  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);
  const recipeSchema = buildRecipeJsonSchema(isThermomixUser);
  const systemPrompt = getModificationSystemPrompt(userContext);
  const userPrompt = buildModificationPrompt(
    originalRecipe,
    params,
    userContext,
  );

  const strictRetryPromptSuffix =
    "\n\nCRITICAL: Return ONLY raw JSON. No markdown, no code fences, no explanation text.";

  let lastError: Error | null = null;
  let recipe: GeneratedRecipe | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const isRetry = attempt === 1;
    const response = await chat({
      usageType: "recipe_modification",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: isRetry ? userPrompt + strictRetryPromptSuffix : userPrompt,
        },
      ],
      maxTokens: 6144,
      responseFormat: {
        type: "json_schema",
        schema: recipeSchema,
      },
    });

    try {
      recipe = parseAndValidateGeneratedRecipe(response.content);
      break;
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error("Recipe parsing failed");
      if (!isRetry) {
        console.warn(
          "[ModifyRecipe] First parse/validation attempt failed, retrying once",
          { error: lastError.message },
        );
      }
    }
  }

  if (!recipe) {
    throw lastError || new Error("Modified recipe does not match schema");
  }

  timings.recipe_llm_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Validate Thermomix parameters
  recipe.steps = validateThermomixSteps(recipe.steps);
  validateThermomixUsage(recipe, isThermomixUser);
  timings.thermomix_validation_ms = Math.round(performance.now() - phaseStart);
  phaseStart = performance.now();

  // Two-phase SSE: emit partial recipe before enrichment
  if (onPartialRecipe) {
    onPartialRecipe(recipe);
    console.log("[ModifyRecipe] Partial recipe emitted, starting enrichment");
  }

  // Run allergen check on MODIFIED recipe's ingredients (not original)
  const modifiedIngredientNames = recipe.ingredients.map((i) => i.name);

  // Run enrichment, allergen check, and safety check in parallel
  const [enrichedIngredients, usefulItems, allergenCheck, safetyCheck] =
    await Promise.all([
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
      checkIngredientsForAllergens(
        supabase,
        modifiedIngredientNames,
        userContext.dietaryRestrictions,
        userContext.customAllergies,
        userContext.language,
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
  console.log("[ModifyRecipe Timings]", JSON.stringify(timings));

  // Build safety flags from modified recipe checks
  const warningMessages: string[] = [];
  if (!allergenCheck.safe && allergenCheck.warning) {
    warningMessages.push(allergenCheck.warning);
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
