import {
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clamp01, clamp11, pos01 } from "../scoring-config.ts";
import { scoreCandidate } from "./index.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { RecipeCandidate } from "../candidate-retrieval.ts";
import type { MealSlot } from "../slot-classifier.ts";

function baseCandidate(
  overrides: Partial<RecipeCandidate> = {},
): RecipeCandidate {
  return {
    id: "r1",
    title: "Test Recipe",
    plannerRole: "main",
    foodGroups: ["protein", "carb"],
    isComplete: true,
    totalTimeMinutes: 30,
    difficulty: "easy",
    portions: 4,
    imageUrl: null,
    leftoversFriendly: false,
    batchFriendly: null,
    maxHouseholdSizeSupported: null,
    equipmentTags: [],
    cookingLevel: "beginner",
    verifiedAt: null,
    isPublished: true,
    ingredientIds: ["ing-1", "ing-2"],
    ingredientKeys: ["chicken", "rice"],
    cuisineTags: [],
    hasAllergenConflict: false,
    allergenMatches: [],
    hasDislikeConflict: false,
    dislikeMatches: [],
    alternatePlannerRoles: [],
    ...overrides,
  };
}

function baseSlot(overrides: Partial<MealSlot> = {}): MealSlot {
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

function baseInput(
  overrides: Partial<ScoreCandidateInput> = {},
): ScoreCandidateInput {
  return {
    slot: baseSlot(),
    candidate: baseCandidate(),
    state: {
      assignedRecipeIds: new Set(),
      assignedProteinByDayIndex: new Map(),
      assignedCuisineCounts: new Map(),
      ingredientIdUsage: new Map(),
      noveltyCount: 0,
      mode: "normal",
      slotIndex: 0,
    },
    user: {
      userId: "u1",
      locale: "en",
      localeChain: ["en"],
      householdSize: 2,
      skillLevel: "beginner",
      dietaryRestrictions: [],
      ingredientDislikes: [],
      cuisinePreferences: [],
      nutritionGoal: "no_preference",
      preferLeftoversForLunch: false,
      defaultMaxWeeknightMinutes: 45,
      implicitPreferences: new Map(),
      evidenceWeeks: 5,
      recentCookedRecipes: new Map(),
      cookCountByRecipe: new Map(),
    },
    ...overrides,
  };
}

Deno.test("clamp01 keeps value in 0..1", () => {
  assertEquals(clamp01(-0.5), 0);
  assertEquals(clamp01(1.5), 1);
  assertAlmostEquals(clamp01(0.3), 0.3);
});

Deno.test("clamp11 keeps value in -1..1", () => {
  assertEquals(clamp11(-2), -1);
  assertEquals(clamp11(2), 1);
  assertAlmostEquals(clamp11(0.5), 0.5);
});

Deno.test("pos01 converts -1..+1 to 0..1", () => {
  assertAlmostEquals(pos01(-1), 0);
  assertAlmostEquals(pos01(0), 0.5);
  assertAlmostEquals(pos01(1), 1);
});

Deno.test("scoreCandidate: totals to the expected 100-point weight distribution", () => {
  const input = baseInput();
  const detail = scoreCandidate(input);
  // Sanity: with normal mode and a neutral user, total should land in 0..100.
  if (detail.total < 0 || detail.total > 100) {
    throw new Error(`score ${detail.total} outside 0..100`);
  }
});

Deno.test("scoreCandidate: verified recipe receives verified boost", () => {
  const unverified = scoreCandidate(baseInput()).factors.verified.weighted;
  const verified = scoreCandidate(
    baseInput({
      candidate: baseCandidate({ verifiedAt: "2026-01-01T00:00:00Z" }),
    }),
  ).factors.verified.weighted;
  if (verified <= unverified) {
    throw new Error("verified recipe should outscore unverified");
  }
});

Deno.test("scoreCandidate: adjacent protein raises variety penalty", () => {
  const base = scoreCandidate(baseInput()).factors.variety.weighted;
  const adjacentState = {
    ...baseInput().state,
    assignedProteinByDayIndex: new Map([[1, "chicken"]]),
  };
  const penalized = scoreCandidate({
    ...baseInput(),
    state: adjacentState,
  }).factors.variety.weighted;
  if (penalized >= base) {
    throw new Error("adjacent chicken should penalize variety");
  }
});

Deno.test("scoreCandidate: time fit penalizes long recipes on weeknight slots", () => {
  const quick = scoreCandidate(
    baseInput({ candidate: baseCandidate({ totalTimeMinutes: 20 }) }),
  ).factors.timeFit.raw;
  const long = scoreCandidate(
    baseInput({ candidate: baseCandidate({ totalTimeMinutes: 120 }) }),
  ).factors.timeFit.raw;
  if (long >= quick) {
    throw new Error("longer recipe must have lower time-fit");
  }
});

Deno.test("scoreCandidate: hard rule flags already-assigned recipe", () => {
  const input = baseInput();
  input.state.assignedRecipeIds.add(input.candidate.id);
  const detail = scoreCandidate(input);
  if (!detail.hardRuleViolations.includes("already_assigned_this_week")) {
    throw new Error("expected already_assigned_this_week violation");
  }
});

Deno.test("scoreCandidate: allergen conflict is a hard rule violation", () => {
  const input = baseInput({
    candidate: baseCandidate({ hasAllergenConflict: true }),
  });
  const detail = scoreCandidate(input);
  if (!detail.hardRuleViolations.includes("allergen_conflict")) {
    throw new Error("expected allergen_conflict hard rule violation");
  }
});

Deno.test("scoreCandidate: dislike conflict is a hard rule violation", () => {
  const input = baseInput({
    candidate: baseCandidate({
      hasDislikeConflict: true,
      dislikeMatches: ["mushrooms"],
    }),
  });
  const detail = scoreCandidate(input);
  if (!detail.hardRuleViolations.includes("ingredient_dislike_conflict")) {
    throw new Error("expected ingredient_dislike_conflict hard rule violation");
  }
});

Deno.test("scoreCandidate: busy-day cook_slot prefers an easy+fast recipe over a slow+hard one", () => {
  // The no_cook_fallback_slot concept is gone. Busy days are plain cook_slots
  // with a stronger difficulty + time weighting (SLOT_FIT_SUBWEIGHTS.busyCookSlot).
  // Same taste, same state — a quick easy recipe must outscore a slow hard one
  // on slot-fit alone.
  const slot = baseSlot({ slotKind: "cook_slot", isBusyDay: true });
  const easyFast = scoreCandidate(
    baseInput({
      slot,
      candidate: baseCandidate({
        difficulty: "easy",
        cookingLevel: "beginner",
        totalTimeMinutes: 20,
      }),
    }),
  );
  const slowHard = scoreCandidate(
    baseInput({
      slot,
      candidate: baseCandidate({
        difficulty: "hard",
        cookingLevel: "experienced",
        totalTimeMinutes: 75,
      }),
    }),
  );
  if (easyFast.factors.slotFit.raw <= slowHard.factors.slotFit.raw) {
    throw new Error(
      `expected easy+fast (${easyFast.factors.slotFit.raw}) > slow+hard (${slowHard.factors.slotFit.raw}) for busy-day cook_slot`,
    );
  }
});

Deno.test("scoreCandidate: leftover-source slot-fit bonus only applies when the slot actually feeds a future target", () => {
  const candidate = baseCandidate({
    leftoversFriendly: true,
    portions: 6,
    totalTimeMinutes: 40,
  });

  const sourceScore = scoreCandidate(
    baseInput({
      slot: baseSlot({ feedsFutureLeftoverTarget: true }),
      candidate,
    }),
  ).factors.slotFit.raw;
  const regularScore = scoreCandidate(
    baseInput({
      slot: baseSlot({ feedsFutureLeftoverTarget: false }),
      candidate,
    }),
  ).factors.slotFit.raw;

  if (sourceScore <= regularScore) {
    throw new Error(
      `expected leftover source slot-fit (${sourceScore}) to exceed regular cook slot (${regularScore})`,
    );
  }
});

Deno.test("scoreCandidate: alternate-role match takes the primary-role preference penalty", () => {
  // Snack slot. A side-role recipe with alternates=['snack'] is matched
  // only via its alternates list, so the primary-role-preference penalty
  // (5 pts per SCORE_MODIFIERS) applies. A snack-role recipe doesn't take
  // the penalty.
  const snackSlot = baseSlot({ canonicalMealType: "snack" });
  const primaryMatch = scoreCandidate(
    baseInput({
      slot: snackSlot,
      candidate: baseCandidate({
        plannerRole: "snack",
        alternatePlannerRoles: [],
      }),
    }),
  );
  const alternateMatch = scoreCandidate(
    baseInput({
      slot: snackSlot,
      candidate: baseCandidate({
        plannerRole: "side",
        alternatePlannerRoles: ["snack"],
      }),
    }),
  );

  // The 5-point penalty should drop the alternate-match total relative to
  // an otherwise identical primary match.
  if (alternateMatch.total >= primaryMatch.total) {
    throw new Error(
      `expected alternate-role total (${alternateMatch.total}) < primary-role total (${primaryMatch.total})`,
    );
  }
  if (!alternateMatch.softPenalties.includes("alternate_role_match")) {
    throw new Error("expected alternate_role_match in softPenalties");
  }
  if (primaryMatch.softPenalties.includes("alternate_role_match")) {
    throw new Error(
      "primary match should NOT carry the alternate_role_match penalty",
    );
  }
});

Deno.test("scoreCandidate: first-week trust mode boosts verified weight", () => {
  const normalInput = baseInput({
    candidate: baseCandidate({ verifiedAt: "2026-01-01T00:00:00Z" }),
  });
  const normalVerified = scoreCandidate(normalInput).factors.verified.weighted;

  const trustInput = baseInput({
    candidate: baseCandidate({ verifiedAt: "2026-01-01T00:00:00Z" }),
    state: { ...baseInput().state, mode: "first_week_trust" },
  });
  const trustVerified = scoreCandidate(trustInput).factors.verified.weighted;

  if (trustVerified <= normalVerified) {
    throw new Error("first-week trust should assign more weight to verified");
  }
});
