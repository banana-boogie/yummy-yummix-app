/**
 * SCORING_CONFIG_V1 — Single source of truth for meal planner ranking.
 *
 * Canonical spec:
 *   product-kitchen/repeat-what-works/design/ranking-algorithm-detail.md
 *
 * All weights, thresholds, assembly bonuses/penalties, and mode switches live
 * here. Scoring modules import from this file — nothing should hardcode a
 * weight or constant elsewhere.
 */

import type { CanonicalMealType, SlotType } from "./types.ts";

// ============================================================
// Weight profiles
// ============================================================

export interface ScoringWeights {
  tasteHousehold: number;
  slotFit: number;
  timeFit: number;
  ingredientOverlap: number;
  variety: number;
  nutrition: number;
  verified: number;
}

const NORMAL_WEIGHTS: ScoringWeights = {
  tasteHousehold: 25,
  slotFit: 20,
  timeFit: 15,
  ingredientOverlap: 15,
  variety: 10,
  nutrition: 10,
  verified: 5,
};

// First-week trust mode boosts time fit + verified, reduces nutrition + overlap.
// Applied when user has no prior plan history (evidence_weeks === 0).
const FIRST_WEEK_TRUST_WEIGHTS: ScoringWeights = {
  tasteHousehold: 25,
  slotFit: 20,
  timeFit: 20,
  ingredientOverlap: 10,
  variety: 10,
  nutrition: 5,
  verified: 10,
};

export const WEIGHT_TOTAL = 100;

// ============================================================
// Taste / household sub-weights (inside 25-point factor)
// ============================================================

// Sub-weights inside the 25-point Taste/Household factor. Positive weights
// (recipeAffinity through familyFavorite) sum to 1.0; recentRepeatPenalty is
// subtracted, capping the worst-case raw value at -0.20 (clamped to 0 by the
// outer clamp01).
export const TASTE_SUBWEIGHTS = {
  recipeAffinity: 0.40,
  cuisineAffinity: 0.20,
  proteinAffinity: 0.15,
  mealTypeAffinity: 0.10,
  familyFavorite: 0.15,
  recentRepeatPenalty: 0.20,
  recipeHistoryRating: 0.50,
  recipeHistoryCompletion: 0.30,
  recipeHistoryRepeat: 0.20,
} as const;

// ============================================================
// Slot-fit sub-weights per slot kind (inside 20-point factor)
// ============================================================

export const SLOT_FIT_SUBWEIGHTS = {
  cook: {
    difficulty: 0.50,
    timeCompat: 0.30,
    householdComplexity: 0.20,
  },
  /**
   * Busy-day cook_slot variant: a weekday cook slot where the user has
   * flagged the day as busy AND no leftover source existed to downgrade
   * this into a leftover_target_slot. Same formula as `cook` but with a
   * stronger pull toward easy + fast recipes so busy days don't get a
   * 90-minute project dinner.
   */
  busyCookSlot: {
    difficulty: 0.55,
    timeCompat: 0.40,
    householdComplexity: 0.05,
  },
  weekend: {
    difficulty: 0.50,
    timeCompat: 0.30,
    householdComplexity: 0.20,
  },
  leftoverSource: {
    difficulty: 0.45,
    timeCompat: 0.20,
    leftoversEligible: 0.15,
    leftoverYield: 0.20,
  },
} as const;

// ============================================================
// Variety sub-weights (inside 10-point factor)
// ============================================================

export const VARIETY_SUBWEIGHTS = {
  adjacentProtein: 0.40,
  weeklyCuisine: 0.25,
  recentRecipe: 0.20,
  noveltyBalance: 0.15,
} as const;

// ============================================================
// Ingredient-overlap sub-weights (inside 15-point factor)
// ============================================================

export const INGREDIENT_OVERLAP_SUBWEIGHTS = {
  weeklyOverlap: 0.55,
  pantryFriendly: 0.45,
} as const;

// ============================================================
// Nutrition sub-weights for eat_healthier goal
// ============================================================

export const NUTRITION_HEALTHIER_SUBWEIGHTS = {
  fiberHealth: 0.35,
  proteinDensity: 0.30,
  lowSugar: 0.20,
  lowSodium: 0.15,
} as const;

// ============================================================
// Time-fit budgets (minutes)
// ============================================================

export const TIME_BUDGETS = {
  weeknightDefault: 45,
  weekend: 120,
  // Busy-day cook_slot: tighter budget so the time-fit factor punishes long
  // cooks more aggressively on days the user flagged as busy.
  busyDay: 30,
} as const;

// ============================================================
// Candidate retrieval limits
// ============================================================

export const RETRIEVAL_LIMITS = {
  cookSlotTopN: 30,
  cookSlotBeamPerState: 12,
} as const;

// ============================================================
// Beam-search settings
// ============================================================

export const BEAM = {
  width: 5,
} as const;

// ============================================================
// Thin-catalog thresholds
// ============================================================

export const THIN_CATALOG = {
  totalPublishedThreshold: 30,
  viableCandidatesPerSlotThreshold: 8,
} as const;

// ============================================================
// Assembly bonuses / penalties (applied at week state level)
// ============================================================

export const ASSEMBLY_ADJUSTMENTS = {
  busyDayCoveredByLeftovers: 8,
  strongLeftoverTransform: 5,
  adjacentSameProteinRepeat: -6,
  cuisineRepeatedTooOften: -4,
  extraNoveltyFirstWeek: -6,
  unfilledNonBusySlot: -10,
} as const;

/**
 * Score modifiers applied per-candidate after the 7-factor sum.
 *
 * `primaryRolePreferencePenalty` (recipe-role-model.md §6.3): recipes that
 * fit a slot only via their `alternate_planner_roles` (not their primary
 * `planner_role`) take a small penalty so a recipe is preferred in its
 * default role. Small enough that a great alternate match still beats a
 * mediocre primary match.
 */
export const SCORE_MODIFIERS = {
  primaryRolePreferencePenalty: 5,
} as const;

// ============================================================
// Leftover resolution scoring
// ============================================================

export const LEFTOVER_RESOLUTION_SUBWEIGHTS = {
  planQuality: 0.45,
  yieldConfidence: 0.35,
  busyDayCoverage: 0.20,
} as const;

// Plan-quality values plugged into leftoverPlanQuality.
export const LEFTOVER_PLAN_QUALITY = {
  explicitTransform: 1.0,
  genericCarryForward: 0.75,
  untrustworthy: 0.0,
} as const;

// ============================================================
// Open / orphan slot contribution defaults
// ============================================================

export const OPEN_SLOT_CONTRIBUTION = {
  unfilledCookSlot: 0,
} as const;

// ============================================================
// Variety thresholds
// ============================================================

export const VARIETY_LIMITS = {
  firstWeekNoveltyCap: 1,
  weeklyCuisineRepeatThreshold: 3, // more than this triggers full penalty
  adjacentProteinWindow: 1, // same protein on adjacent days triggers penalty
  recentRecipeWindowDays: 30,
} as const;

// ============================================================
// Assembly thresholds (week-level penalty gates)
// ============================================================

export const ASSEMBLY_THRESHOLDS = {
  // Already this many of the same cuisine assigned in the week (before this
  // slot) triggers ASSEMBLY_ADJUSTMENTS.cuisineRepeatedTooOften (-4).
  // Distinct from VARIETY_LIMITS.weeklyCuisineRepeatThreshold, which gates
  // the per-candidate variety scorer (a soft 0..1 penalty); this gate is the
  // harder week-state penalty applied once the bundle is committed.
  cuisineRepeatedTooOftenCount: 2,
} as const;

// ============================================================
// Household thresholds
// ============================================================

export const HOUSEHOLD = {
  largeThreshold: 3,
  defaultSize: 2,
} as const;

// ============================================================
// Rating / history thresholds
// ============================================================

export const HISTORY = {
  cookCountForFamilyFavorite: 3,
  hardRejectionRating: 2, // rating <= this excludes the exact recipe
} as const;

// ============================================================
// Condiment rules (bundle-level)
// ============================================================

export const CONDIMENT_RULES = {
  maxPerSlot: 1,
  totalComponentsPerSlot: 3,
  explicitPairingOnly: true,
  attachAfterCoverage: true, // only after main/side/veg are placed
} as const;

// ============================================================
// Slot structure defaults
// ============================================================

export const STRUCTURE_DEFAULTS: Record<
  CanonicalMealType,
  "single_component" | "main_plus_one_component" | "main_plus_two_components"
> = {
  breakfast: "single_component",
  lunch: "main_plus_one_component",
  dinner: "main_plus_one_component",
  snack: "single_component",
  dessert: "single_component",
  beverage: "single_component",
};

// ============================================================
// Planner-role fit per meal type
// Recipes are retrieved by planner_role; this map expresses which roles
// can serve as the PRIMARY component for a given canonical meal type.
// ============================================================

export const MEAL_TYPE_PRIMARY_ROLES: Record<
  CanonicalMealType,
  ReadonlyArray<string>
> = {
  breakfast: ["main", "snack"],
  lunch: ["main"],
  dinner: ["main"],
  snack: ["snack"],
  dessert: ["dessert"],
  beverage: ["beverage"],
};

// ============================================================
// Weekend detection
// ============================================================

export const WEEKEND_DAY_INDEXES = new Set<number>([5, 6]); // Sat, Sun

// ============================================================
// Nutrition defaults
// ============================================================

export const NUTRITION_DEFAULT_NORM_WHEN_NO_GOAL = 1.0;
export const NUTRITION_DEFAULT_NORM_WHEN_MISSING_DATA = 0.5;

// ============================================================
// Debug trace
// ============================================================

export const DEBUG_TRACE = {
  includePerCandidateFactors: true,
  topKCandidatesPerSlot: 5,
} as const;

// ============================================================
// Weight selection
// ============================================================

export type ScoringMode = "normal" | "first_week_trust";

export function pickWeights(mode: ScoringMode): ScoringWeights {
  return mode === "first_week_trust"
    ? FIRST_WEEK_TRUST_WEIGHTS
    : NORMAL_WEIGHTS;
}

// ============================================================
// Final consolidated config object
// ============================================================

export const SCORING_CONFIG_V1 = {
  version: "v1" as const,
  weights: {
    normal: NORMAL_WEIGHTS,
    firstWeekTrust: FIRST_WEEK_TRUST_WEIGHTS,
  },
  taste: TASTE_SUBWEIGHTS,
  slotFit: SLOT_FIT_SUBWEIGHTS,
  variety: VARIETY_SUBWEIGHTS,
  ingredientOverlap: INGREDIENT_OVERLAP_SUBWEIGHTS,
  nutritionHealthier: NUTRITION_HEALTHIER_SUBWEIGHTS,
  timeBudgets: TIME_BUDGETS,
  retrieval: RETRIEVAL_LIMITS,
  beam: BEAM,
  thinCatalog: THIN_CATALOG,
  assembly: ASSEMBLY_ADJUSTMENTS,
  scoreModifiers: SCORE_MODIFIERS,
  leftoverResolution: LEFTOVER_RESOLUTION_SUBWEIGHTS,
  leftoverPlanQuality: LEFTOVER_PLAN_QUALITY,
  openSlotContribution: OPEN_SLOT_CONTRIBUTION,
  varietyLimits: VARIETY_LIMITS,
  assemblyThresholds: ASSEMBLY_THRESHOLDS,
  household: HOUSEHOLD,
  history: HISTORY,
  condimentRules: CONDIMENT_RULES,
  structureDefaults: STRUCTURE_DEFAULTS,
  mealTypePrimaryRoles: MEAL_TYPE_PRIMARY_ROLES,
  weekendDayIndexes: [...WEEKEND_DAY_INDEXES],
  nutritionDefaultNoGoal: NUTRITION_DEFAULT_NORM_WHEN_NO_GOAL,
  nutritionDefaultMissing: NUTRITION_DEFAULT_NORM_WHEN_MISSING_DATA,
  debug: DEBUG_TRACE,
} as const;

// ============================================================
// Helpers — clamping
// ============================================================

export const clamp01 = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

export const clamp11 = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
};

export const pos01 = (n: number): number => clamp01((clamp11(n) + 1) / 2);

// ============================================================
// Shared types
// ============================================================

export type NutritionGoal =
  | "no_preference"
  | "eat_healthier"
  | "lose_weight"
  | "more_protein"
  | "less_sugar";

export function resolveTimeBudget(
  slotKind: SlotType,
  isBusyDay: boolean,
  userMaxWeeknightMinutes: number | null | undefined,
): number {
  if (slotKind === "weekend_flexible_slot") {
    return TIME_BUDGETS.weekend;
  }
  // Busy-day cook slots get a tighter budget so the time-fit factor
  // aggressively penalizes long cooks. Leftover targets skip this branch —
  // their slot-fit uses the leftoverSource sub-weights instead of time-fit.
  if (isBusyDay && slotKind === "cook_slot") {
    return TIME_BUDGETS.busyDay;
  }
  return userMaxWeeknightMinutes && userMaxWeeknightMinutes > 0
    ? userMaxWeeknightMinutes
    : TIME_BUDGETS.weeknightDefault;
}
