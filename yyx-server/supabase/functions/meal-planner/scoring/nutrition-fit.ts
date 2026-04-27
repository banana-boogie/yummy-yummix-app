/**
 * Factor: Nutrition Fit (0..10)
 *
 * Per §4.4: if nutrition_goal = no_preference, every candidate gets full marks
 * (10). Otherwise we compute a goal-specific normalization.
 *
 * Current schema has no planner_recipe_features materialized view and no
 * per-100g nutrition on recipes. We use a neutral 1.0 when no goal is set,
 * and a defensive 0.5 neutral otherwise so the factor never dominates.
 *
 * Spec: ranking-algorithm-detail.md §4.4
 */

import {
  NUTRITION_DEFAULT_NORM_WHEN_MISSING_DATA,
  NUTRITION_DEFAULT_NORM_WHEN_NO_GOAL,
} from "../scoring-config.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

export function scoreNutritionFit(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  if (input.user.nutritionGoal === "no_preference") {
    const raw = NUTRITION_DEFAULT_NORM_WHEN_NO_GOAL;
    return { raw, weighted: raw * weight };
  }
  // TODO(Track G / nutrition infrastructure): replace with real percentiles
  // once planner_recipe_features is in place. Until then, stay neutral so
  // nutrition never outweighs trust signals.
  const raw = NUTRITION_DEFAULT_NORM_WHEN_MISSING_DATA;
  return { raw, weighted: raw * weight };
}
