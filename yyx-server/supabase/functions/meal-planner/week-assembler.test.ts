import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assembleWeek } from "./week-assembler.ts";
import type { CandidateMap, RecipeCandidate } from "./candidate-retrieval.ts";
import type { MealSlot } from "./slot-classifier.ts";
import type { UserContext } from "./scoring/types.ts";
import type { PairingLookup } from "./bundle-builder.ts";
import { renderSelectionReason } from "./selection-reason-templates.ts";

function mkSlot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    slotId: "1-dinner",
    plannedDate: "2026-04-14",
    dayIndex: 1,
    canonicalMealType: "dinner",
    displayMealLabel: "dinner",
    slotKind: "cook_slot",
    isBusyDay: false,
    isWeekend: false,
    prefersLeftovers: false,
    feedsFutureLeftoverTarget: false,
    structureTemplate: "single_component",
    expectedMealComponents: [],
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
    totalTimeMinutes: 30,
    difficulty: "medium",
    portions: 2,
    imageUrl: null,
    leftoversFriendly: false,
    batchFriendly: null,
    maxHouseholdSizeSupported: null,
    equipmentTags: [],
    cookingLevel: "intermediate",
    verifiedAt: null,
    isPublished: true,
    ingredientIds: ["ing-generic"],
    ingredientKeys: ["generic_ingredient"],
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

function mkUser(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: "u1",
    locale: "en",
    localeChain: ["en"],
    householdSize: 2,
    skillLevel: "beginner",
    dietaryRestrictions: [],
    ingredientDislikes: [],
    cuisinePreferences: [],
    nutritionGoal: "no_preference",
    autoLeftovers: false,
    defaultMaxWeeknightMinutes: 45,
    implicitPreferences: new Map(),
    evidenceWeeks: 5,
    recentCookedRecipes: new Map(),
    cookCountByRecipe: new Map(),
    ...overrides,
  };
}

const EMPTY_PAIRINGS: PairingLookup = {
  byRole: new Map(),
  candidatesById: new Map(),
};

Deno.test("assembleWeek: busy-day cook_slot picks an easy + fast recipe over a slow one", () => {
  // Busy days are now plain cook_slots with a stronger easy+fast scoring bias
  // (no_cook_fallback_slot no longer exists). Given two candidates — a quick
  // easy recipe and a slow harder one — the easy+fast should win.
  const slot = mkSlot({
    slotId: "1-dinner",
    slotKind: "cook_slot",
    isBusyDay: true,
  });

  const quick = mkCandidate("quick-easy", {
    totalTimeMinutes: 20,
    difficulty: "easy",
    cookingLevel: "beginner",
  });
  const slow = mkCandidate("slow-hard", {
    totalTimeMinutes: 75,
    difficulty: "hard",
    cookingLevel: "experienced",
  });

  const candidates: CandidateMap = new Map([[slot.slotId, [quick, slow]]]);

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates,
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(slot.slotId);
  const primary = assignment?.components.find((c) => c.isPrimary);
  assertEquals(primary?.sourceKind, "recipe");
  assertEquals(primary?.recipeId, "quick-easy");
});

Deno.test("assembleWeek: cook_slot with a strong candidate assigns that recipe", () => {
  const slot = mkSlot({ slotId: "1-dinner", slotKind: "cook_slot" });
  const candidate = mkCandidate("winner", {
    totalTimeMinutes: 30,
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, [candidate]]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(slot.slotId);
  const primary = assignment?.components.find((c) => c.isPrimary);
  assertEquals(primary?.sourceKind, "recipe");
  assertEquals(primary?.recipeId, "winner");
});

Deno.test("assembleWeek: leftovers_source reason only appears for true dependency source slots", () => {
  const slot = mkSlot({
    slotId: "2-dinner",
    dayIndex: 2,
    feedsFutureLeftoverTarget: false,
  });
  const candidate = mkCandidate("leftover-friendly", {
    leftoversFriendly: true,
    portions: 6,
    totalTimeMinutes: 55,
  });

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, [candidate]]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(slot.slotId);
  assertNotEquals(
    assignment?.selectionReason,
    renderSelectionReason("leftovers_source", "en"),
  );
});

Deno.test("assembleWeek: leftover_target without runtime source downgrades to cook_slot", () => {
  // Source slot picks a recipe that is NOT leftoversFriendly, so the target
  // never sees a registered source. The target was classified as
  // leftover_target_slot (it has sourceDependencySlotId), but at runtime it
  // falls through to recipe ranking. The resulting assignment should carry
  // `effectiveSlotKind: "cook_slot"` so persistence + API response reflect
  // what's actually in the slot.
  const source: MealSlot = mkSlot({
    slotId: "0-dinner",
    dayIndex: 0,
    slotKind: "cook_slot",
    feedsFutureLeftoverTarget: true,
  });
  const target: MealSlot = mkSlot({
    slotId: "1-dinner",
    dayIndex: 1,
    slotKind: "leftover_target_slot",
    sourceDependencySlotId: source.slotId,
    isBusyDay: true,
    prefersLeftovers: true,
    feedsFutureLeftoverTarget: false,
  });

  const sourceRecipe = mkCandidate("source-recipe", {
    leftoversFriendly: false, // critical: won't register as a leftover source
    portions: 2,
    totalTimeMinutes: 30,
  });
  const targetRecipe = mkCandidate("target-recipe", {
    difficulty: "easy",
    cookingLevel: "beginner",
    totalTimeMinutes: 20,
  });
  const slowRecipe = mkCandidate("slow-hard", {
    difficulty: "hard",
    cookingLevel: "experienced",
    totalTimeMinutes: 75,
  });

  const result = assembleWeek({
    slots: [source, target],
    planningOrder: [source, target],
    candidates: new Map([
      [source.slotId, [sourceRecipe]],
      [target.slotId, [slowRecipe, targetRecipe]],
    ]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser({ householdSize: 2 }),
    leftoverTransformByRecipe: new Map(),
  });

  const targetAssignment = result.best.assignments.get(target.slotId);
  if (!targetAssignment) {
    throw new Error("expected target slot to be assigned");
  }
  assertEquals(targetAssignment.effectiveSlotKind, "cook_slot");
  const primary = targetAssignment.components.find((c) => c.isPrimary);
  assertEquals(primary?.sourceKind, "recipe");
  assertEquals(primary?.recipeId, "target-recipe");
  assertEquals(
    targetAssignment.selectionReason,
    renderSelectionReason("busy_day_easy_pick", "en", { dayLabel: "Tuesday" }),
  );
});

Deno.test("assembleWeek: unfilled cook slot emits UNFILLED_COOK_SLOT warning", () => {
  const slot = mkSlot({ slotId: "1-dinner", slotKind: "cook_slot" });
  // Empty candidate pool — nothing to assign.
  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, []]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const hasWarning = result.best.warnings.some((w) =>
    w.startsWith("UNFILLED_COOK_SLOT")
  );
  if (!hasWarning) {
    throw new Error(
      "expected UNFILLED_COOK_SLOT warning when the candidate pool was empty",
    );
  }
});

Deno.test("assembleWeek: unfilled non-busy cook slot applies the non-busy penalty", () => {
  const slot = mkSlot({
    slotId: "1-dinner",
    slotKind: "cook_slot",
    isBusyDay: false,
  });
  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, []]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  // -10 penalty applied twice (assemblyPenalty + objectiveScore).
  assertEquals(result.best.assemblyPenalty, -10);
  assertEquals(result.best.objectiveScore, -10);
});

Deno.test("assembleWeek: unfilled busy-day cook slot does NOT apply the non-busy penalty", () => {
  const slot = mkSlot({
    slotId: "1-dinner",
    slotKind: "cook_slot",
    isBusyDay: true,
  });
  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, []]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  // The user opted out of cooking that day; no penalty.
  assertEquals(result.best.assemblyPenalty, 0);
  assertEquals(result.best.objectiveScore, 0);
  // Warning should still fire so the client can render the empty slot.
  const hasWarning = result.best.warnings.some((w) =>
    w.startsWith("UNFILLED_COOK_SLOT")
  );
  if (!hasWarning) {
    throw new Error(
      "expected UNFILLED_COOK_SLOT warning even when isBusyDay=true",
    );
  }
});
