import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { clearAllergenCache } from "../allergen-filter.ts";
import type { RecipeCard } from "../irmixy-schemas.ts";
import {
  filterByAllKeywords,
  formatRestrictionLabel,
  getAlreadyShownRecipeIds,
  RESTRICTION_LABELS,
  searchRecipes,
} from "./search-recipes.ts";
import type { SearchRecipeResult } from "./search-recipes.ts";
type MockResult = { data: unknown; error: unknown };

/** Narrow SearchRecipeResult to RecipeCard[] — fails the test if it's a DedupFilteredResult. */
function asRecipeCards(result: SearchRecipeResult): RecipeCard[] {
  assert(
    Array.isArray(result),
    "Expected RecipeCard[] but got DedupFilteredResult",
  );
  return result;
}

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

      if (table === "recipe_tag_translations") {
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
  locale: string,
  dietaryRestrictions: string[] = [],
) {
  const localeChain = locale === "es" ? ["es", "en"] : ["en"];
  const language: "en" | "es" = locale === "es" ? "es" : "en";
  return {
    locale,
    localeChain,
    language,
    measurementSystem: "imperial" as const,
    dietaryRestrictions,
    ingredientDislikes: [],
    skillLevel: null,
    householdSize: null,
    conversationHistory: [] as Array<
      { role: string; content: string; metadata?: any; toolSummary?: string }
    >,
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
      recipe_translations: [
        { locale: "en", name: "Creamy Pasta" },
        { locale: "es", name: "Pasta Cremosa" },
      ],
      image_url: null,
      total_time: 25,
      difficulty: "easy",
      portions: 2,
      recipe_to_tag: [],
    }],
    ingredientLookupError: { message: "db unavailable" },
  });

  const result = asRecipeCards(
    await searchRecipes(
      supabase,
      { maxTime: 30, limit: 5 },
      createUserContext("en", ["dairy"]),
    ),
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
      recipe_translations: [
        { locale: "en", name: "Creamy Pasta" },
        { locale: "es", name: "Pasta Cremosa" },
      ],
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

  const result = asRecipeCards(
    await searchRecipes(
      supabase,
      { maxTime: 30, limit: 5 },
      createUserContext("es", ["dairy"]),
    ),
  );

  assertEquals(result.length, 1);
  assertExists(result[0].allergenVerificationWarning);
  assertEquals(
    result[0].allergenVerificationWarning,
    "La verificación de alérgenos no está disponible temporalmente. Revisa los ingredientes antes de cocinar.",
  );
});

Deno.test("searchRecipes post-filters by query text across translations", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [
      {
        id: "recipe-1",
        recipe_translations: [
          { locale: "en", name: "Tinga de Pollo" },
          { locale: "es", name: "Tinga de Pollo" },
        ],
        image_url: null,
        total_time: 25,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
      {
        id: "recipe-2",
        recipe_translations: [
          { locale: "en", name: "Banana Bread" },
          { locale: "es", name: "Pan de Plátano" },
        ],
        image_url: null,
        total_time: 45,
        difficulty: "easy",
        portions: 4,
        recipe_to_tag: [],
      },
    ],
    matchingTagsData: [],
    recipeTagJoinsData: [],
  });

  const result = asRecipeCards(
    await searchRecipes(
      supabase,
      { query: "tinga", limit: 5 },
      createUserContext("en"),
    ),
  );

  // Post-filtering should only keep the recipe whose translation names contain "tinga"
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "Tinga de Pollo");
});

Deno.test("searchRecipes keeps strict DB filters for filter-only requests", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [{
      id: "recipe-1",
      recipe_translations: [
        { locale: "en", name: "Simple Pasta" },
        { locale: "es", name: "Pasta Simple" },
      ],
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
        recipe_translations: [
          { locale: "en", name: "Quick Pasta" },
          { locale: "es", name: "Pasta Rápida" },
        ],
        image_url: null,
        total_time: 30,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        recipe_translations: [
          { locale: "en", name: "Slow Pasta" },
          { locale: "es", name: "Pasta Lenta" },
        ],
        image_url: null,
        total_time: 34,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
    ],
  });

  const result = asRecipeCards(
    await searchRecipes(
      supabase,
      { query: "pasta", maxTime: 30, limit: 5 },
      createUserContext("en"),
    ),
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
  tags: Array<{ en: string | null; es: string | null }>,
) {
  return {
    id,
    recipe_translations: [{ locale: "en", name: id }],
    image_url: null,
    total_time: 30,
    difficulty: "easy" as const,
    portions: 4,
    recipe_to_tag: tags.map((t) => ({
      recipe_tags: {
        recipe_tag_translations: [
          ...(t.en ? [{ locale: "en", name: t.en }] : []),
          ...(t.es ? [{ locale: "es", name: t.es }] : []),
        ],
        categories: [],
      },
    })),
  };
}

// ============================================================
// formatRestrictionLabel — locale-aware allergen labels
// ============================================================

Deno.test("formatRestrictionLabel returns Mexican Spanish for 'es'", () => {
  assertEquals(formatRestrictionLabel("peanuts", "es"), "cacahuates");
  assertEquals(formatRestrictionLabel("nuts", "es"), "nueces");
});

Deno.test("formatRestrictionLabel returns Spain Spanish for 'es-ES'", () => {
  assertEquals(formatRestrictionLabel("peanuts", "es-ES"), "cacahuetes");
  assertEquals(formatRestrictionLabel("nuts", "es-ES"), "frutos secos");
});

Deno.test("formatRestrictionLabel falls back from es-ES to es for labels without es-ES variant", () => {
  // dairy has no es-ES entry, should fall back to es
  assertEquals(formatRestrictionLabel("dairy", "es-ES"), "lácteos");
});

Deno.test("formatRestrictionLabel falls back to en for unknown locale", () => {
  assertEquals(formatRestrictionLabel("peanuts", "fr"), "peanuts");
});

Deno.test("RESTRICTION_LABELS has es-ES variants for peanuts and nuts", () => {
  assertEquals(RESTRICTION_LABELS["peanuts"]["es-ES"], "cacahuetes");
  assertEquals(RESTRICTION_LABELS["nuts"]["es-ES"], "frutos secos");
});

// ============================================================
// filterByAllKeywords (pure function, no DB dependency)
// ============================================================

Deno.test("filterByAllKeywords - single word query passes all recipes through", () => {
  const recipes = [
    makeRecipeWithTags("r1", [{ en: "chicken", es: "pollo" }]),
    makeRecipeWithTags("r2", [{ en: "pasta", es: "pasta" }]),
  ];
  const result = filterByAllKeywords(recipes, "chicken");
  assertEquals(result.length, 2);
});

Deno.test("filterByAllKeywords - multi-word query keeps recipes matching all keywords", () => {
  const recipes = [
    makeRecipeWithTags("both", [
      { en: "chicken", es: "pollo" },
      { en: "pasta", es: "pasta" },
    ]),
    makeRecipeWithTags("chicken-only", [
      { en: "chicken", es: "pollo" },
    ]),
    makeRecipeWithTags("pasta-only", [
      { en: "pasta", es: "pasta" },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "chicken pasta");
  assertEquals(result.length, 1);
  assertEquals(result[0].id, "both");
});

Deno.test("filterByAllKeywords - matches Spanish tags too", () => {
  const recipes = [
    makeRecipeWithTags("r1", [
      { en: null, es: "pollo" },
      { en: null, es: "pasta" },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "pollo pasta");
  assertEquals(result.length, 1);
});

Deno.test("filterByAllKeywords - short keywords (<=2 chars) are ignored", () => {
  const recipes = [
    makeRecipeWithTags("r1", [{ en: "chicken", es: "pollo" }]),
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
      { en: "Chicken", es: null },
      { en: "Pasta", es: null },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "CHICKEN PASTA");
  assertEquals(result.length, 1);
});

Deno.test("filterByAllKeywords - partial tag match works", () => {
  const recipes = [
    makeRecipeWithTags("r1", [
      { en: "chicken breast", es: null },
      { en: "pasta dish", es: null },
    ]),
  ];
  const result = filterByAllKeywords(recipes, "chicken pasta");
  assertEquals(result.length, 1);
});

// ============================================================
// getAlreadyShownRecipeIds — session deduplication
// ============================================================

Deno.test("getAlreadyShownRecipeIds returns empty set for empty history", () => {
  const ids = getAlreadyShownRecipeIds([]);
  assertEquals(ids.size, 0);
});

Deno.test("getAlreadyShownRecipeIds extracts recipe IDs from metadata", () => {
  const history = [
    {
      role: "assistant",
      content: "Here are some recipes",
      metadata: {
        recipes: [
          { recipeId: "aaa", name: "Tinga" },
          { recipeId: "bbb", name: "Pasta" },
        ],
      },
    },
    { role: "user", content: "I don't like those" },
    {
      role: "assistant",
      content: "Here are more",
      metadata: {
        recipes: [{ recipeId: "ccc", name: "Mole" }],
      },
    },
  ];
  const ids = getAlreadyShownRecipeIds(history);
  assertEquals(ids.size, 3);
  assertEquals(ids.has("aaa"), true);
  assertEquals(ids.has("bbb"), true);
  assertEquals(ids.has("ccc"), true);
});

Deno.test("getAlreadyShownRecipeIds ignores messages without recipe metadata", () => {
  const history = [
    { role: "assistant", content: "Hello!", metadata: {} },
    { role: "user", content: "Hi" },
    { role: "assistant", content: "No recipes here" },
  ];
  const ids = getAlreadyShownRecipeIds(history);
  assertEquals(ids.size, 0);
});

Deno.test("getAlreadyShownRecipeIds deduplicates across messages", () => {
  const history = [
    {
      role: "assistant",
      content: "First",
      metadata: { recipes: [{ recipeId: "aaa" }] },
    },
    {
      role: "assistant",
      content: "Second",
      metadata: { recipes: [{ recipeId: "aaa" }, { recipeId: "bbb" }] },
    },
  ];
  const ids = getAlreadyShownRecipeIds(history);
  assertEquals(ids.size, 2);
});

Deno.test("getAlreadyShownRecipeIds skips null/undefined entries in recipes array", () => {
  const history = [
    {
      role: "assistant",
      content: "Test",
      metadata: { recipes: [null, undefined, { recipeId: "aaa" }, {}] },
    },
  ];
  const ids = getAlreadyShownRecipeIds(history);
  assertEquals(ids.size, 1);
  assertEquals(ids.has("aaa"), true);
});

Deno.test("searchRecipes multi-word query uses AND logic — 'miso soup' excludes 'Green Soup'", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [
      {
        id: "recipe-miso",
        recipe_translations: [
          { locale: "en", name: "Miso Soup" },
          { locale: "es", name: "Sopa de Miso" },
        ],
        image_url: null,
        total_time: 15,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
      {
        id: "recipe-green",
        recipe_translations: [
          { locale: "en", name: "Green Soup" },
          { locale: "es", name: "Sopa Verde" },
        ],
        image_url: null,
        total_time: 25,
        difficulty: "easy",
        portions: 4,
        recipe_to_tag: [],
      },
      {
        id: "recipe-broccoli",
        recipe_translations: [
          { locale: "en", name: "Broccoli Soup" },
          { locale: "es", name: "Sopa de Brócoli" },
        ],
        image_url: null,
        total_time: 30,
        difficulty: "easy",
        portions: 4,
        recipe_to_tag: [],
      },
    ],
    matchingTagsData: [],
    recipeTagJoinsData: [],
  });

  const result = asRecipeCards(
    await searchRecipes(
      supabase,
      { query: "miso soup", limit: 10 },
      createUserContext("en"),
    ),
  );

  // AND logic: individual terms "miso" AND "soup" must both match.
  // "Miso Soup" matches both. "Green Soup" only matches "soup". "Broccoli Soup" only matches "soup".
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "Miso Soup");
});

Deno.test("searchRecipes single-word query 'soup' still returns all soups", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [
      {
        id: "recipe-miso",
        recipe_translations: [{ locale: "en", name: "Miso Soup" }],
        image_url: null,
        total_time: 15,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
      {
        id: "recipe-green",
        recipe_translations: [{ locale: "en", name: "Green Soup" }],
        image_url: null,
        total_time: 25,
        difficulty: "easy",
        portions: 4,
        recipe_to_tag: [],
      },
    ],
    matchingTagsData: [],
    recipeTagJoinsData: [],
  });

  const result = asRecipeCards(
    await searchRecipes(
      supabase,
      { query: "soup", limit: 10 },
      createUserContext("en"),
    ),
  );

  // Single word "soup" — getSearchTerms returns ["soup"], which is both the full phrase
  // and the only individual term. Both recipes match.
  assertEquals(result.length, 2);
});

Deno.test("searchRecipes filters out already-shown recipes", async () => {
  const supabase = createMockSupabase({
    searchRecipesData: [
      {
        id: "recipe-1",
        recipe_translations: [{ locale: "en", name: "Tinga" }],
        image_url: null,
        total_time: 25,
        difficulty: "easy",
        portions: 2,
        recipe_to_tag: [],
      },
      {
        id: "recipe-2",
        recipe_translations: [{ locale: "en", name: "Mole" }],
        image_url: null,
        total_time: 45,
        difficulty: "easy",
        portions: 4,
        recipe_to_tag: [],
      },
    ],
  });

  const ctx = createUserContext("en");
  ctx.conversationHistory = [
    {
      role: "assistant",
      content: "Here's tinga",
      metadata: { recipes: [{ recipeId: "recipe-1" }] },
    },
  ];

  // Filter-only search — both recipes returned by mock, dedup removes recipe-1
  const result = asRecipeCards(
    await searchRecipes(
      supabase,
      { maxTime: 60, limit: 5 },
      ctx,
    ),
  );

  assertEquals(result.length, 1);
  assertEquals(result[0].recipeId, "recipe-2");
});
