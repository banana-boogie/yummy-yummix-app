import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isAlternateRoleMatch,
  type RecipeCandidate,
  shortlistCandidatesForSlot,
} from "./candidate-retrieval.ts";
import type { MealSlot } from "./slot-classifier.ts";
import { RETRIEVAL_LIMITS } from "./scoring-config.ts";

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
