/**
 * Factor: Variety (0..10)
 *
 * Depends on the week state built up so far:
 *   - adjacent-day protein repeat penalty
 *   - weekly cuisine repeat penalty (scaled by user cuisine affinity)
 *   - cross-week recentRecipe penalty (decaying)
 *   - noveltyBalance bonus (capped in first-week trust mode)
 *
 * Spec: ranking-algorithm-detail.md §4.5
 */

import {
  clamp01,
  VARIETY_LIMITS,
  VARIETY_SUBWEIGHTS,
} from "../scoring-config.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

function primaryProteinKey(
  candidate: ScoreCandidateInput["candidate"],
): string | null {
  if (!candidate.foodGroups.includes("protein")) return null;
  const markers = [
    "chicken",
    "pollo",
    "beef",
    "carne_de_res",
    "pork",
    "cerdo",
    "fish",
    "pescado",
    "shrimp",
    "camaron",
    "tofu",
    "egg",
    "huevo",
    "lentil",
    "lenteja",
    "beans",
    "frijol",
    "chickpea",
    "garbanzo",
  ];
  for (const key of candidate.ingredientKeys) {
    for (const m of markers) {
      if (key.includes(m)) return m;
    }
  }
  return "other_protein";
}

function adjacentProteinPenalty(input: ScoreCandidateInput): number {
  const key = primaryProteinKey(input.candidate);
  if (!key) return 0;
  const prev = input.state.assignedProteinByDayIndex.get(
    input.slot.dayIndex - VARIETY_LIMITS.adjacentProteinWindow,
  );
  const next = input.state.assignedProteinByDayIndex.get(
    input.slot.dayIndex + VARIETY_LIMITS.adjacentProteinWindow,
  );
  if (prev === key || next === key) return 1;
  return 0;
}

function weeklyCuisinePenalty(input: ScoreCandidateInput): number {
  if (input.candidate.cuisineTags.length === 0) return 0;
  // Consider the dominant cuisine tag as the primary.
  const primary = input.candidate.cuisineTags[0];
  const count = input.state.assignedCuisineCounts.get(primary) ?? 0;
  if (count === 0) return 0;
  if (count >= VARIETY_LIMITS.weeklyCuisineRepeatThreshold) return 1;
  return count / VARIETY_LIMITS.weeklyCuisineRepeatThreshold;
}

function cuisineAffinityScale(input: ScoreCandidateInput): number {
  // If the user strongly prefers a cuisine tag, dampen the repeat penalty.
  let bestAffinity = 0;
  let bestConfidence = 0;
  for (const tag of input.candidate.cuisineTags) {
    const row = input.user.implicitPreferences.get(`cuisine:${tag}`);
    if (!row) continue;
    const normalized = Math.max(-1, Math.min(1, row.score / 3));
    if (normalized > bestAffinity) {
      bestAffinity = normalized;
      bestConfidence = row.confidence;
    }
  }
  return 1 - clamp01(bestAffinity * bestConfidence);
}

function recentRecipePenalty(input: ScoreCandidateInput): number {
  const when = input.user.recentCookedRecipes.get(input.candidate.id);
  if (!when) return 0;
  const daysSince = (Date.now() - when.getTime()) / 86_400_000;
  const windowDays = VARIETY_LIMITS.recentRecipeWindowWeeks * 7;
  if (daysSince >= windowDays) return 0;
  // Decaying linearly: same week = 1, fading over 3 weeks.
  const remaining = windowDays - daysSince;
  return clamp01(remaining / windowDays);
}

function noveltyBalanceBonus(input: ScoreCandidateInput): number {
  // Novel recipe = not cooked in the last 30 days AND not already in this week.
  const cookedRecently = input.user.recentCookedRecipes.has(input.candidate.id);
  const alreadyAssignedThisWeek = input.state.assignedRecipeIds.has(
    input.candidate.id,
  );
  const isNovel = !cookedRecently && !alreadyAssignedThisWeek;
  if (!isNovel) return 0;
  if (input.state.mode === "first_week_trust") {
    return input.state.noveltyCount < VARIETY_LIMITS.firstWeekNoveltyCap
      ? 0.6
      : 0.1;
  }
  return 1;
}

export function scoreVariety(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const adjacent = adjacentProteinPenalty(input);
  const cuisineRaw = weeklyCuisinePenalty(input);
  const cuisineScale = cuisineAffinityScale(input);
  const cuisine = cuisineRaw * cuisineScale;
  const recent = recentRecipePenalty(input);
  const novelty = noveltyBalanceBonus(input);

  const norm = clamp01(
    VARIETY_SUBWEIGHTS.adjacentProtein * (1 - adjacent) +
      VARIETY_SUBWEIGHTS.weeklyCuisine * (1 - cuisine) +
      VARIETY_SUBWEIGHTS.recentRecipe * (1 - recent) +
      VARIETY_SUBWEIGHTS.noveltyBalance * novelty,
  );

  return { raw: norm, weighted: norm * weight };
}
