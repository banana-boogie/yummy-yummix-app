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

Deno.test("assembleWeek: leftover_target fallback to fresh recipe with surplus can feed a downstream leftover slot", () => {
  // The fallback-source chain: with autoLeftovers chaining lunch→dinner→
  // lunch, an upstream slot that gets classified as leftover_target may end
  // up running fresh at runtime (because its own source produced no
  // leftovers). When that fresh fallback recipe yields surplus, downstream
  // slots must be able to consume it. Without this, a 4-portion fallback
  // recipe gets cooked but its leftovers are invisible to later slots →
  // overcooking.
  //
  // Topology:
  //   day-0 lunch (cook_slot, source for day-0 dinner — recipe has NO surplus)
  //   day-0 dinner (leftover_target_slot sourced from day-0 lunch, AND
  //                 source for day-1 lunch — at runtime falls back to a
  //                 fresh recipe with surplus)
  //   day-1 lunch (leftover_target_slot sourced from day-0 dinner — should
  //                consume day-0 dinner's fallback surplus, NOT cook fresh)
  const day0Lunch: MealSlot = mkSlot({
    slotId: "0-lunch",
    plannedDate: "2026-04-13",
    dayIndex: 0,
    canonicalMealType: "lunch",
    displayMealLabel: "lunch",
    slotKind: "cook_slot",
    feedsFutureLeftoverTarget: true,
  });
  const day0Dinner: MealSlot = mkSlot({
    slotId: "0-dinner",
    plannedDate: "2026-04-13",
    dayIndex: 0,
    canonicalMealType: "dinner",
    displayMealLabel: "dinner",
    slotKind: "leftover_target_slot",
    sourceDependencySlotId: day0Lunch.slotId,
    feedsFutureLeftoverTarget: true, // also a source for day-1 lunch
  });
  const day1Lunch: MealSlot = mkSlot({
    slotId: "1-lunch",
    plannedDate: "2026-04-14",
    dayIndex: 1,
    canonicalMealType: "lunch",
    displayMealLabel: "lunch",
    slotKind: "leftover_target_slot",
    sourceDependencySlotId: day0Dinner.slotId,
    feedsFutureLeftoverTarget: false,
  });

  // Day-0 lunch picks a tiny recipe → no surplus → no leftover registered.
  const tinyRecipe = mkCandidate("tiny", {
    leftoversFriendly: false,
    portions: 2,
    totalTimeMinutes: 25,
  });
  // Day-0 dinner falls back to this fresh recipe (its leftover source had
  // nothing). It IS leftovers-friendly with surplus → registers as a source
  // for downstream.
  const surplusFallback = mkCandidate("surplus-fallback", {
    leftoversFriendly: true,
    portions: 6,
    totalTimeMinutes: 35,
  });

  const result = assembleWeek({
    slots: [day0Lunch, day0Dinner, day1Lunch],
    planningOrder: [day0Lunch, day0Dinner, day1Lunch],
    candidates: new Map([
      [day0Lunch.slotId, [tinyRecipe]],
      [day0Dinner.slotId, [surplusFallback]],
      // Day-1 lunch has its own pool but should prefer the leftover path
      // and never use these candidates.
      [day1Lunch.slotId, []],
    ]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser({ householdSize: 2 }),
    leftoverTransformByRecipe: new Map(),
  });

  // Day-0 dinner: ran the fallback fresh recipe (effective kind is cook_slot
  // post-fallback, primary is the recipe candidate, not a leftover placeholder).
  const d0d = result.best.assignments.get(day0Dinner.slotId);
  assertEquals(d0d?.effectiveSlotKind, "cook_slot");
  const d0dPrimary = d0d?.components.find((c) => c.isPrimary);
  assertEquals(d0dPrimary?.recipeId, "surplus-fallback");
  assertEquals(d0dPrimary?.sourceKind, "recipe");

  // Day-1 lunch: should have consumed day-0 dinner's surplus, NOT cooked
  // a fresh recipe (its candidate pool is empty, so a fresh-cook outcome
  // would mean an unfilled warning). The primary's sourceKind must be
  // "leftover".
  const d1l = result.best.assignments.get(day1Lunch.slotId);
  if (!d1l) {
    throw new Error(
      "expected day-1 lunch to be assigned (via leftover from day-0 dinner)",
    );
  }
  const d1lPrimary = d1l.components.find((c) => c.isPrimary);
  assertEquals(
    d1lPrimary?.sourceKind,
    "leftover",
    "day-1 lunch must consume day-0 dinner's fallback surplus rather than cook fresh",
  );
  // No unfilled warning for day-1 lunch.
  const unfilled = result.best.warnings.find((w) =>
    w === `UNFILLED_COOK_SLOT:${day1Lunch.slotId}`
  );
  assertEquals(unfilled, undefined);
});

Deno.test("assembleWeek: leftover placeholder inherits source assembly's full meal_components", () => {
  const sourceSlot = mkSlot({
    slotId: "0-dinner",
    dayIndex: 0,
    plannedDate: "2026-04-13",
    canonicalMealType: "dinner",
    displayMealLabel: "dinner",
    feedsFutureLeftoverTarget: true,
    structureTemplate: "main_plus_two_components",
    expectedMealComponents: ["protein", "carb", "veg"],
  });
  const leftoverSlot = mkSlot({
    slotId: "1-dinner",
    dayIndex: 1,
    plannedDate: "2026-04-14",
    slotKind: "leftover_target_slot",
    sourceDependencySlotId: sourceSlot.slotId,
    structureTemplate: "main_plus_two_components",
    expectedMealComponents: ["protein", "carb", "veg"],
  });

  const primary = mkCandidate("source-primary", {
    mealComponents: ["protein"],
    leftoversFriendly: true,
    portions: 6,
  });
  const pairedSide = mkCandidate("source-side", {
    plannerRole: "side",
    mealComponents: ["carb", "veg"],
  });
  const pairings: PairingLookup = {
    byRole: new Map([[
      primary.id,
      new Map([[
        "side",
        [{
          source_recipe_id: primary.id,
          target_recipe_id: pairedSide.id,
          pairing_role: "side",
          reason: "balanced side",
        }],
      ]]),
    ]]),
    candidatesById: new Map([[pairedSide.id, pairedSide]]),
  };

  const result = assembleWeek({
    slots: [sourceSlot, leftoverSlot],
    planningOrder: [sourceSlot, leftoverSlot],
    candidates: new Map([[sourceSlot.slotId, [primary]]]),
    pairings,
    user: mkUser({ householdSize: 2 }),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(leftoverSlot.slotId);
  const placeholder = assignment?.components.find((c) => c.isPrimary);
  assertEquals(placeholder?.sourceKind, "leftover");
  assertEquals(
    [...(placeholder?.mealComponentsSnapshot ?? [])].sort(),
    ["carb", "protein", "veg"],
  );
});

Deno.test("assembleWeek: generic leftover carry-forward does not receive coverage-complete bonus", () => {
  const sourceSlot = mkSlot({
    slotId: "0-dinner",
    dayIndex: 0,
    plannedDate: "2026-04-13",
    canonicalMealType: "dinner",
    displayMealLabel: "dinner",
    feedsFutureLeftoverTarget: true,
    structureTemplate: "main_plus_two_components",
    expectedMealComponents: ["protein", "carb", "veg"],
  });
  const leftoverSlot = mkSlot({
    slotId: "1-dinner",
    dayIndex: 1,
    plannedDate: "2026-04-14",
    slotKind: "leftover_target_slot",
    sourceDependencySlotId: sourceSlot.slotId,
    structureTemplate: "main_plus_two_components",
    expectedMealComponents: ["protein", "carb", "veg"],
  });

  const primary = mkCandidate("source-primary", {
    mealComponents: ["protein", "carb", "veg"],
    isComplete: true,
    leftoversFriendly: true,
    portions: 6,
  });

  const result = assembleWeek({
    slots: [sourceSlot, leftoverSlot],
    planningOrder: [sourceSlot, leftoverSlot],
    candidates: new Map([[sourceSlot.slotId, [primary]]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser({ householdSize: 2 }),
    leftoverTransformByRecipe: new Map(),
  });

  assertEquals(result.best.assemblyBonus, 5);
});

Deno.test("assembleWeek: coverage-complete bonus prefers a complete-meal primary over a partial one", () => {
  // Two candidates for the same lunch slot. The complete one covers all of
  // protein/carb/veg by itself; the partial one covers only protein/carb.
  // Without the coverage bonus the partial may win on raw 7-factor score
  // (depending on tie-breakers); the bonus should consistently push the
  // complete one ahead.
  const slot: MealSlot = mkSlot({
    slotId: "0-lunch",
    canonicalMealType: "lunch",
    displayMealLabel: "lunch",
    structureTemplate: "main_plus_two_components",
    expectedMealComponents: ["protein", "carb", "veg"],
  });

  const completeMain = mkCandidate("complete-main", {
    mealComponents: ["protein", "carb", "veg"],
    isComplete: true,
  });
  const partialMain = mkCandidate("partial-main", {
    mealComponents: ["protein", "carb"],
    isComplete: false,
  });

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, [completeMain, partialMain]]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(slot.slotId);
  const primary = assignment?.components.find((c) => c.isPrimary);
  assertEquals(primary?.recipeId, "complete-main");
  // Bonus surfaces in the assemblyBonus tally.
  assertEquals(result.best.assemblyBonus >= 5, true);
});

Deno.test("assembleWeek: coverage-complete partial tier awards +2 (not +5) when 2 of 3 expected components are covered", () => {
  // Bundle covers protein + carb but not veg → 2 of 3 expected, partial
  // tier (>= half but not all) should fire with +2 — and notably NOT the
  // full +5 bonus.
  const slot: MealSlot = mkSlot({
    slotId: "0-lunch",
    canonicalMealType: "lunch",
    displayMealLabel: "lunch",
    structureTemplate: "main_plus_two_components",
    expectedMealComponents: ["protein", "carb", "veg"],
  });

  const partialMain = mkCandidate("partial-only", {
    mealComponents: ["protein", "carb"],
    isComplete: false,
  });

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, [partialMain]]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  // Partial bonus should be exactly +2 — not the full +5.
  assertEquals(result.best.assemblyBonus, 2);
});

Deno.test("assembleWeek: busy-day cook_slot does NOT receive coverage-complete bonus", () => {
  // Time pressure should beat balance on busy days — even if the assembled
  // bundle happens to cover protein+carb+veg, the bonus must be suppressed
  // so the planner doesn't push complex bundles on busy days.
  const slot: MealSlot = mkSlot({
    slotId: "1-lunch",
    canonicalMealType: "lunch",
    displayMealLabel: "lunch",
    slotKind: "cook_slot",
    isBusyDay: true,
    structureTemplate: "main_plus_two_components",
    expectedMealComponents: ["protein", "carb", "veg"],
  });
  const completeMain = mkCandidate("complete-main", {
    mealComponents: ["protein", "carb", "veg"],
    isComplete: true,
    totalTimeMinutes: 25,
    difficulty: "easy",
    cookingLevel: "beginner",
  });

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: new Map([[slot.slotId, [completeMain]]]),
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  // Bundle covered everything but the bonus must not have applied.
  assertEquals(result.best.assemblyBonus, 0);
});
