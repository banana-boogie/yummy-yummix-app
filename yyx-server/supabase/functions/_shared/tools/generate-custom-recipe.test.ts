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
  enrichIngredientsWithImages,
  generateCustomRecipe,
  getSystemPrompt,
  parseThermomixSpeed,
  TEMP_REGEX,
  VALID_NUMERIC_SPEEDS,
  VALID_SPECIAL_SPEEDS,
  VALID_SPECIAL_TEMPS,
  validateThermomixSteps,
} from "./generate-custom-recipe.ts";
import { clearAllergenCache } from "../allergen-filter.ts";
import { clearFoodSafetyCache } from "../food-safety.ts";
import { clearAliasCache } from "../ingredient-normalization.ts";

// ============================================================
// Test Data Helpers
// ============================================================

function createMockUserContext(
  overrides?: Partial<{
    locale: string;
    localeChain: string[];
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
  const locale = overrides?.locale ?? "en";
  const localeChain = overrides?.localeChain ??
    (locale === "es" ? ["es", "en"] : ["en"]);
  return {
    locale,
    localeChain,
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
    locale: "en",
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

  assertExists(context.locale);
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
  assertExists(mockRecipe.locale);
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
  const enContext = createMockUserContext({ locale: "en" });
  const esContext = createMockUserContext({ locale: "es" });

  assertEquals(enContext.locale, "en");
  assertEquals(esContext.locale, "es");
});

Deno.test("UserContext supports equipment preferences", () => {
  const imperialContext = createMockUserContext({
    measurementSystem: "imperial",
  });
  const metricContext = createMockUserContext({ measurementSystem: "metric" });

  assertEquals(imperialContext.measurementSystem, "imperial");
  assertEquals(metricContext.measurementSystem, "metric");
});

Deno.test("getSystemPrompt Thermomix section includes temperature and speed guidance", () => {
  const prompt = getSystemPrompt(
    createMockUserContext({
      measurementSystem: "metric",
      kitchenEquipment: ["thermomix"],
    }),
  );

  assertStringIncludes(prompt, '"37°C"-"120°C"');
  assertStringIncludes(prompt, "TEMPERATURE GUIDE:");
  assertStringIncludes(prompt, "SPEED GUIDE:");
  assertStringIncludes(prompt, "REVERSE");
  assertStringIncludes(prompt, "Above 60°C: max speed 6");
});

// ============================================================
// generateCustomRecipe Allergen Safety Tests
// ============================================================

Deno.test("generateCustomRecipe proceeds with warning when allergen system is unavailable", async () => {
  resetSharedCaches();

  // Mock: allergen DB outage, but AI still generates recipe
  const originalFetch = globalThis.fetch;
  const previousGoogleKey = Deno.env.get("GEMINI_API_KEY");
  Deno.env.set("GEMINI_API_KEY", "test-google-key");

  globalThis.fetch = async (
    _input: string | URL | Request,
    _init?: RequestInit,
  ) => {
    return new Response(
      JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                schemaVersion: "1.0",
                suggestedName: "Chicken Dish",
                measurementSystem: "imperial",
                locale: "en",
                ingredients: [{ name: "chicken", quantity: 1, unit: "lb" }],
                steps: [{
                  order: 1,
                  instruction: "Cook chicken.",
                  ingredientsUsed: ["chicken"],
                }],
                totalTime: 20,
                difficulty: "easy",
                portions: 2,
                tags: [],
              }),
            }],
            role: "model",
          },
          finishReason: "STOP",
        }],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 24,
          totalTokenCount: 36,
        },
        modelVersion: "gemini-3-flash-preview",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const supabase = {
    ...createAllergenOutageSupabaseMock(),
    rpc: (functionName: string, args?: { ingredient_names?: string[] }) => {
      if (functionName === "batch_find_ingredients") {
        const names = args?.ingredient_names ?? [];
        return Promise.resolve({
          data: names.map((name) => ({
            input_name: name,
            matched_name: null,
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
      createMockUserContext({ locale: "en", dietaryRestrictions: ["nuts"] }),
    );

    // Allergens are non-blocking: recipe should be generated with a warning
    assertEquals(result.recipe.suggestedName, "Chicken Dish");
    assertStringIncludes(
      result.safetyFlags?.allergenWarning ?? "",
      "couldn't verify allergens",
    );
    // No error flag — just a warning
    assertEquals(result.safetyFlags?.error, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousGoogleKey === undefined) {
      Deno.env.delete("GEMINI_API_KEY");
    } else {
      Deno.env.set("GEMINI_API_KEY", previousGoogleKey);
    }
    resetSharedCaches();
  }
});

Deno.test("generateCustomRecipe proceeds with allergen warning when allergen detected", async () => {
  resetSharedCaches();

  let capturedUrl: string | undefined;
  const originalFetch = globalThis.fetch;
  const previousGoogleKey = Deno.env.get("GEMINI_API_KEY");

  Deno.env.set("GEMINI_API_KEY", "test-google-key");
  globalThis.fetch = async (
    input: string | URL | Request,
    _init?: RequestInit,
  ) => {
    capturedUrl = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    return new Response(
      JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                schemaVersion: "1.0",
                suggestedName: "Peanut Rice Bowl",
                measurementSystem: "imperial",
                locale: "en",
                ingredients: [
                  { name: "peanut", quantity: 1, unit: "cup" },
                  { name: "rice", quantity: 2, unit: "cups" },
                ],
                steps: [
                  {
                    order: 1,
                    instruction: "Toast peanuts and cook rice.",
                    ingredientsUsed: ["peanut", "rice"],
                  },
                ],
                totalTime: 25,
                difficulty: "easy",
                portions: 2,
                tags: [],
              }),
            }],
            role: "model",
          },
          finishReason: "STOP",
        }],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 24,
          totalTokenCount: 36,
        },
        modelVersion: "gemini-3-flash-preview",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

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
        locale: "en",
        dietaryRestrictions: ["nuts"],
      }),
    );

    // Verify the request went to Gemini
    assertStringIncludes(capturedUrl ?? "", "gemini-2.5-flash");
    assertEquals(result.recipe.suggestedName, "Peanut Rice Bowl");
    assertStringIncludes(result.safetyFlags?.allergenWarning ?? "", "Contains");
    assertEquals(result.safetyFlags?.error, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousGoogleKey === undefined) {
      Deno.env.delete("GEMINI_API_KEY");
    } else {
      Deno.env.set("GEMINI_API_KEY", previousGoogleKey);
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
      args: { ingredient_names: string[]; preferred_locale: string },
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

Deno.test("validateThermomixSteps removes invalid speeds and fills via pair completion", () => {
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
  // Invalid speeds are removed, then pair completion fills "1" because time is still set
  assertEquals(result[0].thermomixSpeed, "1");
  assertEquals(result[1].thermomixSpeed, "1");
  assertEquals(result[2].thermomixSpeed, "1");
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
    {
      order: 1,
      instruction: "Heat",
      thermomixTemp: "hot",
      thermomixTime: 30,
      thermomixSpeed: "1",
    },
    {
      order: 2,
      instruction: "Cook",
      thermomixTemp: "100",
      thermomixTime: 30,
      thermomixSpeed: "1",
    }, // Missing unit
    {
      order: 3,
      instruction: "Warm",
      thermomixTemp: "50F",
      thermomixTime: 30,
      thermomixSpeed: "1",
    }, // Wrong format (no °)
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTemp, undefined);
  assertEquals(result[1].thermomixTemp, undefined);
  assertEquals(result[2].thermomixTemp, undefined);
});

Deno.test("validateThermomixSteps removes invalid times and fills via pair completion", () => {
  const steps = [
    { order: 1, instruction: "Mix", thermomixTime: 0, thermomixSpeed: "5" },
    { order: 2, instruction: "Blend", thermomixTime: -10, thermomixSpeed: "5" },
    { order: 3, instruction: "Chop", thermomixTime: NaN, thermomixSpeed: "5" },
  ];

  const result = validateThermomixSteps(steps);
  // Invalid times are removed, then pair completion fills 60 because speed is still set
  assertEquals(result[0].thermomixTime, 60);
  assertEquals(result[1].thermomixTime, 60);
  assertEquals(result[2].thermomixTime, 60);
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
  // Invalid speed removed, then pair completion fills "1" because time is set
  assertEquals(result[0].thermomixSpeed, "1");
});

// ============================================================
// Pair Completion Tests
// ============================================================

Deno.test("validateThermomixSteps pair completion: time only fills speed to 1", () => {
  const steps = [
    {
      order: 1,
      instruction: "Warm milk",
      thermomixTime: 120,
      thermomixTemp: "50°C",
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTime, 120);
  assertEquals(result[0].thermomixSpeed, "1");
  assertEquals(result[0].thermomixTemp, "50°C");
});

Deno.test("validateThermomixSteps pair completion: speed only fills time to 60", () => {
  const steps = [
    { order: 1, instruction: "Chop carrots", thermomixSpeed: "5" },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixSpeed, "5");
  assertEquals(result[0].thermomixTime, 60);
});

Deno.test("validateThermomixSteps pair completion: time + speed set, temp null stays null", () => {
  const steps = [
    {
      order: 1,
      instruction: "Chop",
      thermomixTime: 10,
      thermomixSpeed: "5",
      thermomixTemp: null,
    },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTime, 10);
  assertEquals(result[0].thermomixSpeed, "5");
  assertEquals(result[0].thermomixTemp, null);
});

Deno.test("validateThermomixSteps pair completion: no params means no fill", () => {
  const steps = [
    { order: 1, instruction: "Plate and serve" },
  ];

  const result = validateThermomixSteps(steps);
  assertEquals(result[0].thermomixTime, undefined);
  assertEquals(result[0].thermomixSpeed, undefined);
  assertEquals(result[0].thermomixTemp, undefined);
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
