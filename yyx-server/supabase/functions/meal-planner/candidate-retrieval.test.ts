import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
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
    foodGroups: ["protein", "carb"],
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
