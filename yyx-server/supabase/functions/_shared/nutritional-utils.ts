/**
 * Nutritional Utilities
 *
 * Shared utility functions for nutritional data processing used by
 * get-nutritional-facts edge function and other consumers.
 */

/**
 * Represents nutritional data per 100g of an ingredient
 */
export interface NutritionalData {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
}

/**
 * Applies standardized rounding rules to nutritional data:
 * - Calories: whole numbers (Math.round)
 * - Protein, fat, carbs: 1 decimal place
 *
 * Note: This function mutates the input object in place.
 *
 * @param data - The nutritional data to round (mutated in place)
 */
export function applyRoundingRulesToData(data: NutritionalData): void {
  data.calories = Math.round(data.calories);
  data.protein = Number(data.protein.toFixed(1));
  data.fat = Number(data.fat.toFixed(1));
  data.carbohydrates = Number(data.carbohydrates.toFixed(1));
}

/**
 * Type guard to validate that an unknown value is valid NutritionalData.
 *
 * @param data - The value to validate
 * @returns true if data is valid NutritionalData
 */
export function validateNutritionalData(
  data: unknown,
): data is NutritionalData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as NutritionalData).calories === "number" &&
    typeof (data as NutritionalData).protein === "number" &&
    typeof (data as NutritionalData).fat === "number" &&
    typeof (data as NutritionalData).carbohydrates === "number"
  );
}

/**
 * Converts nutritional values from a given portion size to per 100g.
 *
 * Note: This function mutates the input object in place.
 *
 * @param data - The nutritional data to convert (mutated in place)
 * @param currentPortionSize - The current portion size in grams
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
  const conversionFactor = 100 / currentPortionSize;
  data.calories *= conversionFactor;
  data.protein *= conversionFactor;
  data.fat *= conversionFactor;
  data.carbohydrates *= conversionFactor;
}
