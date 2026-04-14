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
