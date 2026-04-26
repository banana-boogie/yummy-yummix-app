/**
 * Factor: Ingredient Overlap (0..15)
 *
 * Rewards candidates that share ingredients with already-assigned recipes
 * for the week — shopping efficiency and waste reduction. A top reason
 * users abandon meal planners is grocery waste guilt; reusing ingredients
 * across the week directly addresses it.
 *
 * Pantry-awareness was previously a sub-term but assumed a global staples
 * list (every kitchen has the same things), which is wrong — see the
 * comment on INGREDIENT_OVERLAP_SUBWEIGHTS in scoring-config.ts. The
 * factor will get a per-user pantry sub-term when shopping-list / pantry
 * data lands.
 *
 * Spec: ranking-algorithm-detail.md §4.7
 */

import { clamp01, INGREDIENT_OVERLAP_SUBWEIGHTS } from "../scoring-config.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

function weeklyOverlapScore(input: ScoreCandidateInput): number {
  if (input.candidate.ingredientIds.length === 0) return 0;
  let reuseCount = 0;
  for (const id of input.candidate.ingredientIds) {
    if ((input.state.ingredientIdUsage.get(id) ?? 0) > 0) reuseCount++;
  }
  return clamp01(reuseCount / input.candidate.ingredientIds.length);
}

export function scoreIngredientOverlap(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const weekly = weeklyOverlapScore(input);
  const norm = clamp01(INGREDIENT_OVERLAP_SUBWEIGHTS.weeklyOverlap * weekly);
  return { raw: norm, weighted: norm * weight };
}
