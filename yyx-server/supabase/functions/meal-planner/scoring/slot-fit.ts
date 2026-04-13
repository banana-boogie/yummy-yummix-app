/**
 * Factor: Busy-Day / Slot Fit (0..20)
 *
 * Varies by slot kind:
 *   - cook_slot: difficulty + time compatibility + household complexity
 *   - weekend_flexible_slot: same formula with a more permissive difficulty curve
 *   - leftover source hint: if this cook-slot will feed a downstream leftover
 *       target, weight leftovers_friendly + yield confidence
 *   - no_cook_fallback_slot: tagged no_cook_eligible + reheat/assembly + zero-prep
 *
 * Spec: ranking-algorithm-detail.md §4.3
 */

import { clamp01, HOUSEHOLD, SLOT_FIT_SUBWEIGHTS } from "../scoring-config.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

function difficultyFit(
  candidate: ScoreCandidateInput["candidate"],
  user: ScoreCandidateInput["user"],
  permissive: boolean,
): number {
  const skill = user.skillLevel;
  const level = candidate.cookingLevel ?? candidate.difficulty ?? "medium";
  // Map to a 0..2 numeric scale.
  const levelIdx = levelToIndex(level);
  const skillIdx = skillToIndex(skill);
  const delta = levelIdx - skillIdx;
  if (permissive) {
    // weekend tolerates harder recipes
    if (delta <= 0) return 1;
    if (delta === 1) return 0.85;
    return 0.55;
  }
  if (delta <= 0) return 1;
  if (delta === 1) return 0.7;
  return 0.3;
}

function levelToIndex(
  level:
    | "easy"
    | "medium"
    | "hard"
    | "beginner"
    | "intermediate"
    | "experienced"
    | null,
): number {
  if (level === "easy" || level === "beginner") return 0;
  if (level === "hard" || level === "experienced") return 2;
  return 1;
}

function skillToIndex(
  skill: "beginner" | "intermediate" | "experienced" | null,
): number {
  if (skill === "beginner") return 0;
  if (skill === "experienced") return 2;
  return 1;
}

function slotTimeCompatibility(
  candidate: ScoreCandidateInput["candidate"],
  slotKind: ScoreCandidateInput["slot"]["slotKind"],
  user: ScoreCandidateInput["user"],
): number {
  const total = candidate.totalTimeMinutes ?? 0;
  if (total <= 0) return 0.5; // unknown time → neutral
  if (slotKind === "weekend_flexible_slot") {
    // Longer cooks are fine up to 3 hours.
    if (total <= 180) return 1;
    if (total <= 240) return 0.7;
    return 0.4;
  }
  if (slotKind === "no_cook_fallback_slot") {
    if (total <= 15) return 1;
    if (total <= 25) return 0.6;
    return 0.2;
  }
  const max = user.defaultMaxWeeknightMinutes || 45;
  if (total <= max) return 1;
  if (total <= max * 1.2) return 0.8;
  if (total <= max * 1.5) return 0.4;
  return 0.1;
}

function householdComplexity(input: ScoreCandidateInput): number {
  const size = input.user.householdSize || HOUSEHOLD.defaultSize;
  let score = 0.5;
  if (size >= HOUSEHOLD.largeThreshold) {
    if (input.candidate.isComplete) score += 0.15;
    if (input.candidate.batchFriendly) score += 0.15;
    if (input.candidate.leftoversFriendly) score += 0.1;
    if (
      input.candidate.maxHouseholdSizeSupported !== null &&
      input.candidate.maxHouseholdSizeSupported >= size
    ) {
      score += 0.1;
    }
  } else {
    // small household — avoid batch-only recipes that mandate multi-batch notes
    if (input.candidate.batchFriendly === false) score += 0.1;
  }
  return clamp01(score);
}

function leftoversEligible(input: ScoreCandidateInput): number {
  return input.candidate.leftoversFriendly ? 1 : 0;
}

function leftoverYieldConfidence(input: ScoreCandidateInput): number {
  const portions = input.candidate.portions;
  const householdSize = input.user.householdSize || HOUSEHOLD.defaultSize;
  if (!portions || portions <= 0) return 0;
  const surplus = portions - householdSize;
  if (surplus <= 0) return 0;
  const maxSupported = input.candidate.maxHouseholdSizeSupported;
  if (maxSupported !== null && maxSupported < householdSize) return 0.3;
  if (surplus >= householdSize) return 1; // full second meal
  return 0.6;
}

function noCookEligible(input: ScoreCandidateInput): number {
  // Must be explicitly tagged. The schema has no `no_cook_eligible` boolean
  // yet — we use `planner_role === 'snack'` OR cooking_level === 'beginner'
  // combined with total_time ≤ 20 as a safe proxy.
  if (input.candidate.plannerRole === "snack") return 1;
  const total = input.candidate.totalTimeMinutes ?? 999;
  if (total <= 10) return 1;
  if (total <= 20 && input.candidate.cookingLevel === "beginner") return 0.8;
  return 0.2;
}

function reheatOrAssemblyFit(input: ScoreCandidateInput): number {
  // No `reheat_or_assembly` tag yet. Use leftovers_friendly + short time as proxy.
  if (input.candidate.leftoversFriendly) return 0.8;
  const total = input.candidate.totalTimeMinutes ?? 999;
  if (total <= 15) return 0.6;
  return 0;
}

function zeroPrepConfidence(input: ScoreCandidateInput): number {
  const total = input.candidate.totalTimeMinutes ?? 999;
  if (total <= 5) return 1;
  if (total <= 15) return 0.7;
  if (total <= 25) return 0.4;
  return 0.1;
}

function isSourceForLeftoverTarget(input: ScoreCandidateInput): boolean {
  // The slot-classifier records sourceDependencySlotId on downstream targets;
  // we receive the source slot here and infer via week state. Since the week
  // assembler places slots in dependency order, this factor is applied when
  // the candidate is eligible to feed a future leftover slot — we approximate
  // by prefersLeftovers being false (so this is a source) AND the slot is in
  // the first half of the week.
  return !input.slot.prefersLeftovers &&
    input.slot.dayIndex < 5 &&
    input.candidate.leftoversFriendly;
}

export function scoreSlotFit(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const kind = input.slot.slotKind;

  if (kind === "no_cook_fallback_slot") {
    const subs = SLOT_FIT_SUBWEIGHTS.noCook;
    const norm = clamp01(
      subs.noCookEligible * noCookEligible(input) +
        subs.reheatAssembly * reheatOrAssemblyFit(input) +
        subs.zeroPrep * zeroPrepConfidence(input),
    );
    return { raw: norm, weighted: norm * weight };
  }

  if (kind === "weekend_flexible_slot") {
    const subs = SLOT_FIT_SUBWEIGHTS.weekend;
    const norm = clamp01(
      subs.difficulty * difficultyFit(input.candidate, input.user, true) +
        subs.timeCompat *
          slotTimeCompatibility(input.candidate, kind, input.user) +
        subs.householdComplexity * householdComplexity(input),
    );
    return { raw: norm, weighted: norm * weight };
  }

  // Leftover source treatment when feeding a future busy-day target.
  if (isSourceForLeftoverTarget(input)) {
    const subs = SLOT_FIT_SUBWEIGHTS.leftoverSource;
    const norm = clamp01(
      subs.difficulty * difficultyFit(input.candidate, input.user, false) +
        subs.timeCompat *
          slotTimeCompatibility(input.candidate, "cook_slot", input.user) +
        subs.leftoversEligible * leftoversEligible(input) +
        subs.leftoverYield * leftoverYieldConfidence(input),
    );
    return { raw: norm, weighted: norm * weight };
  }

  const subs = SLOT_FIT_SUBWEIGHTS.cook;
  const norm = clamp01(
    subs.difficulty * difficultyFit(input.candidate, input.user, false) +
      subs.timeCompat *
        slotTimeCompatibility(input.candidate, kind, input.user) +
      subs.householdComplexity * householdComplexity(input),
  );
  return { raw: norm, weighted: norm * weight };
}
