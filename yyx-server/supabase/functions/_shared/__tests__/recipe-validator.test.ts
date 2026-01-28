/**
 * Recipe Validator Tests
 *
 * Tests for the recipe validation and normalization functions.
 *
 * FOR AI AGENTS:
 * - This is an example of how to write Deno tests for Edge Function utilities
 * - Follow this pattern for testing other _shared modules
 * - Use descriptive test names that explain what is being tested
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeRecipeData,
  validateRecipeData,
} from "../recipe-validator.ts";

// ============================================================
// validateRecipeData Tests
// ============================================================

Deno.test("validateRecipeData - valid recipe returns valid: true", () => {
  const validRecipe = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: [
      {
        quantity: 100,
        ingredient: { name_en: "Flour" },
      },
    ],
    steps: [
      {
        order: 1,
        instruction_en: "Mix ingredients",
      },
    ],
  };

  const result = validateRecipeData(validRecipe);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateRecipeData - missing name returns error", () => {
  const invalidRecipe = {
    difficulty: "easy",
    ingredients: [{ quantity: 100, ingredient: { name_en: "Flour" } }],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("name")), true);
});

Deno.test("validateRecipeData - missing difficulty returns error", () => {
  const invalidRecipe = {
    name: "Test Recipe",
    ingredients: [{ quantity: 100, ingredient: { name_en: "Flour" } }],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("difficulty")), true);
});

Deno.test("validateRecipeData - invalid difficulty value returns error", () => {
  const invalidRecipe = {
    name: "Test Recipe",
    difficulty: "super_hard", // Invalid value
    ingredients: [{ quantity: 100, ingredient: { name_en: "Flour" } }],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) =>
      e.includes("easy") || e.includes("medium") || e.includes("hard")
    ),
    true,
  );
});

Deno.test("validateRecipeData - empty ingredients array returns error", () => {
  const invalidRecipe = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: [],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("ingredient")), true);
});

Deno.test("validateRecipeData - empty steps array returns error", () => {
  const invalidRecipe = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: [{ quantity: 100, ingredient: { name_en: "Flour" } }],
    steps: [],
  };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("step")), true);
});

Deno.test("validateRecipeData - ingredient without quantity returns error", () => {
  const invalidRecipe = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: [
      {
        ingredient: { name_en: "Flour" },
        // Missing quantity
      },
    ],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("quantity")), true);
});

Deno.test("validateRecipeData - step without instruction returns error", () => {
  const invalidRecipe = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: [{ quantity: 100, ingredient: { name_en: "Flour" } }],
    steps: [
      {
        order: 1,
        // Missing instruction_en
      },
    ],
  };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("instruction")), true);
});

Deno.test("validateRecipeData - null input returns error", () => {
  const result = validateRecipeData(null);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("object")), true);
});

Deno.test("validateRecipeData - non-object input returns error", () => {
  const result = validateRecipeData("not an object");

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("object")), true);
});

Deno.test("validateRecipeData - accepts name_en instead of name", () => {
  const recipe = {
    name_en: "Test Recipe", // name_en instead of name
    difficulty: "easy",
    ingredients: [{ quantity: 100, ingredient: { name_en: "Flour" } }],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

// ============================================================
// normalizeRecipeData Tests
// ============================================================

Deno.test("normalizeRecipeData - sets default values for missing fields", () => {
  const input = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  assertExists(result.name);
  assertExists(result.name_en);
  assertEquals(result.portions, 4); // Default value
  assertEquals(result.prep_time, 0); // Default value
  assertEquals(result.total_time, 0); // Default value
});

Deno.test("normalizeRecipeData - preserves existing values", () => {
  const input = {
    name: "My Recipe",
    name_en: "My Recipe EN",
    name_es: "Mi Receta",
    difficulty: "hard",
    portions: 6,
    prep_time: 15,
    total_time: 45,
    ingredients: [{ quantity: 1, ingredient: { name_en: "Salt" } }],
    steps: [{ order: 1, instruction_en: "Add salt" }],
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.name, "My Recipe");
  assertEquals(result.name_en, "My Recipe EN");
  assertEquals(result.name_es, "Mi Receta");
  assertEquals(result.difficulty, "hard");
  assertEquals(result.portions, 6);
  assertEquals(result.prep_time, 15);
  assertEquals(result.total_time, 45);
});

Deno.test("normalizeRecipeData - converts string numbers to numbers", () => {
  const input = {
    name: "Test Recipe",
    difficulty: "easy",
    portions: "4" as unknown as number,
    prep_time: "10" as unknown as number,
    total_time: "30" as unknown as number,
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  assertEquals(typeof result.portions, "number");
  assertEquals(typeof result.prep_time, "number");
  assertEquals(typeof result.total_time, "number");
});

Deno.test("normalizeRecipeData - sets name from name_en if name is missing", () => {
  const input = {
    name_en: "English Name",
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.name, "English Name");
});

Deno.test("normalizeRecipeData - ensures arrays are arrays", () => {
  const input = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: null as unknown as unknown[],
    steps: undefined as unknown as unknown[],
    tags: "not an array" as unknown as unknown[],
    useful_items: null as unknown as unknown[],
  };

  const result = normalizeRecipeData(input);

  assertEquals(Array.isArray(result.ingredients), true);
  assertEquals(Array.isArray(result.steps), true);
  assertEquals(Array.isArray(result.tags), true);
  assertEquals(Array.isArray(result.useful_items), true);
});

Deno.test("normalizeRecipeData - preserves additional fields", () => {
  const input = {
    name: "Test Recipe",
    difficulty: "easy",
    ingredients: [],
    steps: [],
    custom_field: "custom value",
    another_field: 123,
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.custom_field, "custom value");
  assertEquals(result.another_field, 123);
});
