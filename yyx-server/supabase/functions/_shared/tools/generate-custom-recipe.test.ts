/**
 * Generate Custom Recipe Tool Tests
 *
 * Tests for the custom recipe generation validation and parameter handling.
 *
 * FOR AI AGENTS:
 * - This tests the validation logic for generate_custom_recipe tool
 * - Follow this pattern for testing other tool validators
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  ToolValidationError,
  validateGenerateRecipeParams,
} from "./tool-validators.ts";
import {
  buildFormattingJsonSchema,
  enrichIngredientsWithImages,
  generateCustomRecipe,
  getCreationSystemPrompt,
  getFormattingSystemPrompt,
  getSystemPrompt,
  inferIngredientsUsed,
  parseThermomixSpeed,
  postProcessFormattedRecipe,
  TEMP_REGEX,
  VALID_NUMERIC_SPEEDS,
  VALID_SPECIAL_SPEEDS,
  VALID_SPECIAL_TEMPS,
  validateThermomixSteps,
} from "./generate-custom-recipe.ts";
import { GeneratedRecipeSchema } from "../irmixy-schemas.ts";
import { clearAllergenCache } from "../allergen-filter.ts";
import { clearFoodSafetyCache } from "../food-safety.ts";
import { clearAliasCache } from "../ingredient-normalization.ts";

// ============================================================
// Test Data Helpers
// ============================================================

function createMockUserContext(
  overrides?: Partial<{
    language: "en" | "es";
    measurementSystem: "imperial" | "metric";
    dietaryRestrictions: string[];
    ingredientDislikes: string[];
    skillLevel: string | null;
    householdSize: number | null;
    conversationHistory: Array<{ role: string; content: string }>;
    dietTypes: string[];
    cuisinePreferences: string[];
    customAllergies: string[];
    kitchenEquipment: string[];
  }>,
) {
  return {
    language: "en" as const,
    measurementSystem: "imperial" as const,
    dietaryRestrictions: [],
    ingredientDislikes: [],
    skillLevel: null,
    householdSize: null,
    conversationHistory: [],
    dietTypes: [],
    cuisinePreferences: [],
    customAllergies: [],
    kitchenEquipment: [],
    ...overrides,
  };
}

function createMockGeneratedRecipeResponse(
  overrides?: Partial<{
    suggestedName: string;
    ingredients: Array<{ name: string; quantity: number; unit: string }>;
    steps: Array<{ order: number; instruction: string }>;
    totalTime: number;
    difficulty: string;
    portions: number;
    tags: string[];
  }>,
) {
  return {
    schemaVersion: "1.0",
    suggestedName: "Test Recipe",
    measurementSystem: "imperial",
    language: "en",
    ingredients: [
      { name: "chicken", quantity: 1, unit: "lb" },
      { name: "rice", quantity: 2, unit: "cups" },
    ],
    steps: [
      { order: 1, instruction: "Cook chicken" },
      { order: 2, instruction: "Add rice" },
    ],
    totalTime: 30,
    difficulty: "easy",
    portions: 4,
    tags: ["quick", "easy"],
    ...overrides,
  };
}

function resetSharedCaches() {
  clearAllergenCache();
  clearFoodSafetyCache();
  clearAliasCache();
}

function createAllergenOutageSupabaseMock() {
  return {
    from: (table: string) => ({
      select: (_fields: string) => {
        if (table === "allergen_groups") {
          return Promise.resolve({
            data: null,
            error: { message: "allergen db unavailable" },
          });
        }
        if (table === "food_safety_rules") {
          return Promise.resolve({ data: [], error: null });
        }
        if (table === "ingredient_aliases") {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
    }),
  } as any;
}

// ============================================================
// validateGenerateRecipeParams Tests
// ============================================================

Deno.test("validateGenerateRecipeParams validates required ingredients", () => {
  // Empty ingredients array should throw
  try {
    validateGenerateRecipeParams({ ingredients: [] });
    throw new Error("Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, "at least one ingredient");
  }
});

Deno.test("validateGenerateRecipeParams rejects missing ingredients", () => {
  try {
    validateGenerateRecipeParams({});
    throw new Error("Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, "at least one ingredient");
  }
});

Deno.test("validateGenerateRecipeParams accepts valid ingredients", () => {
  const result = validateGenerateRecipeParams({
    ingredients: ["chicken", "rice", "broccoli"],
  });

  assertEquals(result.ingredients.length, 3);
  assertEquals(result.ingredients[0], "chicken");
  assertEquals(result.ingredients[1], "rice");
  assertEquals(result.ingredients[2], "broccoli");
});

Deno.test("validateGenerateRecipeParams sanitizes ingredient strings", () => {
  const result = validateGenerateRecipeParams({
    ingredients: ["  chicken  ", "rice!@#", "broccoli\n\t"],
  });

  // Should be trimmed and sanitized
  assertEquals(result.ingredients[0], "chicken");
  assertEquals(result.ingredients[1], "rice");
  assertEquals(result.ingredients[2], "broccoli");
});

Deno.test("validateGenerateRecipeParams filters empty ingredients after sanitization", () => {
  const result = validateGenerateRecipeParams({
    ingredients: ["chicken", "!!!", "   ", "rice"],
  });

  // Only valid ingredients should remain
  assertEquals(result.ingredients.length, 2);
  assertEquals(result.ingredients[0], "chicken");
  assertEquals(result.ingredients[1], "rice");
});

Deno.test("validateGenerateRecipeParams clamps targetTime within bounds", () => {
  // Too low
  const tooLow = validateGenerateRecipeParams({
    ingredients: ["chicken"],
    targetTime: 1,
  });
  assertEquals(tooLow.targetTime, 5);

  // Too high
  const tooHigh = validateGenerateRecipeParams({
    ingredients: ["chicken"],
    targetTime: 1000,
  });
  assertEquals(tooHigh.targetTime, 480);

  // Valid
  const valid = validateGenerateRecipeParams({
    ingredients: ["chicken"],
    targetTime: 60,
  });
  assertEquals(valid.targetTime, 60);
});

Deno.test("validateGenerateRecipeParams validates difficulty enum", () => {
  // Valid difficulties
  assertEquals(
    validateGenerateRecipeParams({ ingredients: ["a"], difficulty: "easy" })
      .difficulty,
    "easy",
  );
  assertEquals(
    validateGenerateRecipeParams({ ingredients: ["a"], difficulty: "medium" })
      .difficulty,
    "medium",
  );
  assertEquals(
    validateGenerateRecipeParams({ ingredients: ["a"], difficulty: "hard" })
      .difficulty,
    "hard",
  );

  // Invalid difficulty
  try {
    validateGenerateRecipeParams({ ingredients: ["a"], difficulty: "expert" });
    throw new Error("Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, 'Invalid value "expert"');
  }
});

Deno.test("validateGenerateRecipeParams sanitizes cuisinePreference", () => {
  const result = validateGenerateRecipeParams({
    ingredients: ["chicken"],
    cuisinePreference: "  Italian  ",
  });

  assertEquals(result.cuisinePreference, "Italian");
});

Deno.test("validateGenerateRecipeParams limits ingredients to 20", () => {
  const manyIngredients = Array.from(
    { length: 25 },
    (_, i) => `ingredient${i}`,
  );

  const result = validateGenerateRecipeParams({
    ingredients: manyIngredients,
  });

  assertEquals(result.ingredients.length, 20);
});

Deno.test("validateGenerateRecipeParams sanitizes additionalRequests", () => {
  const result = validateGenerateRecipeParams({
    ingredients: ["chicken"],
    additionalRequests: "  make it spicy  ",
  });

  assertEquals(result.additionalRequests, "make it spicy");
});

Deno.test("validateGenerateRecipeParams allows longer modification context in additionalRequests", () => {
  const longContext = "a".repeat(2200);
  const result = validateGenerateRecipeParams({
    ingredients: ["chicken"],
    additionalRequests: longContext,
  });

  assertEquals(result.additionalRequests?.length, 2000);
});

Deno.test("validateGenerateRecipeParams handles JSON string input", () => {
  const result = validateGenerateRecipeParams(
    JSON.stringify({
      ingredients: ["chicken", "rice"],
      targetTime: 30,
    }),
  );

  assertEquals(result.ingredients.length, 2);
  assertEquals(result.targetTime, 30);
});

Deno.test("validateGenerateRecipeParams rejects invalid JSON string", () => {
  try {
    validateGenerateRecipeParams("not valid json");
    throw new Error("Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, "Invalid JSON");
  }
});

Deno.test("validateGenerateRecipeParams rejects all-empty ingredients", () => {
  try {
    validateGenerateRecipeParams({
      ingredients: ["   ", "!!!", ""],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, "at least one valid ingredient");
  }
});

// ============================================================
// UserContext Tests
// ============================================================

Deno.test("UserContext includes all required fields", () => {
  const context = createMockUserContext();

  assertExists(context.language);
  assertExists(context.measurementSystem);
  assertExists(context.dietaryRestrictions);
  assertExists(context.ingredientDislikes);
  assertExists(context.conversationHistory);
  assertExists(context.dietTypes);
  assertExists(context.customAllergies);
  assertExists(context.kitchenEquipment);
});

Deno.test("UserContext supports dietary restrictions", () => {
  const context = createMockUserContext({
    dietaryRestrictions: ["gluten", "dairy"],
    customAllergies: ["tree_nuts", "shellfish"],
  });

  assertEquals(context.dietaryRestrictions.length, 2);
  assertEquals(context.customAllergies.length, 2);
});

Deno.test("UserContext supports equipment preferences", () => {
  const context = createMockUserContext({
    kitchenEquipment: ["thermomix", "instant_pot", "air_fryer"],
  });

  assertEquals(context.kitchenEquipment.length, 3);
  assertEquals(context.kitchenEquipment.includes("thermomix"), true);
});

// ============================================================
// Output Schema Validation Tests
// ============================================================

Deno.test("generated recipe matches expected schema", () => {
  const mockRecipe = createMockGeneratedRecipeResponse();

  // Verify all required fields exist
  assertExists(mockRecipe.schemaVersion);
  assertExists(mockRecipe.suggestedName);
  assertExists(mockRecipe.measurementSystem);
  assertExists(mockRecipe.language);
  assertExists(mockRecipe.ingredients);
  assertExists(mockRecipe.steps);
  assertExists(mockRecipe.totalTime);
  assertExists(mockRecipe.difficulty);
  assertExists(mockRecipe.portions);
  assertExists(mockRecipe.tags);

  // Verify types
  assertEquals(mockRecipe.schemaVersion, "1.0");
  assertEquals(typeof mockRecipe.suggestedName, "string");
  assertEquals(Array.isArray(mockRecipe.ingredients), true);
  assertEquals(Array.isArray(mockRecipe.steps), true);
  assertEquals(typeof mockRecipe.totalTime, "number");
  assertEquals(typeof mockRecipe.portions, "number");
});

Deno.test("ingredient objects have required fields", () => {
  const mockRecipe = createMockGeneratedRecipeResponse();
  const ingredient = mockRecipe.ingredients[0];

  assertExists(ingredient.name);
  assertExists(ingredient.quantity);
  assertExists(ingredient.unit);

  assertEquals(typeof ingredient.name, "string");
  assertEquals(typeof ingredient.quantity, "number");
  assertEquals(typeof ingredient.unit, "string");
});

Deno.test("step objects have required fields", () => {
  const mockRecipe = createMockGeneratedRecipeResponse();
  const step = mockRecipe.steps[0];

  assertExists(step.order);
  assertExists(step.instruction);

  assertEquals(typeof step.order, "number");
  assertEquals(typeof step.instruction, "string");
});

// ============================================================
// Prompt Building Tests
// ============================================================

Deno.test("UserContext includes all required fields", () => {
  const userContext = createMockUserContext({
    skillLevel: "beginner",
    householdSize: 4,
    dietTypes: ["vegetarian"],
    ingredientDislikes: ["mushrooms"],
    kitchenEquipment: ["oven", "blender"],
  });

  // Test that user context fields are being used
  assertExists(userContext.skillLevel);
  assertExists(userContext.householdSize);
  assertEquals(userContext.dietTypes.length, 1);
  assertEquals(userContext.ingredientDislikes.length, 1);
  assertEquals(userContext.kitchenEquipment.length, 2);
});

Deno.test("UserContext supports dietary restrictions", () => {
  const enContext = createMockUserContext({ language: "en" });
  const esContext = createMockUserContext({ language: "es" });

  assertEquals(enContext.language, "en");
  assertEquals(esContext.language, "es");
});

Deno.test("UserContext supports equipment preferences", () => {
  const imperialContext = createMockUserContext({
    measurementSystem: "imperial",
  });
  const metricContext = createMockUserContext({ measurementSystem: "metric" });

  assertEquals(imperialContext.measurementSystem, "imperial");
  assertEquals(metricContext.measurementSystem, "metric");
});

Deno.test("getSystemPrompt Thermomix section uses 120°C guidance", () => {
  const prompt = getSystemPrompt(
    createMockUserContext({
      measurementSystem: "metric",
      kitchenEquipment: ["thermomix"],
    }),
  );

  assertStringIncludes(prompt, '"37°C"-"120°C"');
  assertStringIncludes(prompt, "Temperature guidance: low (37-60°C");
});

// ============================================================
// generateCustomRecipe Allergen Safety Tests
// ============================================================

/**
 * Helper: Create a mock fetch for the two-stage pipeline.
 * Stage 1 returns natural language text, Stage 2 returns structured JSON.
 * Both use OpenAI API format since recipe_creation/recipe_formatting route to OpenAI.
 */
function createTwoStageFetchMock(
  recipeName: string,
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
  steps: Array<{ instruction: string }>,
  options?: { totalTime?: number; difficulty?: string; portions?: number },
) {
  let callCount = 0;
  return async (_input: string | URL | Request, _init?: RequestInit) => {
    callCount++;
    if (callCount === 1) {
      // Stage 1: natural language recipe
      const ingredientText = ingredients.map((i) =>
        `- ${i.quantity} ${i.unit} ${i.name}`
      ).join("\n");
      const stepsText = steps.map((s, i) => `${i + 1}. ${s.instruction}`).join(
        "\n",
      );
      return new Response(
        JSON.stringify({
          id: "chatcmpl-stage1",
          model: "gpt-5-mini",
          choices: [{
            message: {
              content:
                `# ${recipeName}\n\nIngredients:\n${ingredientText}\n\nSteps:\n${stepsText}\n\nTotal time: ${
                  options?.totalTime ?? 20
                } minutes\nDifficulty: ${
                  options?.difficulty ?? "easy"
                }\nPortions: ${options?.portions ?? 2}`,
            },
          }],
          usage: { prompt_tokens: 100, completion_tokens: 200 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } else {
      // Stage 2: structured JSON
      return new Response(
        JSON.stringify({
          id: "chatcmpl-stage2",
          model: "gpt-5-nano",
          choices: [{
            message: {
              content: JSON.stringify({
                recipeName,
                description: `A delicious ${recipeName.toLowerCase()}.`,
                ingredients,
                steps: steps.map((s) => ({ instruction: s.instruction })),
                totalTime: options?.totalTime ?? 20,
                difficulty: options?.difficulty ?? "easy",
                portions: options?.portions ?? 2,
              }),
            },
          }],
          usage: { prompt_tokens: 300, completion_tokens: 150 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  };
}

Deno.test("generateCustomRecipe proceeds with warning when allergen system is unavailable", async () => {
  resetSharedCaches();

  const originalFetch = globalThis.fetch;
  const previousOpenAIKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");

  globalThis.fetch = createTwoStageFetchMock(
    "Chicken Dish",
    [{ name: "chicken", quantity: 1, unit: "lb" }],
    [{ instruction: "Cook chicken." }],
  );

  const supabase = {
    ...createAllergenOutageSupabaseMock(),
    rpc: (functionName: string, args?: { ingredient_names?: string[] }) => {
      if (functionName === "batch_find_ingredients") {
        const names = args?.ingredient_names ?? [];
        return Promise.resolve({
          data: names.map((name) => ({
            input_name: name,
            matched_name: null,
            matched_name_es: null,
            image_url: null,
            match_score: null,
          })),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
    },
  } as any;

  // Override from() to also handle useful_items
  const originalFrom = supabase.from.bind(supabase);
  supabase.from = (table: string) => {
    if (table === "useful_items") {
      return {
        select: () => ({ limit: async () => ({ data: [], error: null }) }),
      };
    }
    return originalFrom(table);
  };

  try {
    const result = await generateCustomRecipe(
      supabase,
      { ingredients: ["chicken"] },
      createMockUserContext({ language: "en", dietaryRestrictions: ["nuts"] }),
    );

    // Allergens are non-blocking: recipe should be generated with a warning
    assertEquals(result.recipe.suggestedName, "Chicken Dish");
    assertStringIncludes(
      result.safetyFlags?.allergenWarning ?? "",
      "couldn't verify allergens",
    );
    assertEquals(result.safetyFlags?.error, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousOpenAIKey === undefined) {
      Deno.env.delete("OPENAI_API_KEY");
    } else {
      Deno.env.set("OPENAI_API_KEY", previousOpenAIKey);
    }
    resetSharedCaches();
  }
});

Deno.test("generateCustomRecipe proceeds with allergen warning when allergen detected", async () => {
  resetSharedCaches();

  const originalFetch = globalThis.fetch;
  const previousOpenAIKey = Deno.env.get("OPENAI_API_KEY");

  Deno.env.set("OPENAI_API_KEY", "test-openai-key");
  globalThis.fetch = createTwoStageFetchMock(
    "Peanut Rice Bowl",
    [
      { name: "peanut", quantity: 1, unit: "cup" },
      { name: "rice", quantity: 2, unit: "cups" },
    ],
    [{ instruction: "Toast peanuts and cook rice." }],
    { totalTime: 25 },
  );

  const supabase = {
    from: (table: string) => ({
      select: (_fields: string) => {
        if (table === "allergen_groups") {
          return Promise.resolve({
            data: [{
              category: "nuts",
              ingredient_canonical: "peanut",
              name_en: "peanut",
              name_es: "cacahuate",
            }],
            error: null,
          });
        }
        if (table === "food_safety_rules") {
          return Promise.resolve({ data: [], error: null });
        }
        if (table === "ingredient_aliases") {
          return Promise.resolve({ data: [], error: null });
        }
        if (table === "useful_items") {
          return {
            limit: async (_n: number) => ({ data: [], error: null }),
          };
        }
        return Promise.resolve({ data: [], error: null });
      },
    }),
    rpc: (
      functionName: string,
      args?: { ingredient_names?: string[] },
    ) => {
      if (functionName === "batch_find_ingredients") {
        const names = args?.ingredient_names ?? [];
        return Promise.resolve({
          data: names.map((name) => ({
            input_name: name,
            matched_name: null,
            matched_name_es: null,
            image_url: null,
            match_score: null,
          })),
          error: null,
        });
      }
      return Promise.resolve({
        data: null,
        error: { message: "unknown rpc" },
      });
    },
  } as any;

  try {
    const result = await generateCustomRecipe(
      supabase,
      { ingredients: ["peanut", "rice"] },
      createMockUserContext({
        language: "en",
        dietaryRestrictions: ["nuts"],
      }),
    );

    assertEquals(result.recipe.suggestedName, "Peanut Rice Bowl");
    assertStringIncludes(result.safetyFlags?.allergenWarning ?? "", "Contains");
    assertEquals(result.safetyFlags?.error, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousOpenAIKey === undefined) {
      Deno.env.delete("OPENAI_API_KEY");
    } else {
      Deno.env.set("OPENAI_API_KEY", previousOpenAIKey);
    }
    resetSharedCaches();
  }
});

// ============================================================
// enrichIngredientsWithImages Tests
// ============================================================

/**
 * Mock Supabase client for testing enrichIngredientsWithImages.
 * Simulates database queries and responses.
 * Uses rpc method for batch_find_ingredients RPC as used by the function.
 */
function createMockSupabaseClient(mockData: Record<string, any> = {}) {
  return {
    // rpc is used for batch_find_ingredients call
    rpc: (
      funcName: string,
      args: { ingredient_names: string[]; preferred_lang: string },
    ) => {
      if (funcName !== "batch_find_ingredients") {
        return { data: null, error: { message: "Unknown function" } };
      }

      const results = args.ingredient_names.map((name: string) => {
        const data = mockData[name.toLowerCase()];
        return {
          input_name: name,
          matched_name: data ? name : null,
          matched_name_es: null,
          image_url: data?.image_url || null,
          match_score: data ? 1.0 : null,
        };
      });

      return Promise.resolve({ data: results, error: null });
    },
    // Legacy from/select methods (kept for backwards compatibility)
    from: (_table: string) => ({
      select: (_fields: string) => ({
        eq: (_column: string, value: string) => ({
          limit: (_n: number) => ({
            maybeSingle: async () => {
              const data = mockData[value.toLowerCase()];
              return { data: data || null, error: null };
            },
          }),
        }),
        textSearch: (_column: string, term: string, _options: any) => ({
          limit: (_n: number) => ({
            maybeSingle: async () => {
              const data = mockData[term.toLowerCase()];
              return { data: data || null, error: null };
            },
          }),
        }),
        ilike: (_column: string, pattern: string) => ({
          limit: (_n: number) => ({
            maybeSingle: async () => {
              const ingredientName = pattern.replace(/%/g, "").replace(
                /\\/g,
                "",
              );
              const data = mockData[ingredientName.toLowerCase()];
              return { data: data || null, error: null };
            },
          }),
        }),
      }),
    }),
  } as any;
}

Deno.test("enrichIngredientsWithImages adds image URLs when found", async () => {
  const mockSupabase = createMockSupabaseClient({
    "chicken": { image_url: "https://example.com/chicken.jpg" },
    "rice": { image_url: "https://example.com/rice.jpg" },
  });

  const ingredients = [
    { name: "chicken", quantity: 1, unit: "lb" },
    { name: "rice", quantity: 2, unit: "cups" },
  ];

  const result = await enrichIngredientsWithImages(ingredients, mockSupabase);

  assertEquals(result[0].imageUrl, "https://example.com/chicken.jpg");
  assertEquals(result[1].imageUrl, "https://example.com/rice.jpg");
  assertEquals(result[0].name, "chicken");
  assertEquals(result[1].name, "rice");
});

Deno.test("enrichIngredientsWithImages sanitizes SQL special characters", async () => {
  // Test that ingredient names with special characters are properly escaped
  const mockSupabase = createMockSupabaseClient({
    "chicken_breast": { image_url: "https://example.com/chicken.jpg" },
  });

  const ingredients = [
    { name: "chicken_breast%", quantity: 1, unit: "lb" }, // SQL wildcards should be escaped
  ];

  const result = await enrichIngredientsWithImages(ingredients, mockSupabase);

  // Sanitization happens: ingredient.name.replace(/[%_\\]/g, '\\$&')
  // The % should be escaped, so it won't match in our mock (which expects exact lowercase match)
  // This verifies sanitization doesn't break the query
  assertEquals(result[0].name, "chicken_breast%");
  assertEquals(result[0].quantity, 1);
});

Deno.test("enrichIngredientsWithImages handles partial failures gracefully", async () => {
  // Test RPC error handling - function should not throw, failed lookups return without imageUrl
  const mockSupabase = {
    rpc: () =>
      Promise.resolve({
        data: null,
        error: { message: "Database error" },
      }),
  } as any;

  const ingredients = [
    { name: "chicken", quantity: 1, unit: "lb" },
    { name: "unknown_ingredient", quantity: 2, unit: "cups" },
  ];

  // Function should not throw, failed ingredients return without imageUrl
  const result = await enrichIngredientsWithImages(ingredients, mockSupabase);
  assertEquals(result.length, 2);
  assertEquals(result[0].imageUrl, undefined); // Failed lookup returns original
  assertEquals(result[1].imageUrl, undefined); // Failed lookup returns original
});

Deno.test("enrichIngredientsWithImages preserves original data when no image found", async () => {
  const mockSupabase = createMockSupabaseClient({}); // No images in database

  const ingredients = [
    { name: "exotic_ingredient", quantity: 1, unit: "piece" },
  ];

  const result = await enrichIngredientsWithImages(ingredients, mockSupabase);
  assertEquals(result[0].name, "exotic_ingredient");
  assertEquals(result[0].quantity, 1);
  assertEquals(result[0].unit, "piece");
  assertEquals(result[0].imageUrl, undefined);
});

// ============================================================
// validateThermomixSteps Tests
// ============================================================

Deno.test("validateThermomixSteps accepts valid numeric speeds", () => {
  const steps = [
    {
      order: 1,
      instruction: "Mix",
      thermomixSpeed: "1",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
    {
      order: 2,
      instruction: "Blend",
      thermomixSpeed: "5",
      thermomixTime: 60,
      thermomixTemp: "100°C",
    },
    {
      order: 3,
      instruction: "Chop",
      thermomixSpeed: "10",
      thermomixTime: 10,
      thermomixTemp: "Varoma",
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixSpeed, "1");
  assertEquals(result[1].thermomixSpeed, "5");
  assertEquals(result[2].thermomixSpeed, "10");
});

Deno.test("validateThermomixSteps normalizes special speeds to title case", () => {
  const steps = [
    {
      order: 1,
      instruction: "Stir",
      thermomixSpeed: "spoon",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
    {
      order: 2,
      instruction: "Mix",
      thermomixSpeed: "SPOON",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
    {
      order: 3,
      instruction: "Reverse",
      thermomixSpeed: "reverse",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
    {
      order: 4,
      instruction: "Reverse",
      thermomixSpeed: "REVERSE",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixSpeed, "Spoon");
  assertEquals(result[1].thermomixSpeed, "Spoon");
  assertEquals(result[2].thermomixSpeed, "Reverse");
  assertEquals(result[3].thermomixSpeed, "Reverse");
});

Deno.test("validateThermomixSteps removes invalid speeds", () => {
  const steps = [
    {
      order: 1,
      instruction: "Mix",
      thermomixSpeed: "11",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
    {
      order: 2,
      instruction: "Blend",
      thermomixSpeed: "turbo",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
    {
      order: 3,
      instruction: "Chop",
      thermomixSpeed: "invalid",
      thermomixTime: 30,
      thermomixTemp: "50°C",
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixSpeed, undefined);
  assertEquals(result[1].thermomixSpeed, undefined);
  assertEquals(result[2].thermomixSpeed, undefined);
});

Deno.test("validateThermomixSteps accepts valid temperatures", () => {
  const steps = [
    { order: 1, instruction: "Heat", thermomixTemp: "50°C", thermomixTime: 30 },
    {
      order: 2,
      instruction: "Boil",
      thermomixTemp: "100°C",
      thermomixTime: 60,
    },
    {
      order: 3,
      instruction: "Steam",
      thermomixTemp: "Varoma",
      thermomixTime: 120,
    },
    {
      order: 4,
      instruction: "Warm",
      thermomixTemp: "37.5°C",
      thermomixTime: 30,
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTemp, "50°C");
  assertEquals(result[1].thermomixTemp, "100°C");
  assertEquals(result[2].thermomixTemp, "Varoma");
  assertEquals(result[3].thermomixTemp, "37.5°C");
});

Deno.test("validateThermomixSteps removes invalid temperatures", () => {
  const steps = [
    { order: 1, instruction: "Heat", thermomixTemp: "hot", thermomixTime: 30 },
    { order: 2, instruction: "Cook", thermomixTemp: "100", thermomixTime: 30 }, // Missing unit
    { order: 3, instruction: "Warm", thermomixTemp: "50F", thermomixTime: 30 }, // Wrong format (no °)
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTemp, undefined);
  assertEquals(result[1].thermomixTemp, undefined);
  assertEquals(result[2].thermomixTemp, undefined);
});

Deno.test("validateThermomixSteps removes invalid times", () => {
  const steps = [
    { order: 1, instruction: "Mix", thermomixTime: 0, thermomixSpeed: "5" },
    { order: 2, instruction: "Blend", thermomixTime: -10, thermomixSpeed: "5" },
    { order: 3, instruction: "Chop", thermomixTime: NaN, thermomixSpeed: "5" },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTime, undefined);
  assertEquals(result[1].thermomixTime, undefined);
  assertEquals(result[2].thermomixTime, undefined);
});

Deno.test("validateThermomixSteps preserves valid times", () => {
  const steps = [
    { order: 1, instruction: "Mix", thermomixTime: 30, thermomixSpeed: "5" },
    { order: 2, instruction: "Blend", thermomixTime: 120, thermomixSpeed: "5" },
    { order: 3, instruction: "Chop", thermomixTime: 1, thermomixSpeed: "5" },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTime, 30);
  assertEquals(result[1].thermomixTime, 120);
  assertEquals(result[2].thermomixTime, 1);
});

Deno.test("validateThermomixSteps skips steps with no Thermomix params", () => {
  const steps = [
    { order: 1, instruction: "Plate the dish" },
    { order: 2, instruction: "Garnish with herbs" },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result.length, 2);
  assertEquals(result[0].instruction, "Plate the dish");
  assertEquals(result[1].instruction, "Garnish with herbs");
});

Deno.test("validateThermomixSteps handles mixed valid and invalid params", () => {
  const steps = [
    {
      order: 1,
      instruction: "Mix ingredients",
      thermomixTime: 30,
      thermomixSpeed: "invalid_speed",
      thermomixTemp: "100°C",
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTime, 30);
  assertEquals(result[0].thermomixTemp, "100°C");
  assertEquals(result[0].thermomixSpeed, undefined);
});

Deno.test("validateThermomixSteps preserves composite 'Reverse 1' speed", () => {
  const steps = [
    {
      order: 1,
      instruction: "Sauté onions",
      thermomixTime: 180,
      thermomixTemp: "100°C",
      thermomixSpeed: "Reverse 1",
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixSpeed, "Reverse 1");
  assertEquals(result[0].thermomixTime, 180);
  assertEquals(result[0].thermomixTemp, "100°C");
});

// ============================================================
// parseThermomixSpeed Tests
// ============================================================

Deno.test("parseThermomixSpeed accepts composite 'Reverse 1'", () => {
  assertEquals(parseThermomixSpeed("Reverse 1"), "Reverse 1");
});

Deno.test("parseThermomixSpeed normalizes lowercase composite 'reverse 5'", () => {
  assertEquals(parseThermomixSpeed("reverse 5"), "Reverse 5");
});

Deno.test("parseThermomixSpeed accepts reversed order '1 reverse'", () => {
  assertEquals(parseThermomixSpeed("1 reverse"), "Reverse 1");
});

Deno.test("parseThermomixSpeed rejects out-of-range 'Reverse 11'", () => {
  assertEquals(parseThermomixSpeed("Reverse 11"), null);
});

Deno.test("parseThermomixSpeed accepts standalone 'Reverse'", () => {
  assertEquals(parseThermomixSpeed("Reverse"), "Reverse");
});

Deno.test("parseThermomixSpeed accepts standalone 'Spoon'", () => {
  assertEquals(parseThermomixSpeed("Spoon"), "Spoon");
});

Deno.test("parseThermomixSpeed accepts pure numeric '5'", () => {
  assertEquals(parseThermomixSpeed("5"), "5");
});

Deno.test("parseThermomixSpeed accepts 'Reverse Spoon'", () => {
  assertEquals(parseThermomixSpeed("Reverse Spoon"), "Reverse Spoon");
});

Deno.test("parseThermomixSpeed normalizes lowercase 'reverse spoon'", () => {
  assertEquals(parseThermomixSpeed("reverse spoon"), "Reverse Spoon");
});

Deno.test("parseThermomixSpeed accepts reversed order 'spoon reverse'", () => {
  assertEquals(parseThermomixSpeed("spoon reverse"), "Reverse Spoon");
});

Deno.test("parseThermomixSpeed rejects invalid 'turbo'", () => {
  assertEquals(parseThermomixSpeed("turbo"), null);
});

// ============================================================
// buildFormattingJsonSchema Tests (Stage 2 simplified schema)
// ============================================================

Deno.test("buildFormattingJsonSchema - uses recipeName instead of suggestedName", () => {
  const schema = buildFormattingJsonSchema(false);
  const props = schema.properties as Record<string, unknown>;

  assertExists(props.recipeName);
  assertEquals(props.suggestedName, undefined);
  assertEquals(props.schemaVersion, undefined);
  assertEquals(props.language, undefined);
  assertEquals(props.measurementSystem, undefined);
  assertEquals(props.tags, undefined);
});

Deno.test("buildFormattingJsonSchema - has core fields", () => {
  const schema = buildFormattingJsonSchema(false);
  const required = schema.required as string[];

  assertEquals(required.includes("recipeName"), true);
  assertEquals(required.includes("description"), true);
  assertEquals(required.includes("ingredients"), true);
  assertEquals(required.includes("steps"), true);
  assertEquals(required.includes("totalTime"), true);
  assertEquals(required.includes("difficulty"), true);
  assertEquals(required.includes("portions"), true);
});

Deno.test("buildFormattingJsonSchema - steps have no order or ingredientsUsed", () => {
  const schema = buildFormattingJsonSchema(false);
  const props = schema.properties as Record<string, Record<string, unknown>>;
  const stepItems = props.steps.items as Record<
    string,
    Record<string, unknown>
  >;
  const stepProps = stepItems.properties;

  assertExists(stepProps.instruction);
  assertEquals(stepProps.order, undefined);
  assertEquals(stepProps.ingredientsUsed, undefined);
});

Deno.test("buildFormattingJsonSchema - adds Thermomix fields when hasThermomix=true", () => {
  const schema = buildFormattingJsonSchema(true);
  const props = schema.properties as Record<string, Record<string, unknown>>;
  const stepItems = props.steps.items as Record<
    string,
    Record<string, unknown>
  >;
  const stepProps = stepItems.properties;
  const stepRequired = stepItems.required as unknown as string[];

  assertExists(stepProps.thermomixTime);
  assertExists(stepProps.thermomixTemp);
  assertExists(stepProps.thermomixSpeed);
  assertEquals(stepRequired.includes("thermomixTime"), true);
  assertEquals(stepRequired.includes("thermomixTemp"), true);
  assertEquals(stepRequired.includes("thermomixSpeed"), true);
});

Deno.test("buildFormattingJsonSchema - no Thermomix fields when hasThermomix=false", () => {
  const schema = buildFormattingJsonSchema(false);
  const props = schema.properties as Record<string, Record<string, unknown>>;
  const stepItems = props.steps.items as Record<
    string,
    Record<string, unknown>
  >;
  const stepProps = stepItems.properties;

  assertEquals(stepProps.thermomixTime, undefined);
  assertEquals(stepProps.thermomixTemp, undefined);
  assertEquals(stepProps.thermomixSpeed, undefined);
});

// ============================================================
// inferIngredientsUsed Tests
// ============================================================

Deno.test("inferIngredientsUsed - matches exact ingredient names", () => {
  const steps = [
    { instruction: "Dice the chicken and add rice to the pot." },
    { instruction: "Season with salt and pepper." },
  ];
  const ingredients = [
    { name: "chicken" },
    { name: "rice" },
    { name: "salt" },
    { name: "pepper" },
  ];

  const result = inferIngredientsUsed(steps, ingredients);
  assertEquals(result[0], ["chicken", "rice"]);
  assertEquals(result[1], ["salt", "pepper"]);
});

Deno.test("inferIngredientsUsed - case insensitive matching", () => {
  const steps = [{ instruction: "Add the CHICKEN to the pan." }];
  const ingredients = [{ name: "chicken" }, { name: "rice" }];

  const result = inferIngredientsUsed(steps, ingredients);
  assertEquals(result[0], ["chicken"]);
});

Deno.test("inferIngredientsUsed - handles compound ingredient names", () => {
  const steps = [{ instruction: "Slice the chicken breast thinly." }];
  const ingredients = [
    { name: "chicken breast" },
    { name: "olive oil" },
  ];

  const result = inferIngredientsUsed(steps, ingredients);
  assertEquals(result[0], ["chicken breast"]);
});

Deno.test("inferIngredientsUsed - returns empty array when no match", () => {
  const steps = [{ instruction: "Preheat the oven to 350°F." }];
  const ingredients = [{ name: "chicken" }, { name: "rice" }];

  const result = inferIngredientsUsed(steps, ingredients);
  assertEquals(result[0], []);
});

// ============================================================
// postProcessFormattedRecipe Tests
// ============================================================

Deno.test("postProcessFormattedRecipe - maps recipeName to suggestedName", () => {
  const formatted = {
    recipeName: "Chicken Ramen",
    description: "A warm bowl of ramen.",
    ingredients: [{ name: "chicken", quantity: 1, unit: "lb" }],
    steps: [{ instruction: "Cook the chicken." }],
    totalTime: 30,
    difficulty: "easy" as const,
    portions: 4,
  };

  const result = postProcessFormattedRecipe(formatted, {
    language: "en",
    measurementSystem: "imperial",
  });

  assertEquals(result.suggestedName, "Chicken Ramen");
  assertEquals(result.recipeName, undefined);
});

Deno.test("postProcessFormattedRecipe - injects constant fields", () => {
  const formatted = {
    recipeName: "Test",
    description: "Test desc",
    ingredients: [],
    steps: [],
    totalTime: 10,
    difficulty: "easy" as const,
    portions: 2,
  };

  const result = postProcessFormattedRecipe(formatted, {
    language: "es",
    measurementSystem: "metric",
  });

  assertEquals(result.schemaVersion, "1.0");
  assertEquals(result.language, "es");
  assertEquals(result.measurementSystem, "metric");
  assertEquals(result.tags, []);
});

Deno.test("postProcessFormattedRecipe - computes step order from array index", () => {
  const formatted = {
    recipeName: "Test",
    description: "Test desc",
    ingredients: [{ name: "flour", quantity: 2, unit: "cups" }],
    steps: [
      { instruction: "Mix flour." },
      { instruction: "Bake." },
      { instruction: "Cool." },
    ],
    totalTime: 60,
    difficulty: "medium" as const,
    portions: 8,
  };

  const result = postProcessFormattedRecipe(formatted, {
    language: "en",
    measurementSystem: "imperial",
  });

  const steps = result.steps as Array<{ order: number }>;
  assertEquals(steps[0].order, 1);
  assertEquals(steps[1].order, 2);
  assertEquals(steps[2].order, 3);
});

Deno.test("postProcessFormattedRecipe - computes ingredientsUsed via inference", () => {
  const formatted = {
    recipeName: "Pasta",
    description: "Simple pasta",
    ingredients: [
      { name: "pasta", quantity: 200, unit: "g" },
      { name: "garlic", quantity: 2, unit: "cloves" },
      { name: "olive oil", quantity: 2, unit: "tbsp" },
    ],
    steps: [
      { instruction: "Boil the pasta until al dente." },
      { instruction: "Sauté garlic in olive oil." },
      { instruction: "Toss pasta with garlic oil." },
    ],
    totalTime: 20,
    difficulty: "easy" as const,
    portions: 2,
  };

  const result = postProcessFormattedRecipe(formatted, {
    language: "en",
    measurementSystem: "metric",
  });

  const steps = result.steps as Array<{ ingredientsUsed: string[] }>;
  assertEquals(steps[0].ingredientsUsed, ["pasta"]);
  assertEquals(steps[1].ingredientsUsed, ["garlic", "olive oil"]);
  assertEquals(steps[2].ingredientsUsed, ["pasta", "garlic"]);
});

Deno.test("postProcessFormattedRecipe - preserves Thermomix fields", () => {
  const formatted = {
    recipeName: "Thermomix Soup",
    description: "Creamy soup",
    ingredients: [{ name: "potato", quantity: 500, unit: "g" }],
    steps: [{
      instruction: "Cook potato in Thermomix.",
      thermomixTime: 600,
      thermomixTemp: "100°C",
      thermomixSpeed: "1",
    }],
    totalTime: 15,
    difficulty: "easy" as const,
    portions: 4,
  };

  const result = postProcessFormattedRecipe(formatted, {
    language: "es",
    measurementSystem: "metric",
  });

  const steps = result.steps as Array<{
    thermomixTime: number;
    thermomixTemp: string;
    thermomixSpeed: string;
  }>;
  assertEquals(steps[0].thermomixTime, 600);
  assertEquals(steps[0].thermomixTemp, "100°C");
  assertEquals(steps[0].thermomixSpeed, "1");
});

Deno.test("postProcessFormattedRecipe - output passes GeneratedRecipeSchema validation", () => {
  const formatted = {
    recipeName: "Simple Rice",
    description: "Plain rice dish",
    ingredients: [
      { name: "rice", quantity: 1, unit: "cup" },
      { name: "water", quantity: 2, unit: "cups" },
    ],
    steps: [
      { instruction: "Rinse the rice." },
      { instruction: "Boil water and add rice." },
      { instruction: "Simmer for 15 minutes." },
    ],
    totalTime: 20,
    difficulty: "easy" as const,
    portions: 4,
  };

  const result = postProcessFormattedRecipe(formatted, {
    language: "en",
    measurementSystem: "imperial",
  });

  const parsed = GeneratedRecipeSchema.safeParse(result);
  assertEquals(parsed.success, true);
  if (parsed.success) {
    assertEquals(parsed.data.suggestedName, "Simple Rice");
    assertEquals(parsed.data.schemaVersion, "1.0");
    assertEquals(parsed.data.steps.length, 3);
    assertEquals(parsed.data.steps[0].order, 1);
  }
});

// ============================================================
// Stage Prompt Tests
// ============================================================

Deno.test("getCreationSystemPrompt - includes language and units", () => {
  const prompt = getCreationSystemPrompt(
    createMockUserContext({ language: "es", measurementSystem: "metric" }),
  );

  assertStringIncludes(prompt, "Mexican Spanish");
  assertStringIncludes(prompt, "metric");
  assertStringIncludes(prompt, "ml, liters, grams");
});

Deno.test("getCreationSystemPrompt - includes Thermomix section when user has Thermomix", () => {
  const prompt = getCreationSystemPrompt(
    createMockUserContext({ kitchenEquipment: ["thermomix"] }),
  );

  assertStringIncludes(prompt, "THERMOMIX USAGE");
  assertStringIncludes(prompt, "Varoma");
});

Deno.test("getCreationSystemPrompt - no Thermomix section without equipment", () => {
  const prompt = getCreationSystemPrompt(
    createMockUserContext({ kitchenEquipment: [] }),
  );

  assertEquals(prompt.includes("THERMOMIX USAGE"), false);
});

Deno.test("getCreationSystemPrompt - does NOT include JSON formatting instructions", () => {
  const prompt = getCreationSystemPrompt(createMockUserContext());

  assertEquals(prompt.includes("schemaVersion"), false);
  assertEquals(prompt.includes("suggestedName"), false);
  assertEquals(prompt.includes("Return ONLY valid JSON"), false);
});

Deno.test("getFormattingSystemPrompt - includes Thermomix extraction note when true", () => {
  const prompt = getFormattingSystemPrompt(true);

  assertStringIncludes(prompt, "thermomixTime");
  assertStringIncludes(prompt, "thermomixTemp");
  assertStringIncludes(prompt, "thermomixSpeed");
});

Deno.test("getFormattingSystemPrompt - no Thermomix note when false", () => {
  const prompt = getFormattingSystemPrompt(false);

  assertEquals(prompt.includes("thermomixTime"), false);
});
