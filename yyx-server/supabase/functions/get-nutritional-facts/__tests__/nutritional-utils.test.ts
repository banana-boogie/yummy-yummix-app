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
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  applyRoundingRulesToData,
  convertToPer100g,
  type NutritionalData,
  validateNutritionalData,
} from "../../_shared/nutritional-utils.ts";

function makeData(overrides: Partial<NutritionalData> = {}): NutritionalData {
  return {
    calories: 100,
    protein: 10,
    fat: 5,
    carbohydrates: 30,
    fiber: 2,
    sugar: 1,
    sodium: 50,
    ...overrides,
  };
}

// ============================================================
// ROUNDING RULES TESTS
// ============================================================

Deno.test("applyRoundingRulesToData - rounds calories to whole numbers", () => {
  const data = makeData({ calories: 256.7 });
  applyRoundingRulesToData(data);
  assertEquals(data.calories, 257);
});

Deno.test("applyRoundingRulesToData - rounds protein to 1 decimal", () => {
  const data = makeData({ protein: 10.567 });
  applyRoundingRulesToData(data);
  assertEquals(data.protein, 10.6);
});

Deno.test("applyRoundingRulesToData - rounds fat to 1 decimal", () => {
  const data = makeData({ fat: 5.234 });
  applyRoundingRulesToData(data);
  assertEquals(data.fat, 5.2);
});

Deno.test("applyRoundingRulesToData - rounds carbohydrates to 1 decimal", () => {
  const data = makeData({ carbohydrates: 30.789 });
  applyRoundingRulesToData(data);
  assertEquals(data.carbohydrates, 30.8);
});

Deno.test("applyRoundingRulesToData - rounds fiber and sugar to 1 decimal", () => {
  const data = makeData({ fiber: 3.456, sugar: 7.891 });
  applyRoundingRulesToData(data);
  assertEquals(data.fiber, 3.5);
  assertEquals(data.sugar, 7.9);
});

Deno.test("applyRoundingRulesToData - rounds sodium to whole mg", () => {
  const data = makeData({ sodium: 123.6 });
  applyRoundingRulesToData(data);
  assertEquals(data.sodium, 124);
});

Deno.test("applyRoundingRulesToData - handles very small values", () => {
  const data = makeData({
    calories: 0.4,
    protein: 0.04,
    fat: 0.05,
    carbohydrates: 0.049,
    fiber: 0.03,
    sugar: 0.01,
    sodium: 0.4,
  });
  applyRoundingRulesToData(data);
  assertEquals(data.calories, 0);
  assertEquals(data.protein, 0);
  assertEquals(data.fat, 0.1);
  assertEquals(data.carbohydrates, 0);
  assertEquals(data.fiber, 0);
  assertEquals(data.sugar, 0);
  assertEquals(data.sodium, 0);
});

Deno.test("applyRoundingRulesToData - preserves zero values", () => {
  const data = makeData({
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrates: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });
  applyRoundingRulesToData(data);
  assertEquals(data.calories, 0);
  assertEquals(data.sodium, 0);
});

// ============================================================
// VALIDATION TESTS
// ============================================================

Deno.test("validateNutritionalData - returns true for valid 7-macro data", () => {
  assertEquals(validateNutritionalData(makeData()), true);
});

Deno.test("validateNutritionalData - returns false for null/undefined/non-object", () => {
  assertEquals(validateNutritionalData(null), false);
  assertEquals(validateNutritionalData(undefined), false);
  assertEquals(validateNutritionalData("x"), false);
  assertEquals(validateNutritionalData(123), false);
  assertEquals(validateNutritionalData([]), false);
});

Deno.test("validateNutritionalData - returns false when any macro missing", () => {
  for (
    const key of [
      "calories",
      "protein",
      "fat",
      "carbohydrates",
      "fiber",
      "sugar",
      "sodium",
    ] as const
  ) {
    const data: Record<string, number> = { ...makeData() };
    delete data[key];
    assertEquals(validateNutritionalData(data), false, `missing ${key}`);
  }
});

Deno.test("validateNutritionalData - returns false when field is wrong type", () => {
  assertEquals(
    validateNutritionalData({ ...makeData(), calories: "100" }),
    false,
  );
  assertEquals(validateNutritionalData({ ...makeData(), sodium: null }), false);
});

Deno.test("validateNutritionalData - accepts zero and decimal values", () => {
  assertEquals(
    validateNutritionalData(makeData({ calories: 0, protein: 0.1 })),
    true,
  );
});

// ============================================================
// CONVERSION TESTS
// ============================================================

Deno.test("convertToPer100g - throws on zero or negative portion size", () => {
  assertThrows(
    () => convertToPer100g(makeData(), 0),
    Error,
    "Invalid portion size",
  );
  assertThrows(
    () => convertToPer100g(makeData(), -50),
    Error,
    "Invalid portion size",
  );
});

Deno.test("convertToPer100g - converts 200g portion to 100g", () => {
  const data = makeData({
    calories: 400,
    protein: 20,
    fat: 10,
    carbohydrates: 60,
    fiber: 4,
    sugar: 8,
    sodium: 200,
  });
  convertToPer100g(data, 200);
  assertEquals(data.calories, 200);
  assertEquals(data.protein, 10);
  assertEquals(data.fat, 5);
  assertEquals(data.carbohydrates, 30);
  assertEquals(data.fiber, 2);
  assertEquals(data.sugar, 4);
  assertEquals(data.sodium, 100);
});

Deno.test("convertToPer100g - 100g portion stays the same", () => {
  const data = makeData();
  const before = { ...data };
  convertToPer100g(data, 100);
  assertEquals(data, before);
});

// ============================================================
// INTEGRATION
// ============================================================

Deno.test("full processing pipeline - validate, convert, and round", () => {
  const rawData = makeData({
    calories: 180.6,
    protein: 9.234,
    fat: 4.567,
    carbohydrates: 27.891,
    fiber: 3.21,
    sugar: 5.678,
    sodium: 150.4,
  });
  assertEquals(validateNutritionalData(rawData), true);
  convertToPer100g(rawData, 150);
  applyRoundingRulesToData(rawData);
  assertEquals(rawData.calories, 120);
  assertEquals(rawData.protein, 6.2);
  assertEquals(rawData.fat, 3);
  assertEquals(rawData.carbohydrates, 18.6);
  assertEquals(rawData.fiber, 2.1);
  assertEquals(rawData.sugar, 3.8);
  assertEquals(rawData.sodium, 100);
});
