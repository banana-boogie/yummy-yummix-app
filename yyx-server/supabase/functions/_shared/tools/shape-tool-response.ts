/**
 * Shared tool response shaping.
 *
 * Both `voice-tool-execute` and `ai-orchestrator` need to convert raw
 * tool results into a common shape.  Centralising the logic here avoids
 * duplication and keeps the two paths in sync when new tools are added.
 */

import type { RecipeCard } from "../irmixy-schemas.ts";
import type { GenerateRecipeResult } from "./generate-custom-recipe.ts";

export interface ShapedToolResponse {
  recipes?: RecipeCard[];
  customRecipe?: GenerateRecipeResult["recipe"];
  safetyFlags?: GenerateRecipeResult["safetyFlags"];
  result?: unknown;
}

export function shapeToolResponse(
  toolName: string,
  result: unknown,
): ShapedToolResponse {
  if (toolName === "search_recipes" && Array.isArray(result)) {
    return { recipes: result };
  }
  if (
    toolName === "generate_custom_recipe" &&
    result &&
    typeof result === "object"
  ) {
    const gen = result as GenerateRecipeResult;
    return { customRecipe: gen.recipe, safetyFlags: gen.safetyFlags };
  }
  return { result };
}
