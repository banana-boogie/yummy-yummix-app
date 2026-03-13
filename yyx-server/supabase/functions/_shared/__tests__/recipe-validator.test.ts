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

// Helper to build a valid recipe with translations format
function validRecipe(overrides: Record<string, unknown> = {}) {
  return {
    difficulty: "easy",
    translations: [{ locale: "en", name: "Test Recipe" }],
    ingredients: [
      {
        quantity: 100,
        ingredient: {
          translations: [{ locale: "en", name: "Flour" }],
        },
      },
    ],
    steps: [
      {
        order: 1,
        translations: [{ locale: "en", instruction: "Mix ingredients" }],
      },
    ],
    ...overrides,
  };
}

// ============================================================
// validateRecipeData Tests
// ============================================================

Deno.test("validateRecipeData - valid recipe returns valid: true", () => {
  const result = validateRecipeData(validRecipe());

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateRecipeData - missing translations returns error", () => {
  const recipe = validRecipe({ translations: [] });

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("translation")), true);
});

Deno.test("validateRecipeData - translations without name returns error", () => {
  const recipe = validRecipe({
    translations: [{ locale: "en" }], // no name
  });

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("name")), true);
});

Deno.test("validateRecipeData - missing difficulty returns error", () => {
  const recipe = validRecipe();
  delete (recipe as any).difficulty;

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("difficulty")), true);
});

Deno.test("validateRecipeData - invalid difficulty value returns error", () => {
  const result = validateRecipeData(validRecipe({ difficulty: "super_hard" }));

  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) =>
      e.includes("easy") || e.includes("medium") || e.includes("hard")
    ),
    true,
  );
});

Deno.test("validateRecipeData - empty ingredients array returns error", () => {
  const result = validateRecipeData(validRecipe({ ingredients: [] }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("ingredient")), true);
});

Deno.test("validateRecipeData - empty steps array returns error", () => {
  const result = validateRecipeData(validRecipe({ steps: [] }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("step")), true);
});

Deno.test("validateRecipeData - ingredient without quantity returns error", () => {
  const result = validateRecipeData(validRecipe({
    ingredients: [
      {
        ingredient: {
          translations: [{ locale: "en", name: "Flour" }],
        },
        // Missing quantity
      },
    ],
  }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("quantity")), true);
});

Deno.test("validateRecipeData - step without instruction returns error", () => {
  const result = validateRecipeData(validRecipe({
    steps: [
      {
        order: 1,
        translations: [{ locale: "en" }], // No instruction
      },
    ],
  }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("instruction")), true);
});

Deno.test("validateRecipeData - step without translations returns error", () => {
  const result = validateRecipeData(validRecipe({
    steps: [{ order: 1 }],
  }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("translation")), true);
});

Deno.test("validateRecipeData - ingredient without translations returns error", () => {
  const result = validateRecipeData(validRecipe({
    ingredients: [
      { quantity: 1, ingredient: {} },
    ],
  }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("translation")), true);
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

Deno.test("validateRecipeData - accepts multilingual translations", () => {
  const result = validateRecipeData(validRecipe({
    translations: [
      { locale: "en", name: "English Name" },
      { locale: "es", name: "Nombre en Español" },
    ],
  }));

  assertEquals(result.valid, true);
});

// ============================================================
// normalizeRecipeData Tests
// ============================================================

Deno.test("normalizeRecipeData - sets default values for missing fields", () => {
  const input = {
    translations: [{ locale: "en", name: "Test Recipe" }],
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.name, "Test Recipe"); // Derived from translations
  assertEquals(result.portions, 4);
  assertEquals(result.prep_time, 0);
  assertEquals(result.total_time, 0);
  assertEquals(Array.isArray(result.translations), true);
});

Deno.test("normalizeRecipeData - preserves existing values", () => {
  const input = {
    translations: [
      { locale: "en", name: "My Recipe EN" },
      { locale: "es", name: "Mi Receta" },
    ],
    difficulty: "hard",
    portions: 6,
    prep_time: 15,
    total_time: 45,
    ingredients: [
      {
        quantity: 1,
        ingredient: {
          translations: [{ locale: "en", name: "Salt" }],
        },
      },
    ],
    steps: [
      {
        order: 1,
        translations: [{ locale: "en", instruction: "Add salt" }],
      },
    ],
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.name, "My Recipe EN"); // Derived from first translation
  assertEquals(result.difficulty, "hard");
  assertEquals(result.portions, 6);
  assertEquals(result.prep_time, 15);
  assertEquals(result.total_time, 45);
  assertEquals(
    (result.translations as any[]).length,
    2,
  );
});

Deno.test("normalizeRecipeData - converts string numbers to numbers", () => {
  const input = {
    translations: [{ locale: "en", name: "Test Recipe" }],
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

Deno.test("normalizeRecipeData - derives name from translations", () => {
  const input = {
    translations: [{ locale: "es", name: "Nombre en Español" }],
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.name, "Nombre en Español");
});

Deno.test("normalizeRecipeData - ensures arrays are arrays", () => {
  const input = {
    translations: [{ locale: "en", name: "Test Recipe" }],
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
    translations: [{ locale: "en", name: "Test Recipe" }],
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
  const result = validateRecipeData(validRecipe({
    steps: [
      {
        order: 1,
        translations: [{ locale: "en", instruction: "Mix ingredients" }],
        thermomix_time: 60,
        thermomix_speed: 5,
        thermomix_temperature: 100,
        thermomix_is_blade_reversed: false,
      },
    ],
  }));

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateRecipeData - accepts step with null Thermomix values", () => {
  const result = validateRecipeData(validRecipe({
    steps: [
      {
        order: 1,
        translations: [{ locale: "en", instruction: "Add salt" }],
        thermomix_time: null,
        thermomix_speed: null,
        thermomix_temperature: null,
        thermomix_is_blade_reversed: null,
      },
    ],
  }));

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts Varoma temperature as string", () => {
  const result = validateRecipeData(validRecipe({
    steps: [
      {
        order: 1,
        translations: [{ locale: "en", instruction: "Steam vegetables" }],
        thermomix_temperature: "Varoma",
      },
    ],
  }));

  assertEquals(result.valid, true);
});

// ============================================================
// NESTED INGREDIENT VALIDATION TESTS
// ============================================================

Deno.test("validateRecipeData - accepts ingredient with full details", () => {
  const result = validateRecipeData(validRecipe({
    ingredients: [
      {
        quantity: 250,
        ingredient: {
          translations: [
            { locale: "en", name: "All-purpose flour", plural_name: "All-purpose flour" },
            { locale: "es", name: "Harina de trigo", plural_name: "Harina de trigo" },
          ],
        },
        measurement_unit: {
          id: "g",
          type: "weight",
          system: "metric",
          translations: [{ locale: "en", name: "gram", symbol: "g" }],
        },
        translations: [
          { locale: "en", notes: "Sifted" },
          { locale: "es", notes: "Tamizada" },
        ],
        display_order: 1,
        optional: false,
      },
    ],
  }));

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - rejects ingredient with only bare name (no translations)", () => {
  const result = validateRecipeData(validRecipe({
    ingredients: [
      {
        quantity: 1,
        ingredient: { name: "Salt" }, // No translations
      },
    ],
  }));

  assertEquals(result.valid, false);
});

Deno.test("validateRecipeData - ingredient with negative quantity returns error", () => {
  const result = validateRecipeData(validRecipe({
    ingredients: [
      {
        quantity: -5,
        ingredient: {
          translations: [{ locale: "en", name: "Flour" }],
        },
      },
    ],
  }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("negative")), true);
});

Deno.test("validateRecipeData - ingredient with string quantity returns error", () => {
  const result = validateRecipeData(validRecipe({
    ingredients: [
      {
        quantity: "one cup" as unknown as number,
        ingredient: {
          translations: [{ locale: "en", name: "Flour" }],
        },
      },
    ],
  }));

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("quantity")), true);
});

// ============================================================
// STEP ORDERING TESTS
// ============================================================

Deno.test("validateRecipeData - accepts multiple steps in order", () => {
  const result = validateRecipeData(validRecipe({
    steps: [
      { order: 1, translations: [{ locale: "en", instruction: "First step" }] },
      { order: 2, translations: [{ locale: "en", instruction: "Second step" }] },
      { order: 3, translations: [{ locale: "en", instruction: "Third step" }] },
    ],
  }));

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts step with bilingual translations", () => {
  const result = validateRecipeData(validRecipe({
    steps: [
      {
        order: 1,
        translations: [
          { locale: "en", instruction: "Add salt" },
          { locale: "es", instruction: "Añadir sal" },
        ],
      },
    ],
  }));

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - rejects step with only bare instruction (no translations)", () => {
  const result = validateRecipeData(validRecipe({
    steps: [
      {
        order: 1,
        instruction: "Add salt", // No translations
      },
    ],
  }));

  assertEquals(result.valid, false);
});

// ============================================================
// TAGS AND USEFUL ITEMS TESTS
// ============================================================

Deno.test("validateRecipeData - accepts recipe with tags", () => {
  const result = validateRecipeData(validRecipe({
    tags: [
      {
        recipe_tags: {
          id: "tag-1",
          translations: [
            { locale: "en", name: "Vegetarian" },
            { locale: "es", name: "Vegetariano" },
          ],
        },
      },
      {
        recipe_tags: {
          id: "tag-2",
          translations: [
            { locale: "en", name: "Quick" },
            { locale: "es", name: "Rápido" },
          ],
        },
      },
    ],
  }));

  assertEquals(result.valid, true);
});

Deno.test("validateRecipeData - accepts recipe with useful items", () => {
  const result = validateRecipeData(validRecipe({
    useful_items: [
      {
        id: "item-1",
        display_order: 1,
        translations: [{ locale: "en", notes: "For kneading" }],
        useful_item: {
          id: "tool-1",
          translations: [
            { locale: "en", name: "Rolling Pin" },
            { locale: "es", name: "Rodillo" },
          ],
        },
      },
    ],
  }));

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
    image_url: "https://example.com/recipe.jpg",
    difficulty: "hard",
    prep_time: 30,
    total_time: 90,
    portions: 4,
    translations: [
      { locale: "en", name: "Complete Recipe", tips_and_tricks: "Use fresh ingredients" },
      { locale: "es", name: "Receta Completa", tips_and_tricks: "Usa ingredientes frescos" },
    ],
    ingredients: [
      {
        quantity: 500,
        ingredient: {
          translations: [
            { locale: "en", name: "Flour", plural_name: "Flour" },
            { locale: "es", name: "Harina", plural_name: "Harina" },
          ],
        },
        measurement_unit: {
          id: "g",
          translations: [{ locale: "en", symbol: "g" }],
        },
        translations: [
          { locale: "en", notes: "Sifted", recipe_section: "Main" },
          { locale: "es", notes: "Tamizada", recipe_section: "Principal" },
        ],
        display_order: 1,
        optional: false,
      },
    ],
    steps: [
      {
        order: 1,
        translations: [
          { locale: "en", instruction: "Mix flour", recipe_section: "Preparation" },
          { locale: "es", instruction: "Mezcla la harina", recipe_section: "Preparación" },
        ],
        thermomix_time: 30,
        thermomix_speed: 4,
        thermomix_temperature: null,
        thermomix_is_blade_reversed: false,
      },
    ],
    tags: [
      {
        recipe_tags: {
          id: "tag-1",
          translations: [{ locale: "en", name: "Baking" }],
        },
      },
    ],
    useful_items: [
      {
        id: "item-1",
        useful_item: {
          translations: [{ locale: "en", name: "Bowl" }],
        },
      },
    ],
  };

  const result = validateRecipeData(recipe);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

// ============================================================
// NORMALIZATION EDGE CASES
// ============================================================

Deno.test("normalizeRecipeData - falls back to Untitled when no translations", () => {
  const input = {
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.name, "Untitled Recipe");
  assertEquals(Array.isArray(result.translations), true);
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

Deno.test("normalizeRecipeData - preserves translation name as-is", () => {
  const input = {
    translations: [{ locale: "en", name: "  My Recipe  " }],
    difficulty: "easy",
    ingredients: [],
    steps: [],
  };

  const result = normalizeRecipeData(input);

  assertEquals(result.name, "  My Recipe  ");
});

Deno.test("normalizeRecipeData - preserves valid difficulty values", () => {
  const difficulties = ["easy", "medium", "hard"];

  difficulties.forEach((diff) => {
    const result = normalizeRecipeData({
      translations: [{ locale: "en", name: "Test" }],
      difficulty: diff,
      ingredients: [],
      steps: [],
    });

    assertEquals(result.difficulty, diff);
  });
});
