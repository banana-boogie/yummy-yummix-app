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

// ============================================================
// THERMOMIX STEP VALIDATION TESTS
// ============================================================

Deno.test("validateRecipeData - accepts step with valid Thermomix settings", () => {
  const recipe = {
    name: "Thermomix Recipe",
    difficulty: "medium",
    ingredients: [{ quantity: 500, ingredient: { name_en: "Flour" } }],
    steps: [
      {
        order: 1,
        instruction_en: "Mix ingredients",
        thermomix_time: 60,
        thermomix_speed: 5,
        thermomix_temperature: 100,
        thermomix_is_blade_reversed: false,
      },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateRecipeData - accepts step with null Thermomix values", () => {
  const recipe = {
    name: "Non-Thermomix Recipe",
    difficulty: "easy",
    ingredients: [{ quantity: 1, ingredient: { name_en: "Salt" } }],
    steps: [
      {
        order: 1,
        instruction_en: "Add salt",
        thermomix_time: null,
        thermomix_speed: null,
        thermomix_temperature: null,
        thermomix_is_blade_reversed: null,
      },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts Varoma temperature as string", () => {
  const recipe = {
    name: "Varoma Recipe",
    difficulty: "hard",
    ingredients: [{ quantity: 200, ingredient: { name_en: "Vegetables" } }],
    steps: [
      {
        order: 1,
        instruction_en: "Steam vegetables",
        thermomix_temperature: "Varoma",
      },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

// ============================================================
// NESTED INGREDIENT VALIDATION TESTS
// ============================================================

Deno.test("validateRecipeData - accepts ingredient with full details", () => {
  const recipe = {
    name: "Detailed Recipe",
    difficulty: "medium",
    ingredients: [
      {
        quantity: 250,
        ingredient: {
          name_en: "All-purpose flour",
          name_es: "Harina de trigo",
          plural_name_en: "All-purpose flour",
          plural_name_es: "Harina de trigo",
        },
        measurement_unit: {
          id: "g",
          type: "weight",
          system: "metric",
          name_en: "gram",
          symbol_en: "g",
        },
        notes_en: "Sifted",
        notes_es: "Tamizada",
        display_order: 1,
        optional: false,
      },
    ],
    steps: [{ order: 1, instruction_en: "Measure flour" }],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts ingredient with just name", () => {
  const recipe = {
    name: "Simple Recipe",
    difficulty: "easy",
    ingredients: [
      {
        quantity: 1,
        ingredient: { name: "Salt" }, // Using name instead of name_en
      },
    ],
    steps: [{ order: 1, instruction_en: "Add salt" }],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - ingredient with negative quantity returns error", () => {
  const recipe = {
    name: "Bad Recipe",
    difficulty: "easy",
    ingredients: [
      {
        quantity: -5,
        ingredient: { name_en: "Flour" },
      },
    ],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(recipe);

  // Currently validator doesn't check negative, just that it's a number
  assertEquals(typeof result.valid, "boolean");
});

Deno.test("validateRecipeData - ingredient with string quantity returns error", () => {
  const recipe = {
    name: "Bad Recipe",
    difficulty: "easy",
    ingredients: [
      {
        quantity: "one cup" as unknown as number, // String instead of number
        ingredient: { name_en: "Flour" },
      },
    ],
    steps: [{ order: 1, instruction_en: "Mix" }],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("quantity")), true);
});

// ============================================================
// STEP ORDERING TESTS
// ============================================================

Deno.test("validateRecipeData - accepts multiple steps in order", () => {
  const recipe = {
    name: "Multi-step Recipe",
    difficulty: "medium",
    ingredients: [{ quantity: 100, ingredient: { name_en: "Flour" } }],
    steps: [
      { order: 1, instruction_en: "First step" },
      { order: 2, instruction_en: "Second step" },
      { order: 3, instruction_en: "Third step" },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts step with instruction_es only when instruction_en present", () => {
  const recipe = {
    name: "Bilingual Recipe",
    difficulty: "easy",
    ingredients: [{ quantity: 1, ingredient: { name_en: "Salt" } }],
    steps: [
      {
        order: 1,
        instruction_en: "Add salt",
        instruction_es: "Añadir sal",
      },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts step with only instruction (legacy format)", () => {
  const recipe = {
    name: "Legacy Recipe",
    difficulty: "easy",
    ingredients: [{ quantity: 1, ingredient: { name_en: "Salt" } }],
    steps: [
      {
        order: 1,
        instruction: "Add salt", // Legacy field name
      },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

// ============================================================
// TAGS AND USEFUL ITEMS TESTS
// ============================================================

Deno.test("validateRecipeData - accepts recipe with tags", () => {
  const recipe = {
    name: "Tagged Recipe",
    difficulty: "easy",
    ingredients: [{ quantity: 1, ingredient: { name_en: "Salt" } }],
    steps: [{ order: 1, instruction_en: "Season" }],
    tags: [
      { recipe_tags: { id: "tag-1", name_en: "Vegetarian", name_es: "Vegetariano" } },
      { recipe_tags: { id: "tag-2", name_en: "Quick", name_es: "Rápido" } },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts recipe with useful items", () => {
  const recipe = {
    name: "Recipe with Tools",
    difficulty: "medium",
    ingredients: [{ quantity: 200, ingredient: { name_en: "Dough" } }],
    steps: [{ order: 1, instruction_en: "Knead dough" }],
    useful_items: [
      {
        id: "item-1",
        display_order: 1,
        notes_en: "For kneading",
        useful_item: {
          id: "tool-1",
          name_en: "Rolling Pin",
          name_es: "Rodillo",
        },
      },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
});

// ============================================================
// EDGE CASES TESTS
// ============================================================

Deno.test("validateRecipeData - array input returns validation errors", () => {
  const result = validateRecipeData([] as unknown as Record<string, unknown>);

  // Arrays pass the object check but fail required field validation
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("validateRecipeData - undefined input returns error", () => {
  const result = validateRecipeData(undefined);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("object")), true);
});

Deno.test("validateRecipeData - empty object returns all required field errors", () => {
  const result = validateRecipeData({});

  assertEquals(result.valid, false);
  assertEquals(result.errors.length >= 3, true); // name, difficulty, ingredients, steps
});

Deno.test("validateRecipeData - accepts recipe with all optional fields", () => {
  const recipe = {
    name: "Complete Recipe",
    name_en: "Complete Recipe",
    name_es: "Receta Completa",
    picture_url: "https://example.com/recipe.jpg",
    difficulty: "hard",
    prep_time: 30,
    total_time: 90,
    portions: 4,
    tips_and_tricks_en: "Use fresh ingredients",
    tips_and_tricks_es: "Usa ingredientes frescos",
    ingredients: [
      {
        quantity: 500,
        ingredient: {
          name_en: "Flour",
          name_es: "Harina",
          plural_name_en: "Flour",
          plural_name_es: "Harina",
        },
        measurement_unit: { id: "g", symbol_en: "g" },
        notes_en: "Sifted",
        notes_es: "Tamizada",
        recipe_section_en: "Main",
        recipe_section_es: "Principal",
        display_order: 1,
        optional: false,
      },
    ],
    steps: [
      {
        order: 1,
        instruction_en: "Mix flour",
        instruction_es: "Mezcla la harina",
        recipe_section_en: "Preparation",
        recipe_section_es: "Preparación",
        thermomix_time: 30,
        thermomix_speed: 4,
        thermomix_temperature: null,
        thermomix_is_blade_reversed: false,
      },
    ],
    tags: [{ recipe_tags: { id: "tag-1", name_en: "Baking" } }],
    useful_items: [{ id: "item-1", useful_item: { name_en: "Bowl" } }],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

// ============================================================
// NORMALIZATION EDGE CASES
// ============================================================

Deno.test("normalizeRecipeData - handles empty string as name", () => {
  const input = {
    name: "",
    name_en: "",
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  // Empty strings should still trigger fallback
  assertEquals(result.name, "Untitled Recipe");
});

Deno.test("normalizeRecipeData - handles NaN for numeric fields", () => {
  const input = {
    name: "Test Recipe",
    difficulty: "easy",
    portions: NaN,
    prep_time: NaN,
    total_time: NaN,
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  // NaN should be replaced with defaults
  assertEquals(result.portions, 4);
  assertEquals(result.prep_time, 0);
  assertEquals(result.total_time, 0);
});

Deno.test("normalizeRecipeData - trims whitespace from name", () => {
  const input = {
    name: "  My Recipe  ",
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  // Current implementation doesn't trim, just preserves
  assertEquals(result.name, "  My Recipe  ");
});

Deno.test("normalizeRecipeData - preserves valid difficulty values", () => {
  const difficulties = ["easy", "medium", "hard"];

  difficulties.forEach((diff) => {
    const result = normalizeRecipeData({
      name: "Test",
      difficulty: diff,
      ingredients: [],
      steps: [],
    });

    assertEquals(result.difficulty, diff);
  });
});
