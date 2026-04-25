/**
 * Factor: Taste + Household Fit (0..25)
 *
 * Blends explicit recipe history (ratings, completions, repeat cooks),
 * implicit preference rows (cuisine / protein / meal-type affinities),
 * explicit intent for this session, and household-complexity signals.
 *
 * Spec: ranking-algorithm-detail.md §4.1
 */

import {
  clamp01,
  clamp11,
  HISTORY,
  HOUSEHOLD,
  pos01,
  TASTE_SUBWEIGHTS,
} from "../scoring-config.ts";
import type { CandidateScoreDetail, ScoreCandidateInput } from "./types.ts";
import { inferProteinKey } from "./protein-inference.ts";

function implicitAffinity(
  score: number,
  confidence: number,
): number {
  // Preference scores are maintained roughly in −3..+3; normalize to −1..+1.
  const normalized = clamp11(score / 3);
  return normalized * clamp01(confidence);
}

function recipeHistoryAffinity(input: ScoreCandidateInput): number {
  const cookCount = input.user.cookCountByRecipe.get(input.candidate.id) ?? 0;
  if (cookCount === 0) return 0;
  // Proxy: treat "cooked N times" as positive rating signal. Ratings table
  // doesn't exist yet (Plan 10) — use cook count only.
  const ratingSignal = cookCount >= 3 ? 0.8 : cookCount === 1 ? 0.3 : 0.5;
  const completionSignal = cookCount >= 1 ? 1 : 0;
  const repeatSignal = cookCount >= 3 ? 1 : cookCount >= 2 ? 0.5 : 0;
  return clamp11(
    TASTE_SUBWEIGHTS.recipeHistoryRating * ratingSignal +
      TASTE_SUBWEIGHTS.recipeHistoryCompletion * completionSignal +
      TASTE_SUBWEIGHTS.recipeHistoryRepeat * repeatSignal,
  );
}

function cuisineAffinity(input: ScoreCandidateInput): {
  affinity: number;
  confidence: number;
} {
  let best: { affinity: number; confidence: number } = {
    affinity: 0,
    confidence: 0,
  };
  for (const tag of input.candidate.cuisineTags) {
    const row = input.user.implicitPreferences.get(`cuisine:${tag}`);
    if (!row) continue;
    const affinity = implicitAffinity(row.score, row.confidence);
    if (Math.abs(affinity) > Math.abs(best.affinity)) {
      best = { affinity, confidence: row.confidence };
    }
  }
  // Boost explicit cuisine preferences from user profile.
  if (best.affinity === 0 && input.user.cuisinePreferences.length > 0) {
    const hit = input.candidate.cuisineTags.some((t) =>
      input.user.cuisinePreferences.some((pref) =>
        t.toLowerCase().includes(pref.toLowerCase())
      )
    );
    if (hit) return { affinity: 0.4, confidence: 0.5 };
  }
  return best;
}

function proteinAffinity(input: ScoreCandidateInput): number {
  const key = inferProteinKey(input.candidate);
  if (!key) return 0;
  const row = input.user.implicitPreferences.get(`protein_type:${key}`);
  if (!row) return 0;
  return implicitAffinity(row.score, row.confidence);
}

function mealTypeAffinity(input: ScoreCandidateInput): number {
  const row = input.user.implicitPreferences.get(
    `meal_type:${input.slot.canonicalMealType}`,
  );
  if (!row) return 0;
  return implicitAffinity(row.score, row.confidence);
}

function householdComplexityFit(input: ScoreCandidateInput): number {
  const size = input.user.householdSize || HOUSEHOLD.defaultSize;
  if (size < HOUSEHOLD.largeThreshold) return 0.5; // neutral
  // Large household → prefer family_flexible / shared_base / crowd_pleaser.
  // We use equipment_tags + meal_components as imperfect proxies. Complete-meal
  // recipes and recipes flagged batch_friendly are preferred.
  let score = 0.4;
  if (input.candidate.isComplete) score += 0.2;
  if (input.candidate.batchFriendly) score += 0.2;
  if (input.candidate.leftoversFriendly) score += 0.1;
  const maxSupported = input.candidate.maxHouseholdSizeSupported;
  if (maxSupported !== null && maxSupported >= size) score += 0.1;
  return clamp01(score);
}

function recentRepeatPenalty(input: ScoreCandidateInput): number {
  // Decay buckets aligned with the 30-day VARIETY_LIMITS.recentRecipeWindowDays
  // window. A recipe cooked between 22 and 30 days ago is still "recent
  // enough" to warrant a soft taste penalty, even though variety's
  // recentRecipePenalty has already faded most of the way out by then.
  const when = input.user.recentCookedRecipes.get(input.candidate.id);
  if (!when) return 0;
  const daysSince = (Date.now() - when.getTime()) / 86_400_000;
  if (daysSince <= 7) return 1;
  if (daysSince <= 14) return 0.6;
  if (daysSince <= 21) return 0.3;
  if (daysSince <= 30) return 0.1;
  return 0;
}

function familyFavoriteBoost(input: ScoreCandidateInput): number {
  const count = input.user.cookCountByRecipe.get(input.candidate.id) ?? 0;
  if (count >= HISTORY.cookCountForFamilyFavorite) return 1;
  if (count === 2) return 0.5;
  return 0;
}

export function scoreTasteHouseholdFit(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const recipeAff = recipeHistoryAffinity(input);
  const cuisine = cuisineAffinity(input);
  const protein = proteinAffinity(input);
  const mealType = mealTypeAffinity(input);
  const repeat = recentRepeatPenalty(input);
  const favorite = familyFavoriteBoost(input);
  const household = householdComplexityFit(input);

  // Explicit intent: no session-intent signal wired yet (A5/A7). Neutral 0.
  const explicitIntent = 0;

  const norm = clamp01(
    TASTE_SUBWEIGHTS.recipeAffinity * pos01(recipeAff) +
      TASTE_SUBWEIGHTS.cuisineAffinity * pos01(cuisine.affinity) +
      TASTE_SUBWEIGHTS.proteinAffinity * pos01(protein) +
      TASTE_SUBWEIGHTS.mealTypeAffinity * pos01(mealType) +
      TASTE_SUBWEIGHTS.explicitIntent * explicitIntent +
      TASTE_SUBWEIGHTS.familyFavorite * favorite -
      TASTE_SUBWEIGHTS.recentRepeatPenalty * repeat,
  );

  // Household complexity blends in on top of taste.
  const blended = clamp01(0.8 * norm + 0.2 * household);

  return { raw: blended, weighted: blended * weight };
}

export type FactorOutput = CandidateScoreDetail["factors"]["tasteHousehold"];
