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
    foodGroups: ["protein"],
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
    hasAllergenConflict: false,
    allergenMatches: [],
    hasDislikeConflict: false,
    dislikeMatches: [],
    ...overrides,
  };
}

function mkSlot(): MealSlot {
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
  };
}

Deno.test("buildBundle: non-conflicted pairing target is included", () => {
  const primary = mkCandidate("primary-1", { foodGroups: ["protein"] });
  const side = mkCandidate("side-1", {
    plannerRole: "side",
    foodGroups: ["carb"],
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

Deno.test("buildBundle: allergen-conflicted pairing target is dropped", () => {
  const primary = mkCandidate("primary-2", { foodGroups: ["protein"] });
  const unsafeSide = mkCandidate("unsafe-side", {
    plannerRole: "side",
    foodGroups: ["carb"],
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
  const primary = mkCandidate("primary-3", { foodGroups: ["protein", "carb"] });
  const unsafeCondiment = mkCandidate("bad-condiment", {
    plannerRole: "condiment",
    foodGroups: [],
    hasAllergenConflict: true,
    allergenMatches: ["nuts"],
  });
  const safeCondiment = mkCandidate("good-condiment", {
    plannerRole: "condiment",
    foodGroups: [],
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
  for (const id of recipeIds) {
    assertNotEquals(id, unsafeCondiment.id);
  }
});

Deno.test("templateForComponentCount: maps component counts to structure_template values", () => {
  assertEquals(templateForComponentCount(0), "single_component");
  assertEquals(templateForComponentCount(1), "single_component");
  assertEquals(templateForComponentCount(2), "main_plus_one_component");
  assertEquals(templateForComponentCount(3), "main_plus_two_components");
  assertEquals(templateForComponentCount(99), "main_plus_two_components");
});
