import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { clearAllergenCache } from "../allergen-filter.ts";
import { searchRecipes } from "./search-recipes.ts";

type MockResult = { data: unknown; error: unknown };

function createMockSupabase(config: {
  searchRecipesData: unknown[];
  ingredientLookupData?: unknown[];
  ingredientLookupError?: unknown;
  allergenGroupsData?: unknown[];
  allergenGroupsError?: unknown;
}) {
  return {
    from: (table: string) => {
      if (table === "recipes") {
        return {
          select: (columns: string) => {
            if (columns.includes("recipe_ingredients")) {
              return {
                in: async () =>
                  ({
                    data: config.ingredientLookupData ?? [],
                    error: config.ingredientLookupError ?? null,
                  }) as MockResult,
              };
            }

            const chain: Record<string, unknown> = {};
            for (const method of ["eq", "order", "lte", "or"]) {
              chain[method] = () => chain;
            }
            chain.limit = async () =>
              ({ data: config.searchRecipesData, error: null }) as MockResult;
            return chain;
          },
        };
      }

      if (table === "allergen_groups") {
        return {
          select: async () =>
            ({
              data: config.allergenGroupsData ?? [],
              error: config.allergenGroupsError ?? null,
            }) as MockResult,
        };
      }

      throw new Error(`Unexpected table in test mock: ${table}`);
    },
  } as any;
}

function createUserContext(language: "en" | "es") {
  return {
    language,
    measurementSystem: "imperial" as const,
    dietaryRestrictions: ["dairy"],
    ingredientDislikes: [],
    skillLevel: null,
    householdSize: null,
    conversationHistory: [],
    dietTypes: [],
    customAllergies: [],
    kitchenEquipment: [],
    cuisinePreferences: [],
  };
}

Deno.test("searchRecipes adds verification warning when ingredient lookup fails", async () => {
  clearAllergenCache();
  const supabase = createMockSupabase({
    searchRecipesData: [{
      id: "recipe-1",
      name_en: "Creamy Pasta",
      name_es: "Pasta Cremosa",
      image_url: null,
      total_time: 25,
      difficulty: "easy",
      portions: 2,
      recipe_to_tag: [],
    }],
    ingredientLookupError: { message: "db unavailable" },
  });

  const result = await searchRecipes(
    supabase,
    { maxTime: 30, limit: 5 },
    createUserContext("en"),
  );

  assertEquals(result.length, 1);
  assertExists(result[0].allergenVerificationWarning);
  assertEquals(
    result[0].allergenVerificationWarning,
    "Allergen verification is temporarily unavailable. Please check ingredients before cooking.",
  );
});

Deno.test("searchRecipes adds verification warning when allergen map is empty", async () => {
  clearAllergenCache();
  const supabase = createMockSupabase({
    searchRecipesData: [{
      id: "recipe-1",
      name_en: "Creamy Pasta",
      name_es: "Pasta Cremosa",
      image_url: null,
      total_time: 25,
      difficulty: "easy",
      portions: 2,
      recipe_to_tag: [],
    }],
    ingredientLookupData: [{
      id: "recipe-1",
      recipe_ingredients: [],
    }],
    allergenGroupsData: [],
  });

  const result = await searchRecipes(
    supabase,
    { maxTime: 30, limit: 5 },
    createUserContext("es"),
  );

  assertEquals(result.length, 1);
  assertExists(result[0].allergenVerificationWarning);
  assertEquals(
    result[0].allergenVerificationWarning,
    "La verificación de alérgenos no está disponible temporalmente. Revisa los ingredientes antes de cocinar.",
  );
});
