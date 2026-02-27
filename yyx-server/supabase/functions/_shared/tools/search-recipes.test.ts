import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { clearAllergenCache } from "../allergen-filter.ts";
import { filterByAllKeywords, searchRecipes } from "./search-recipes.ts";

type MockResult = { data: unknown; error: unknown };

function createMockSupabase(config: {
  searchRecipesData: unknown[];
  tagSearchRecipesData?: unknown[];
  ingredientLookupData?: unknown[];
  ingredientLookupError?: unknown;
  allergenGroupsData?: unknown[];
  allergenGroupsError?: unknown;
  matchingTagsData?: unknown[];
  recipeTagJoinsData?: unknown[];
}) {
  const calls = {
    recipeNameOr: [] as string[],
    tagNameOr: [] as string[],
    recipeEq: [] as Array<{ column: string; value: unknown }>,
    recipeLte: [] as Array<{ column: string; value: unknown }>,
  };

  const createRecipeChain = () => {
    let usedIn = false;
    const chain: Record<string, unknown> = {};
    chain.eq = (column: string, value: unknown) => {
      calls.recipeEq.push({ column, value });
      return chain;
    };
    chain.order = () => chain;
    chain.lte = (column: string, value: unknown) => {
      calls.recipeLte.push({ column, value });
      return chain;
    };
    chain.or = (filter: string) => {
      calls.recipeNameOr.push(filter);
      return chain;
    };
    chain.in = () => {
      usedIn = true;
      return chain;
    };
    chain.limit = async () =>
      ({
        data: usedIn && config.tagSearchRecipesData
          ? config.tagSearchRecipesData
          : config.searchRecipesData,
        error: null,
      }) as MockResult;
    return chain;
  };

  return {
    calls,
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

            return createRecipeChain();
          },
        };
      }

      if (table === "recipe_tags") {
        return {
          select: () => ({
            or: async (filter: string) => {
              calls.tagNameOr.push(filter);
              return {
                data: config.matchingTagsData ?? [],
                error: null,
              } as MockResult;
            },
          }),
        };
      }

      if (table === "recipe_to_tag") {
        return {
          select: () => ({
            in: async () =>
              ({
                data: config.recipeTagJoinsData ?? [],
                error: null,
              }) as MockResult,
          }),
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

function createUserContext(
  language: "en" | "es",
  dietaryRestrictions: string[] = [],
) {
  return {
    language,
    measurementSystem: "imperial" as const,
    dietaryRestrictions,
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
    createUserContext("en", ["dairy"]),
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
    createUserContext("es", ["dairy"]),
  );

  assertEquals(result.length, 1);
  assertExists(result[0].allergenVerificationWarning);
  assertEquals(
    result[0].allergenVerificationWarning,
    "La verificación de alérgenos no está disponible temporalmente. Revisa los ingredientes antes de cocinar.",
  );
});

Deno.test("searchRecipes splits multi-word query for name and tag filters", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [],
    matchingTagsData: [],
    recipeTagJoinsData: [],
  });

  await searchRecipes(
    supabase,
    { query: "tinga de pollo", limit: 5 },
    createUserContext("en"),
  );

  assertEquals(supabase.calls.recipeNameOr.length > 0, true);
  const nameFilter = supabase.calls.recipeNameOr[0];
  assert(nameFilter.includes("name_en.ilike.%tinga de pollo%"));
  assert(nameFilter.includes("name_en.ilike.%tinga%"));
  assert(nameFilter.includes("name_en.ilike.%pollo%"));
  assertEquals(nameFilter.includes("name_en.ilike.%de%"), false);

  assertEquals(supabase.calls.tagNameOr.length > 0, true);
  const tagFilter = supabase.calls.tagNameOr[0];
  assert(tagFilter.includes("name_en.ilike.%tinga de pollo%"));
  assert(tagFilter.includes("name_en.ilike.%tinga%"));
  assert(tagFilter.includes("name_en.ilike.%pollo%"));
});

Deno.test("searchRecipes keeps single-word query unchanged in OR filter", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [],
    matchingTagsData: [],
    recipeTagJoinsData: [],
  });

  await searchRecipes(
    supabase,
    { query: "pasta", limit: 5 },
    createUserContext("en"),
  );

  assertEquals(
    supabase.calls.recipeNameOr[0],
    "name_en.ilike.%pasta%,name_es.ilike.%pasta%",
  );
});

Deno.test("searchRecipes keeps strict DB filters for filter-only requests", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [{
      id: "recipe-1",
      name_en: "Simple Pasta",
      name_es: "Pasta Simple",
      image_url: null,
      total_time: 25,
      difficulty: "easy",
      portions: 2,
      recipe_to_tag: [],
    }],
  });

  await searchRecipes(
    supabase,
    { difficulty: "easy", maxTime: 30, limit: 5 },
    createUserContext("en"),
  );

  assertEquals(
    supabase.calls.recipeEq.some((call: { column: string; value: unknown }) =>
      call.column === "difficulty" && call.value === "easy"
    ),
    true,
  );
  assertEquals(
    supabase.calls.recipeLte.some((call: { column: string; value: unknown }) =>
      call.column === "total_time" && call.value === 30
    ),
    true,
  );
});

Deno.test("searchRecipes query mode keeps near-over-time matches and ranks them lower", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name_en: "Quick Pasta",
        name_es: "Pasta Rápida",
        image_url: null,
        total_time: 30,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name_en: "Slow Pasta",
        name_es: "Pasta Lenta",
        image_url: null,
        total_time: 34,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
    ],
  });

  const result = await searchRecipes(
    supabase,
    { query: "pasta", maxTime: 30, limit: 5 },
    createUserContext("en"),
  );

  // Query searches should broaden candidates and rank by proximity.
  assertEquals(
    supabase.calls.recipeLte.some((call: { column: string }) =>
      call.column === "total_time"
    ),
    false,
  );
  assertEquals(result.length, 2);
  assertEquals(result[0].recipeId, "11111111-1111-1111-1111-111111111111");
  assertEquals(result[1].recipeId, "22222222-2222-2222-2222-222222222222");
});

// ============================================================
// filterByAllKeywords (pure function, no DB dependency)
// ============================================================

function makeRecipeWithTags(
  id: string,
  tags: Array<{ name_en: string | null; name_es: string | null }>,
) {
  return {
    id,
    name_en: id,
    name_es: null,
    image_url: null,
    total_time: 30,
    difficulty: "easy" as const,
    portions: 4,
    recipe_to_tag: tags.map((t) => ({
      recipe_tags: { name_en: t.name_en, name_es: t.name_es, categories: [] },
    })),
  };
}

Deno.test("filterByAllKeywords - single word query passes all recipes through", () => {
  const recipes = [
    makeRecipeWithTags("r1", [{ name_en: "chicken", name_es: "pollo" }]),
    makeRecipeWithTags("r2", [{ name_en: "pasta", name_es: "pasta" }]),
  ];
  const result = filterByAllKeywords(recipes, "chicken");
  assertEquals(result.length, 2);
});

Deno.test("filterByAllKeywords - multi-word query keeps recipes matching all keywords", () => {
  const recipes = [
    makeRecipeWithTags("both", [
      { name_en: "chicken", name_es: "pollo" },
      { name_en: "pasta", name_es: "pasta" },
    ]),
    makeRecipeWithTags("chicken-only", [
      { name_en: "chicken", name_es: "pollo" },
    ]),
    makeRecipeWithTags("pasta-only", [
      { name_en: "pasta", name_es: "pasta" },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "chicken pasta");
  assertEquals(result.length, 1);
  assertEquals(result[0].id, "both");
});

Deno.test("filterByAllKeywords - matches Spanish tags too", () => {
  const recipes = [
    makeRecipeWithTags("r1", [
      { name_en: null, name_es: "pollo" },
      { name_en: null, name_es: "pasta" },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "pollo pasta");
  assertEquals(result.length, 1);
});

Deno.test("filterByAllKeywords - short keywords (<=2 chars) are ignored", () => {
  const recipes = [
    makeRecipeWithTags("r1", [{ name_en: "chicken", name_es: "pollo" }]),
  ];
  // "de" is 2 chars, filtered out — only "chicken" remains → single keyword → pass-through
  const result = filterByAllKeywords(recipes, "chicken de");
  assertEquals(result.length, 1);
});

Deno.test("filterByAllKeywords - empty recipes returns empty", () => {
  const result = filterByAllKeywords([], "chicken pasta");
  assertEquals(result.length, 0);
});

Deno.test("filterByAllKeywords - case insensitive matching", () => {
  const recipes = [
    makeRecipeWithTags("r1", [
      { name_en: "Chicken", name_es: null },
      { name_en: "Pasta", name_es: null },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "CHICKEN PASTA");
  assertEquals(result.length, 1);
});

Deno.test("filterByAllKeywords - partial tag match works", () => {
  const recipes = [
    makeRecipeWithTags("r1", [
      { name_en: "chicken breast", name_es: null },
      { name_en: "pasta dish", name_es: null },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "chicken pasta");
  assertEquals(result.length, 1);
});
