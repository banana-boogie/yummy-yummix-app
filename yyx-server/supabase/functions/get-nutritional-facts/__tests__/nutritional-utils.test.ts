/**
 * Nutritional Utils Tests
 *
 * Tests for nutrition utility functions from _shared/nutritional-utils.ts:
 * - Data validation
 * - Rounding rules
 * - Data normalization
 */

import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  applyRoundingRulesToData,
  convertToPer100g,
  validateNutritionalData,
  type NutritionalData,
} from "../../_shared/nutritional-utils.ts";

// ============================================================
// ROUNDING RULES TESTS
// ============================================================

Deno.test("applyRoundingRulesToData - rounds calories to whole numbers", () => {
  const data: NutritionalData = {
    calories: 256.7,
    protein: 10.0,
    fat: 5.0,
    carbohydrates: 30.0,
  };

  applyRoundingRulesToData(data);

  assertEquals(data.calories, 257);
});

Deno.test("applyRoundingRulesToData - rounds protein to 1 decimal", () => {
  const data: NutritionalData = {
    calories: 100,
    protein: 10.567,
    fat: 5.0,
    carbohydrates: 30.0,
  };

  applyRoundingRulesToData(data);

  assertEquals(data.protein, 10.6);
});

Deno.test("applyRoundingRulesToData - rounds fat to 1 decimal", () => {
  const data: NutritionalData = {
    calories: 100,
    protein: 10.0,
    fat: 5.234,
    carbohydrates: 30.0,
  };

  applyRoundingRulesToData(data);

  assertEquals(data.fat, 5.2);
});

Deno.test("applyRoundingRulesToData - rounds carbohydrates to 1 decimal", () => {
  const data: NutritionalData = {
    calories: 100,
    protein: 10.0,
    fat: 5.0,
    carbohydrates: 30.789,
  };

  applyRoundingRulesToData(data);

  assertEquals(data.carbohydrates, 30.8);
});

Deno.test("applyRoundingRulesToData - handles very small values", () => {
  const data: NutritionalData = {
    calories: 0.4,
    protein: 0.04,
    fat: 0.05,
    carbohydrates: 0.049,
  };

  applyRoundingRulesToData(data);

  assertEquals(data.calories, 0);
  assertEquals(data.protein, 0);
  assertEquals(data.fat, 0.1); // Rounds up
  assertEquals(data.carbohydrates, 0);
});

Deno.test("applyRoundingRulesToData - handles large values", () => {
  const data: NutritionalData = {
    calories: 1234.567,
    protein: 123.456,
    fat: 98.765,
    carbohydrates: 456.789,
  };

  applyRoundingRulesToData(data);

  assertEquals(data.calories, 1235);
  assertEquals(data.protein, 123.5);
  assertEquals(data.fat, 98.8);
  assertEquals(data.carbohydrates, 456.8);
});

Deno.test("applyRoundingRulesToData - preserves zero values", () => {
  const data: NutritionalData = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrates: 0,
  };

  applyRoundingRulesToData(data);

  assertEquals(data.calories, 0);
  assertEquals(data.protein, 0);
  assertEquals(data.fat, 0);
  assertEquals(data.carbohydrates, 0);
});

// ============================================================
// VALIDATION TESTS
// ============================================================

Deno.test("validateNutritionalData - returns true for valid data", () => {
  const data = {
    calories: 100,
    protein: 10,
    fat: 5,
    carbohydrates: 30,
  };

  assertEquals(validateNutritionalData(data), true);
});

Deno.test("validateNutritionalData - returns false for null", () => {
  assertEquals(validateNutritionalData(null), false);
});

Deno.test("validateNutritionalData - returns false for undefined", () => {
  assertEquals(validateNutritionalData(undefined), false);
});

Deno.test("validateNutritionalData - returns false for non-object", () => {
  assertEquals(validateNutritionalData("string"), false);
  assertEquals(validateNutritionalData(123), false);
  assertEquals(validateNutritionalData([]), false);
});

Deno.test("validateNutritionalData - returns false when calories is missing", () => {
  const data = {
    protein: 10,
    fat: 5,
    carbohydrates: 30,
  };

  assertEquals(validateNutritionalData(data), false);
});

Deno.test("validateNutritionalData - returns false when protein is missing", () => {
  const data = {
    calories: 100,
    fat: 5,
    carbohydrates: 30,
  };

  assertEquals(validateNutritionalData(data), false);
});

Deno.test("validateNutritionalData - returns false when fat is missing", () => {
  const data = {
    calories: 100,
    protein: 10,
    carbohydrates: 30,
  };

  assertEquals(validateNutritionalData(data), false);
});

Deno.test("validateNutritionalData - returns false when carbohydrates is missing", () => {
  const data = {
    calories: 100,
    protein: 10,
    fat: 5,
  };

  assertEquals(validateNutritionalData(data), false);
});

Deno.test("validateNutritionalData - returns false when calories is string", () => {
  const data = {
    calories: "100",
    protein: 10,
    fat: 5,
    carbohydrates: 30,
  };

  assertEquals(validateNutritionalData(data), false);
});

Deno.test("validateNutritionalData - returns false when protein is null", () => {
  const data = {
    calories: 100,
    protein: null,
    fat: 5,
    carbohydrates: 30,
  };

  assertEquals(validateNutritionalData(data), false);
});

Deno.test("validateNutritionalData - accepts zero values", () => {
  const data = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrates: 0,
  };

  assertEquals(validateNutritionalData(data), true);
});

Deno.test("validateNutritionalData - accepts decimal values", () => {
  const data = {
    calories: 100.5,
    protein: 10.2,
    fat: 5.8,
    carbohydrates: 30.1,
  };

  assertEquals(validateNutritionalData(data), true);
});

Deno.test("validateNutritionalData - ignores extra fields", () => {
  const data = {
    calories: 100,
    protein: 10,
    fat: 5,
    carbohydrates: 30,
    fiber: 5,
    sodium: 100,
    sugar: 2,
  };

  assertEquals(validateNutritionalData(data), true);
});

// ============================================================
// CONVERSION TESTS
// ============================================================

Deno.test("convertToPer100g - converts 200g portion to 100g", () => {
  const data: NutritionalData = {
    calories: 400,
    protein: 20,
    fat: 10,
    carbohydrates: 60,
  };

  convertToPer100g(data, 200);

  assertEquals(data.calories, 200);
  assertEquals(data.protein, 10);
  assertEquals(data.fat, 5);
  assertEquals(data.carbohydrates, 30);
});

Deno.test("convertToPer100g - converts 50g portion to 100g", () => {
  const data: NutritionalData = {
    calories: 50,
    protein: 5,
    fat: 2.5,
    carbohydrates: 10,
  };

  convertToPer100g(data, 50);

  assertEquals(data.calories, 100);
  assertEquals(data.protein, 10);
  assertEquals(data.fat, 5);
  assertEquals(data.carbohydrates, 20);
});

Deno.test("convertToPer100g - 100g portion stays the same", () => {
  const data: NutritionalData = {
    calories: 100,
    protein: 10,
    fat: 5,
    carbohydrates: 30,
  };

  convertToPer100g(data, 100);

  assertEquals(data.calories, 100);
  assertEquals(data.protein, 10);
  assertEquals(data.fat, 5);
  assertEquals(data.carbohydrates, 30);
});

Deno.test("convertToPer100g - handles non-round portion sizes", () => {
  const data: NutritionalData = {
    calories: 85,
    protein: 8.5,
    fat: 4.25,
    carbohydrates: 25.5,
  };

  convertToPer100g(data, 85);

  assertEquals(data.calories, 100);
  assertEquals(data.protein, 10);
  assertEquals(data.fat, 5);
  assertEquals(data.carbohydrates, 30);
});

// ============================================================
// INTEGRATION TESTS
// ============================================================

Deno.test("full processing pipeline - validate, convert, and round", () => {
  const rawData = {
    calories: 180.6,
    protein: 9.234,
    fat: 4.567,
    carbohydrates: 27.891,
  };

  // Step 1: Validate
  assertEquals(validateNutritionalData(rawData), true);

  // Step 2: Convert (assuming 150g portion)
  convertToPer100g(rawData, 150);

  // Step 3: Round
  applyRoundingRulesToData(rawData);

  // Verify final results
  assertEquals(rawData.calories, 120);
  assertEquals(rawData.protein, 6.2);
  assertEquals(rawData.fat, 3);
  assertEquals(rawData.carbohydrates, 18.6);
});

Deno.test("handles typical USDA response values", () => {
  // Typical values for 100g of raw chicken breast
  const chickenData: NutritionalData = {
    calories: 165.123,
    protein: 31.012,
    fat: 3.567,
    carbohydrates: 0.0,
  };

  applyRoundingRulesToData(chickenData);

  assertEquals(chickenData.calories, 165);
  assertEquals(chickenData.protein, 31);
  assertEquals(chickenData.fat, 3.6);
  assertEquals(chickenData.carbohydrates, 0);
});

Deno.test("handles typical values for high-carb food", () => {
  // Typical values for 100g of white rice
  const riceData: NutritionalData = {
    calories: 130.0,
    protein: 2.7,
    fat: 0.3,
    carbohydrates: 28.2,
  };

  applyRoundingRulesToData(riceData);

  assertEquals(riceData.calories, 130);
  assertEquals(riceData.protein, 2.7);
  assertEquals(riceData.fat, 0.3);
  assertEquals(riceData.carbohydrates, 28.2);
});
