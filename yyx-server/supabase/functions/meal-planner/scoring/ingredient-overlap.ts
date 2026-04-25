/**
 * Factor: Ingredient Overlap / Pantry Fit (0..15)
 *
 * Rewards candidates that share ingredients with already-assigned recipes
 * (shopping efficiency, waste reduction) and lean on common pantry staples.
 *
 * No pantry table is wired in yet — pantryFriendlyScore leans on a hardcoded
 * list of staples and on the implicit preference rows for ingredients the
 * user already uses frequently.
 *
 * Spec: ranking-algorithm-detail.md §4.7
 */

import { clamp01, INGREDIENT_OVERLAP_SUBWEIGHTS } from "../scoring-config.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

// Canonical (English) staple keys. `buildCanonicalIngredientMap` already
// normalizes Spanish ingredients to their English canonical form before this
// runs, so we don't need duplicate Spanish entries (cebolla → onion, etc.).
const STAPLE_KEYS = new Set<string>([
  "salt",
  "pepper",
  "olive_oil",
  "oil",
  "garlic",
  "onion",
  "rice",
  "flour",
  "sugar",
  "butter",
  "tomato",
  "tortilla",
  "beans",
  "eggs",
  "milk",
]);

/**
 * Match a candidate ingredient key against the staples set using underscore-
 * delimited word boundaries — `green_onion` matches `onion`, but
 * `sugar_snap_peas` does NOT match `sugar` (the latter would be a false
 * positive that the previous substring match produced).
 */
function isStaple(key: string): boolean {
  if (STAPLE_KEYS.has(key)) return true;
  const tokens = key.split("_");
  for (const token of tokens) {
    if (STAPLE_KEYS.has(token)) return true;
  }
  return false;
}

function weeklyOverlapScore(input: ScoreCandidateInput): number {
  if (input.candidate.ingredientIds.length === 0) return 0;
  let reuseCount = 0;
  for (const id of input.candidate.ingredientIds) {
    if ((input.state.ingredientIdUsage.get(id) ?? 0) > 0) reuseCount++;
  }
  return clamp01(reuseCount / input.candidate.ingredientIds.length);
}

function pantryFriendlyScore(input: ScoreCandidateInput): number {
  if (input.candidate.ingredientKeys.length === 0) return 0;
  let staples = 0;
  let liked = 0;
  for (const key of input.candidate.ingredientKeys) {
    if (isStaple(key)) {
      staples++;
      continue;
    }
    const row = input.user.implicitPreferences.get(`ingredient:${key}`);
    if (row && row.score > 0) liked++;
  }
  const staplesShare = staples / input.candidate.ingredientKeys.length;
  const likedShare = liked / input.candidate.ingredientKeys.length;
  return clamp01(0.7 * staplesShare + 0.3 * likedShare);
}

export function scoreIngredientOverlap(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const weekly = weeklyOverlapScore(input);
  const pantry = pantryFriendlyScore(input);
  const norm = clamp01(
    INGREDIENT_OVERLAP_SUBWEIGHTS.weeklyOverlap * weekly +
      INGREDIENT_OVERLAP_SUBWEIGHTS.pantryFriendly * pantry,
  );
  return { raw: norm, weighted: norm * weight };
}
