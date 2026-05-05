import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { RecipeCandidate } from "./candidate-retrieval.ts";
import type { MealSlot } from "./slot-classifier.ts";
import {
  buildBundle,
  type PairingLookup,
  templateForComponentCount,
} from "./bundle-builder.ts";

function mkCandidate(
  id: string,
  overrides: Partial<RecipeCandidate> = {},
): RecipeCandidate {
  return {
    id,
    title: `Recipe ${id}`,
    plannerRole: "main",
    mealComponents: ["protein"],
    isComplete: false,
    totalTimeMinutes: 30,
    difficulty: "medium",
    portions: 2,
    imageUrl: null,
    leftoversFriendly: false,
    batchFriendly: null,
    maxHouseholdSizeSupported: null,
    equipmentTags: [],
    cookingLevel: null,
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

Deno.test("buildBundle: non-conflicted pairing target is included", () => {
  const primary = mkCandidate("primary-1", { mealComponents: ["protein"] });
  const side = mkCandidate("side-1", {
    plannerRole: "side",
    mealComponents: ["carb"],
    hasAllergenConflict: false,
  });
  const pairings: PairingLookup = {
    byRole: new Map([[
      primary.id,
      new Map([[
        "side",
        [{
          source_recipe_id: primary.id,
          target_recipe_id: side.id,
          pairing_role: "side",
          reason: "starch fit",
        }],
      ]]),
    ]]),
    candidatesById: new Map([[side.id, side]]),
  };

  const components = buildBundle(mkSlot(), primary, pairings);
  assertEquals(components.length, 2);
  assertEquals(components[0].recipeId, primary.id);
  assertEquals(components[1].recipeId, side.id);
});

Deno.test("buildBundle: paired side excluded when already assigned; next valid pairing in same role is used", () => {
  const primary = mkCandidate("primary-exclude", {
    mealComponents: ["protein"],
  });
  const duplicateSide = mkCandidate("duplicate-side", {
    plannerRole: "side",
    mealComponents: ["carb"],
  });
  const nextSide = mkCandidate("next-side", {
    plannerRole: "side",
    mealComponents: ["veg"],
  });
  const pairings: PairingLookup = {
    byRole: new Map([[
      primary.id,
      new Map([[
        "side",
        [
          {
            source_recipe_id: primary.id,
            target_recipe_id: duplicateSide.id,
            pairing_role: "side",
            reason: "first but already used",
          },
          {
            source_recipe_id: primary.id,
            target_recipe_id: nextSide.id,
            pairing_role: "side",
            reason: "second valid option",
          },
        ],
      ]]),
    ]]),
    candidatesById: new Map([
      [duplicateSide.id, duplicateSide],
      [nextSide.id, nextSide],
    ]),
  };

  const components = buildBundle(
    mkSlot(),
    primary,
    pairings,
    new Set([duplicateSide.id]),
  );

  assertEquals(components.map((c) => c.recipeId), [primary.id, nextSide.id]);
});

Deno.test("buildBundle: allergen-conflicted pairing target is dropped", () => {
  const primary = mkCandidate("primary-2", { mealComponents: ["protein"] });
  const unsafeSide = mkCandidate("unsafe-side", {
    plannerRole: "side",
    mealComponents: ["carb"],
    hasAllergenConflict: true,
    allergenMatches: ["gluten"],
  });
  const pairings: PairingLookup = {
    byRole: new Map([[
      primary.id,
      new Map([[
        "side",
        [{
          source_recipe_id: primary.id,
          target_recipe_id: unsafeSide.id,
          pairing_role: "side",
          reason: null,
        }],
      ]]),
    ]]),
    candidatesById: new Map([[unsafeSide.id, unsafeSide]]),
  };

  const components = buildBundle(mkSlot(), primary, pairings);
  assertEquals(components.length, 1);
  assertEquals(components[0].recipeId, primary.id);
  for (const c of components) assertNotEquals(c.recipeId, unsafeSide.id);
});

Deno.test("buildBundle: allergen-conflicted condiment is dropped", () => {
  const primary = mkCandidate("primary-3", {
    mealComponents: ["protein", "carb", "veg"],
  });
  const unsafeCondiment = mkCandidate("bad-condiment", {
    plannerRole: "condiment",
    mealComponents: [],
    hasAllergenConflict: true,
    allergenMatches: ["nuts"],
  });
  const safeCondiment = mkCandidate("good-condiment", {
    plannerRole: "condiment",
    mealComponents: [],
    hasAllergenConflict: false,
  });

  const pairings: PairingLookup = {
    byRole: new Map([[
      primary.id,
      new Map([[
        "condiment",
        [
          {
            source_recipe_id: primary.id,
            target_recipe_id: unsafeCondiment.id,
            pairing_role: "condiment",
            reason: null,
          },
          {
            source_recipe_id: primary.id,
            target_recipe_id: safeCondiment.id,
            pairing_role: "condiment",
            reason: null,
          },
        ],
      ]]),
    ]]),
    candidatesById: new Map([
      [unsafeCondiment.id, unsafeCondiment],
      [safeCondiment.id, safeCondiment],
    ]),
  };

  const slot: MealSlot = {
    ...mkSlot(),
    structureTemplate: "main_plus_two_components",
  };
  const components = buildBundle(slot, primary, pairings);
  // Primary plus the safe condiment. The unsafe condiment must not appear.
  const recipeIds = components.map((c) => c.recipeId);
  assertEquals(recipeIds, [primary.id, safeCondiment.id]);
  for (const id of recipeIds) {
    assertNotEquals(id, unsafeCondiment.id);
  }
});

Deno.test("buildBundle: safe condiment can attach after structure coverage is filled", () => {
  const primary = mkCandidate("primary-4", { mealComponents: ["protein"] });
  const side = mkCandidate("side-4", {
    plannerRole: "side",
    mealComponents: ["carb"],
  });
  const condiment = mkCandidate("salsa-4", {
    plannerRole: "condiment",
    mealComponents: [],
  });
  const pairings: PairingLookup = {
    byRole: new Map([[
      primary.id,
      new Map([
        [
          "side",
          [{
            source_recipe_id: primary.id,
            target_recipe_id: side.id,
            pairing_role: "side",
            reason: "rice fit",
          }],
        ],
        [
          "condiment",
          [{
            source_recipe_id: primary.id,
            target_recipe_id: condiment.id,
            pairing_role: "condiment",
            reason: "salsa fit",
          }],
        ],
      ]),
    ]]),
    candidatesById: new Map([
      [side.id, side],
      [condiment.id, condiment],
    ]),
  };

  const components = buildBundle(mkSlot(), primary, pairings);

  assertEquals(components.map((c) => c.recipeId), [
    primary.id,
    side.id,
    condiment.id,
  ]);
  assertEquals(components.map((c) => c.role), ["main", "side", "condiment"]);
});

Deno.test("templateForComponentCount: maps component counts to structure_template values", () => {
  assertEquals(templateForComponentCount(0), "single_component");
  assertEquals(templateForComponentCount(1), "single_component");
  assertEquals(templateForComponentCount(2), "main_plus_one_component");
  assertEquals(templateForComponentCount(3), "main_plus_two_components");
  assertEquals(templateForComponentCount(99), "main_plus_two_components");
});

Deno.test("buildBundle: primary component role follows leaf slot meal type", () => {
  const snack = mkCandidate("snack-1", {
    plannerRole: "snack",
    mealComponents: [],
  });
  const snackComponents = buildBundle(
    mkSlot({
      slotId: "0-snack",
      canonicalMealType: "snack",
      displayMealLabel: "snack",
      structureTemplate: "single_component",
    }),
    snack,
    { byRole: new Map(), candidatesById: new Map() },
  );

  assertEquals(snackComponents[0].role, "snack");
});

Deno.test("buildBundle: dinner primary component role remains main", () => {
  const dinner = mkCandidate("dinner-1", {
    plannerRole: "main",
    mealComponents: ["protein"],
  });
  const dinnerComponents = buildBundle(
    mkSlot({ canonicalMealType: "dinner" }),
    dinner,
    { byRole: new Map(), candidatesById: new Map() },
  );

  assertEquals(dinnerComponents[0].role, "main");
});
