/**
 * Nutritional Utilities
 *
 * Shared utility functions for nutritional data processing used by
 * get-nutritional-facts edge function and other consumers.
 *
 * All 7 macros per 100g (matches ingredient_nutrition columns):
 *   calories, protein, fat, carbohydrates, fiber, sugar, sodium.
 */

export interface NutritionalData {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

/**
 * Applies standardized rounding rules to nutritional data:
 * - Calories: whole numbers
 * - Protein, fat, carbs, fiber, sugar: 1 decimal place
 * - Sodium (mg): whole numbers
 */
export function applyRoundingRulesToData(data: NutritionalData): void {
  data.calories = Math.round(data.calories);
  data.protein = Number(data.protein.toFixed(1));
  data.fat = Number(data.fat.toFixed(1));
  data.carbohydrates = Number(data.carbohydrates.toFixed(1));
  data.fiber = Number(data.fiber.toFixed(1));
  data.sugar = Number(data.sugar.toFixed(1));
  data.sodium = Math.round(data.sodium);
}

export function validateNutritionalData(
  data: unknown,
): data is NutritionalData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.calories === "number" &&
    typeof d.protein === "number" &&
    typeof d.fat === "number" &&
    typeof d.carbohydrates === "number" &&
    typeof d.fiber === "number" &&
    typeof d.sugar === "number" &&
    typeof d.sodium === "number"
  );
}

/**
 * Converts nutritional values from a given portion size to per 100g.
 */
export function convertToPer100g(
  data: NutritionalData,
  currentPortionSize: number,
): void {
  if (currentPortionSize <= 0) {
    throw new Error(
      `Invalid portion size: ${currentPortionSize}. Must be greater than 0.`,
    );
  }
  const f = 100 / currentPortionSize;
  data.calories *= f;
  data.protein *= f;
  data.fat *= f;
  data.carbohydrates *= f;
  data.fiber *= f;
  data.sugar *= f;
  data.sodium *= f;
}
