/**
 * Step Ingredient Resolver
 *
 * Resolves parsed step-level ingredient references to DB rows.
 */

import type { RecipeStepIngredientInsert } from './db.ts';
import {
  type DbIngredient,
  type DbMeasurementUnit,
  matchIngredient,
  matchMeasurementUnit,
} from './entity-matcher.ts';
import type { ParsedRecipeData } from './recipe-parser.ts';

export interface UnresolvedStepIngredient {
  reason: 'missing_step_mapping' | 'ingredient_not_found';
  stepOrder: number;
  ingredientNameEn: string;
  ingredientNameEs: string;
}

export interface StepIngredientResolutionResult {
  items: RecipeStepIngredientInsert[];
  unresolved: UnresolvedStepIngredient[];
}

export function resolveStepIngredients(
  recipeId: string,
  parsed: ParsedRecipeData,
  insertedSteps: Array<{ id: string; order: number }>,
  ingredientMap: Map<string, DbIngredient>,
  allIngredients: DbIngredient[],
  allUnits: DbMeasurementUnit[],
): StepIngredientResolutionResult {
  const stepOrderToId = new Map(insertedSteps.map((s) => [s.order, s.id]));
  const items: RecipeStepIngredientInsert[] = [];
  const unresolved: UnresolvedStepIngredient[] = [];

  for (const step of parsed.steps) {
    const stepId = stepOrderToId.get(step.order);
    if (!stepId) {
      for (const ing of step.ingredients ?? []) {
        unresolved.push({
          reason: 'missing_step_mapping',
          stepOrder: step.order,
          ingredientNameEn: ing.ingredient.nameEn,
          ingredientNameEs: ing.ingredient.nameEs,
        });
      }
      continue;
    }

    for (const ing of step.ingredients ?? []) {
      let dbIngredient: DbIngredient | null =
        ingredientMap.get(ing.ingredient.nameEn.toLowerCase()) ||
        ingredientMap.get(ing.ingredient.nameEs.toLowerCase()) ||
        null;

      // Fallback to fuzzy matcher to avoid dropping links due naming variation.
      if (!dbIngredient) {
        dbIngredient = matchIngredient(ing.ingredient, allIngredients);
        if (dbIngredient) {
          ingredientMap.set(ing.ingredient.nameEn.toLowerCase(), dbIngredient);
          ingredientMap.set(ing.ingredient.nameEs.toLowerCase(), dbIngredient);
        }
      }

      if (!dbIngredient) {
        unresolved.push({
          reason: 'ingredient_not_found',
          stepOrder: step.order,
          ingredientNameEn: ing.ingredient.nameEn,
          ingredientNameEs: ing.ingredient.nameEs,
        });
        continue;
      }

      const unit = matchMeasurementUnit(ing.measurementUnitID, allUnits);
      items.push({
        recipe_id: recipeId,
        recipe_step_id: stepId,
        ingredient_id: dbIngredient.id,
        measurement_unit_id: unit?.id || null,
        quantity: ing.quantity,
        display_order: ing.displayOrder,
        optional: false,
      });
    }
  }

  return { items, unresolved };
}
