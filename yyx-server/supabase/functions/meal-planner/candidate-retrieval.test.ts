import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCanonicalIngredientMap,
  fetchCandidates,
  isAlternateRoleMatch,
  type RecipeCandidate,
  satisfiesRoleConditionalMealComponents,
  shortlistCandidatesForSlot,
} from "./candidate-retrieval.ts";
import type { MealSlot } from "./slot-classifier.ts";
import { RETRIEVAL_LIMITS } from "./scoring-config.ts";
import { clearAliasCache } from "../_shared/ingredient-normalization.ts";

function mkSlot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    slotId: "0-dinner",
    plannedDate: "2026-04-13",
    dayIndex: 0,
    canonicalMealType: "dinner",
    displayMealLabel: "dinner",
    slotKind: "cook_slot",
    isBusyDay: false,
    isWeekend: false,
    prefersLeftovers: false,
    feedsFutureLeftoverTarget: false,
    structureTemplate: "main_plus_one_component",
    expectedMealComponents: ["protein", "carb", "veg"],
    ...overrides,
  };
}

function mkCandidate(
  id: string,
  overrides: Partial<RecipeCandidate> = {},
): RecipeCandidate {
  return {
    id,
    title: `Recipe ${id}`,
    plannerRole: "main",
    mealComponents: ["protein", "carb"],
    isComplete: false,
    totalTimeMinutes: 75,
    difficulty: "hard",
    portions: 2,
    imageUrl: null,
    leftoversFriendly: false,
    batchFriendly: null,
    maxHouseholdSizeSupported: null,
    equipmentTags: [],
    cookingLevel: "experienced",
    verifiedAt: null,
    isPublished: true,
    ingredientIds: [],
    ingredientKeys: [],
    cuisineTags: [],
    mealTypeTags: ["dinner"],
    hasAllergenConflict: false,
    allergenMatches: [],
    hasDislikeConflict: false,
    dislikeMatches: [],
    alternatePlannerRoles: [],
    ...overrides,
  };
}

Deno.test("shortlistCandidatesForSlot keeps a high-fit busy-day candidate even when its id sorts after the first 30", () => {
  const slot = mkSlot({ isBusyDay: true });
  const mediocre = Array.from(
    { length: RETRIEVAL_LIMITS.cookSlotTopN },
    (_, index) => mkCandidate(`a-${index.toString().padStart(2, "0")}`),
  );
  const standout = mkCandidate("z-standout", {
    totalTimeMinutes: 20,
    difficulty: "easy",
    cookingLevel: "beginner",
    isComplete: true,
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  const shortlist = shortlistCandidatesForSlot(slot, [...mediocre, standout]);
  const ids = shortlist.map((candidate) => candidate.id);

  assertEquals(shortlist.length, RETRIEVAL_LIMITS.cookSlotTopN);
  assertEquals(ids.includes("z-standout"), true);
  assertEquals(ids.includes("a-29"), false);
});

Deno.test("shortlistCandidatesForSlot keeps a leftovers-friendly source candidate when the slot feeds a future leftover target", () => {
  const slot = mkSlot({ feedsFutureLeftoverTarget: true });
  const mediocre = Array.from(
    { length: RETRIEVAL_LIMITS.cookSlotTopN },
    (_, index) =>
      mkCandidate(`b-${index.toString().padStart(2, "0")}`, {
        totalTimeMinutes: 45,
        difficulty: "medium",
        cookingLevel: "intermediate",
      }),
  );
  const standout = mkCandidate("z-leftover-source", {
    leftoversFriendly: true,
    batchFriendly: true,
    portions: 8,
    totalTimeMinutes: 40,
  });

  const shortlist = shortlistCandidatesForSlot(slot, [...mediocre, standout]);
  const ids = shortlist.map((candidate) => candidate.id);

  assertEquals(shortlist.length, RETRIEVAL_LIMITS.cookSlotTopN);
  assertEquals(ids.includes("z-leftover-source"), true);
  assertEquals(ids.includes("b-29"), false);
});

Deno.test("isAlternateRoleMatch: primary plannerRole match returns false", () => {
  // dinner expects ['main']; a `main` recipe is a primary match.
  const slot = mkSlot({ canonicalMealType: "dinner" });
  const candidate = mkCandidate("primary-main", { plannerRole: "main" });
  assertEquals(isAlternateRoleMatch(slot, candidate), false);
});

Deno.test("isAlternateRoleMatch: alternate role match returns true", () => {
  // snack slot expects ['snack']. Hummus is plannerRole='side' with
  // alternates=['snack'] — it qualifies for the snack slot only via its
  // alternates list, so the primary-role-preference penalty applies.
  const slot = mkSlot({ canonicalMealType: "snack" });
  const hummus = mkCandidate("hummus", {
    plannerRole: "side",
    alternatePlannerRoles: ["snack"],
  });
  assertEquals(isAlternateRoleMatch(slot, hummus), true);
});

Deno.test("isAlternateRoleMatch: no role match either way returns false", () => {
  // dessert slot expects ['dessert']. A main recipe with no alternates
  // doesn't match at all — function still returns false (it's not even a
  // candidate). The scorer wouldn't see this case in practice since
  // splitCandidatesBySlot would have filtered it out.
  const slot = mkSlot({ canonicalMealType: "dessert" });
  const main = mkCandidate("not-a-dessert", { plannerRole: "main" });
  assertEquals(isAlternateRoleMatch(slot, main), false);
});

Deno.test("isAlternateRoleMatch: breakfast accepts main OR snack as primary", () => {
  // breakfast expects ['main', 'snack'] (per MEAL_TYPE_PRIMARY_ROLES).
  // A snack-role recipe at breakfast is a PRIMARY match, not alternate.
  const slot = mkSlot({ canonicalMealType: "breakfast" });
  const snackRecipe = mkCandidate("granola", { plannerRole: "snack" });
  assertEquals(isAlternateRoleMatch(slot, snackRecipe), false);
});

Deno.test("satisfiesRoleConditionalMealComponents: snack with empty meal_components passes", () => {
  // No alternate role into main/side — snack is a leaf role that doesn't
  // require meal_components.
  assertEquals(
    satisfiesRoleConditionalMealComponents({
      planner_role: "snack",
      alternate_planner_roles: [],
      meal_components: [],
    }),
    true,
  );
});

Deno.test("satisfiesRoleConditionalMealComponents: snack with alt=['main'] and empty meal_components is REJECTED", () => {
  // The bug this test pins: previously the gate only checked the primary
  // role and let this through. Now we require meal_components when ANY role
  // (primary or alternate) is in main/side.
  assertEquals(
    satisfiesRoleConditionalMealComponents({
      planner_role: "snack",
      alternate_planner_roles: ["main"],
      meal_components: [],
    }),
    false,
  );
});

Deno.test("satisfiesRoleConditionalMealComponents: snack with alt=['main'] and meal_components=['protein'] passes", () => {
  assertEquals(
    satisfiesRoleConditionalMealComponents({
      planner_role: "snack",
      alternate_planner_roles: ["main"],
      meal_components: ["protein"],
    }),
    true,
  );
});

Deno.test("satisfiesRoleConditionalMealComponents: side with alt=['snack'] and empty meal_components passes", () => {
  assertEquals(
    satisfiesRoleConditionalMealComponents({
      planner_role: "side",
      alternate_planner_roles: ["snack"],
      meal_components: [],
    }),
    true,
  );
});

Deno.test("satisfiesRoleConditionalMealComponents: alt=['side'] from a beverage primary passes", () => {
  // Per recipe-role-model.md §6.1 accepted 2026-04-17 amendment, sides do
  // not require meal_components. Only main-role eligibility is gated.
  assertEquals(
    satisfiesRoleConditionalMealComponents({
      planner_role: "beverage",
      alternate_planner_roles: ["side"],
      meal_components: [],
    }),
    true,
  );
});

Deno.test("satisfiesRoleConditionalMealComponents: missing planner_role is rejected outright", () => {
  assertEquals(
    satisfiesRoleConditionalMealComponents({
      planner_role: null,
      alternate_planner_roles: [],
      meal_components: ["protein"],
    }),
    false,
  );
});

// ============================================================================
// buildCanonicalIngredientMap — locale-aware canonicalization
// ============================================================================

/**
 * Tiny stub supabase that returns a hard-coded `ingredient_aliases` table.
 * Every other query returns an empty result. Mirrors the shape that
 * `loadAliases` in `_shared/ingredient-normalization.ts` expects.
 */
function makeMockSupabaseWithAliases(
  aliases: Array<{
    canonical: string;
    alias: string;
    locale: string;
  }>,
): any {
  return {
    from(table: string) {
      const builder: any = {
        select: () =>
          Promise.resolve({
            data: table === "ingredient_aliases" ? aliases : [],
            error: null,
          }),
      };
      return builder;
    },
  };
}

Deno.test("buildCanonicalIngredientMap: es 'pollo' resolves to canonical 'chicken'", async () => {
  // This is the critical fix. Before the canonicalization pass, an es user's
  // ingredientKeys would contain `pollo` and `cacahuates`, and the allergen
  // check (against `allergen_groups.ingredient_canonical = 'chicken' / 'peanut_butter'`)
  // would silently fail.
  clearAliasCache();

  const mock = makeMockSupabaseWithAliases([
    { canonical: "chicken", alias: "pollo", locale: "es" },
    { canonical: "peanut_butter", alias: "crema de cacahuate", locale: "es" },
    { canonical: "rice", alias: "arroz", locale: "es" },
  ]);

  const rows = [
    {
      recipe_ingredients: [
        {
          ingredients: {
            ingredient_translations: [
              { locale: "es", name: "pollo" },
              { locale: "en", name: "chicken" },
            ],
          },
        },
        {
          ingredients: {
            ingredient_translations: [
              { locale: "es", name: "arroz" },
              { locale: "en", name: "rice" },
            ],
          },
        },
      ],
    },
  ];

  const map = await buildCanonicalIngredientMap(mock, rows, ["es-MX", "es"]);
  assertEquals(map.get("pollo"), "chicken");
  assertEquals(map.get("arroz"), "rice");

  clearAliasCache();
});

Deno.test("buildCanonicalIngredientMap: returns empty map when no ingredients present", async () => {
  clearAliasCache();
  const mock = makeMockSupabaseWithAliases([]);
  const map = await buildCanonicalIngredientMap(mock, [], ["en"]);
  assertEquals(map.size, 0);
  clearAliasCache();
});

Deno.test("buildCanonicalIngredientMap: deduplicates repeated raw names", async () => {
  clearAliasCache();
  const mock = makeMockSupabaseWithAliases([
    { canonical: "onion", alias: "cebolla", locale: "es" },
  ]);
  // Two rows, both using 'cebolla' — expect a single normalizeIngredients
  // input and a single map entry.
  const rows = [
    {
      recipe_ingredients: [
        {
          ingredients: {
            ingredient_translations: [{ locale: "es", name: "cebolla" }],
          },
        },
      ],
    },
    {
      recipe_ingredients: [
        {
          ingredients: {
            ingredient_translations: [{ locale: "es", name: "cebolla" }],
          },
        },
      ],
    },
  ];
  const map = await buildCanonicalIngredientMap(mock, rows, ["es"]);
  assertEquals(map.size, 1);
  assertEquals(map.get("cebolla"), "onion");
  clearAliasCache();
});

function makeRawRecipeRow(
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id,
    planner_role: "main",
    alternate_planner_roles: [],
    meal_components: ["protein"],
    is_complete_meal: true,
    total_time: 30,
    difficulty: "easy",
    portions: 4,
    image_url: null,
    leftovers_friendly: false,
    batch_friendly: null,
    max_household_size_supported: null,
    equipment_tags: [],
    cooking_level: "beginner",
    verified_at: null,
    is_published: true,
    recipe_translations: [{ locale: "en", name: `Recipe ${id}` }],
    recipe_ingredients: [],
    recipe_to_tag: [mealTypeTag("Dinner")],
    ...overrides,
  };
}

function mealTypeTag(name: string): Record<string, unknown> {
  return {
    recipe_tags: {
      categories: ["MEAL_TYPE"],
      recipe_tag_translations: [{ locale: "en", name }],
    },
  };
}

function makeFetchCandidatesSupabase(
  primaryRoleRows: Record<string, unknown>[],
  alternateRoleRows: Record<string, unknown>[],
): { client: any; calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    client: {
      from(table: string) {
        let queryKind: "primary" | "alternate" | "other" = "other";
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          not: () => builder,
          neq: () => builder,
          in: (column: string) => {
            if (table === "recipes" && column === "planner_role") {
              queryKind = "primary";
              calls.push("planner_role");
            }
            return builder;
          },
          overlaps: (column: string) => {
            if (table === "recipes" && column === "alternate_planner_roles") {
              queryKind = "alternate";
              calls.push("alternate_planner_roles");
            }
            return builder;
          },
          then: (
            resolve: (value: {
              data: Record<string, unknown>[];
              error: null;
            }) => void,
          ) => {
            if (table !== "recipes") {
              resolve({ data: [], error: null });
              return;
            }
            resolve({
              data: queryKind === "alternate"
                ? alternateRoleRows
                : primaryRoleRows,
              error: null,
            });
          },
        };
        return builder;
      },
    },
  };
}

Deno.test("fetchCandidates merges primary-role and alternate-role queries without duplicates", async () => {
  const primaryMatch = makeRawRecipeRow("primary-match", {
    planner_role: "main",
    alternate_planner_roles: [],
  });
  const alternateOnlyMatch = makeRawRecipeRow("alternate-only", {
    planner_role: "snack",
    alternate_planner_roles: ["main"],
  });
  const duplicateAcrossQueries = makeRawRecipeRow("duplicate", {
    planner_role: "main",
    alternate_planner_roles: ["snack"],
  });

  const { client, calls } = makeFetchCandidatesSupabase(
    [primaryMatch, duplicateAcrossQueries],
    [alternateOnlyMatch, duplicateAcrossQueries],
  );

  const slot = mkSlot({ canonicalMealType: "dinner" });
  const result = await fetchCandidates([slot], {
    supabase: client,
    locale: "en",
    localeChain: ["en"],
    dietaryRestrictions: [],
    ingredientDislikes: [],
    hardExcludedRecipeIds: new Set(),
  });

  const candidates = result.get(slot.slotId) ?? [];
  const ids = candidates.map((candidate) => candidate.id).sort();

  assertEquals(calls, ["planner_role", "alternate_planner_roles"]);
  assertEquals(ids, ["alternate-only", "duplicate", "primary-match"]);
});

Deno.test("fetchCandidates excludes recipes with no meal-type tags", async () => {
  const untagged = makeRawRecipeRow("untagged", {
    recipe_to_tag: [],
  });
  const { client } = makeFetchCandidatesSupabase([untagged], []);
  const warnings: string[] = [];
  const slot = mkSlot({ canonicalMealType: "dinner" });

  const result = await fetchCandidates([slot], {
    supabase: client,
    locale: "en",
    localeChain: ["en"],
    dietaryRestrictions: [],
    ingredientDislikes: [],
    hardExcludedRecipeIds: new Set(),
    warnings,
  });

  assertEquals(result.get(slot.slotId), []);
  assertEquals(warnings, ["MISSING_MEAL_TYPE_TAGS:meal_type=dinner"]);
});

Deno.test("fetchCandidates keeps dinner-tagged recipe for dinner but not breakfast", async () => {
  const dinnerOnly = makeRawRecipeRow("dinner-only", {
    recipe_to_tag: [mealTypeTag("Dinner")],
  });
  const { client } = makeFetchCandidatesSupabase([dinnerOnly], []);
  const dinnerSlot = mkSlot({
    slotId: "0-dinner",
    canonicalMealType: "dinner",
  });
  const breakfastSlot = mkSlot({
    slotId: "0-breakfast",
    canonicalMealType: "breakfast",
    displayMealLabel: "breakfast",
    structureTemplate: "single_component",
    expectedMealComponents: [],
  });

  const result = await fetchCandidates([dinnerSlot, breakfastSlot], {
    supabase: client,
    locale: "en",
    localeChain: ["en"],
    dietaryRestrictions: [],
    ingredientDislikes: [],
    hardExcludedRecipeIds: new Set(),
  });

  assertEquals(
    (result.get(dinnerSlot.slotId) ?? []).map((candidate) => candidate.id),
    ["dinner-only"],
  );
  assertEquals(result.get(breakfastSlot.slotId), []);
});

Deno.test("fetchCandidates allows recipes tagged for both lunch and dinner in both slots", async () => {
  const lunchDinner = makeRawRecipeRow("lunch-dinner", {
    recipe_to_tag: [mealTypeTag("Lunch"), mealTypeTag("Dinner")],
  });
  const { client } = makeFetchCandidatesSupabase([lunchDinner], []);
  const lunchSlot = mkSlot({
    slotId: "0-lunch",
    canonicalMealType: "lunch",
    displayMealLabel: "lunch",
  });
  const dinnerSlot = mkSlot({
    slotId: "0-dinner",
    canonicalMealType: "dinner",
  });

  const result = await fetchCandidates([lunchSlot, dinnerSlot], {
    supabase: client,
    locale: "en",
    localeChain: ["en"],
    dietaryRestrictions: [],
    ingredientDislikes: [],
    hardExcludedRecipeIds: new Set(),
  });

  assertEquals(
    (result.get(lunchSlot.slotId) ?? []).map((candidate) => candidate.id),
    ["lunch-dinner"],
  );
  assertEquals(
    (result.get(dinnerSlot.slotId) ?? []).map((candidate) => candidate.id),
    ["lunch-dinner"],
  );
});
