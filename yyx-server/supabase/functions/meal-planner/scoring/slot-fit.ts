/**
 * Factor: Busy-Day / Slot Fit (0..20)
 *
 * Varies by slot kind:
 *   - cook_slot (non-busy): difficulty + time compatibility + household complexity
 *   - cook_slot (busy-day): same shape with stronger difficulty + time weights
 *     so the user gets an easy/fast recipe on a day they flagged as busy.
 *   - weekend_flexible_slot: more permissive difficulty curve, larger time budget.
 *   - leftover source hint: if this cook-slot will feed a downstream leftover
 *     target, weight leftovers_friendly + yield confidence.
 *
 * Spec: ranking-algorithm-detail.md §4.3
 */

import { clamp01, HOUSEHOLD, SLOT_FIT_SUBWEIGHTS } from "../scoring-config.ts";
import { resolveTimeBudget } from "../scoring-config.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

function difficultyFit(
  candidate: ScoreCandidateInput["candidate"],
  user: ScoreCandidateInput["user"],
  variant: "normal" | "weekend" | "busy",
): number {
  const skill = user.skillLevel;
  const level = candidate.cookingLevel ?? candidate.difficulty ?? "medium";
  const levelIdx = levelToIndex(level);
  const skillIdx = skillToIndex(skill);
  const delta = levelIdx - skillIdx;

  if (variant === "weekend") {
    // Weekend tolerates harder recipes.
    if (delta <= 0) return 1;
    if (delta === 1) return 0.85;
    return 0.55;
  }
  if (variant === "busy") {
    // Busy days: only easy recipes get full marks. Medium is acceptable but
    // dampened; hard is strongly penalized.
    if (level === "easy" || level === "beginner") return 1;
    if (delta <= 0) return 0.6;
    if (delta === 1) return 0.35;
    return 0.1;
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
  isBusyDay: boolean,
  user: ScoreCandidateInput["user"],
): number {
  const total = candidate.totalTimeMinutes ?? 0;
  if (total <= 0) return 0.5; // unknown time → neutral
  if (slotKind === "weekend_flexible_slot") {
    if (total <= 180) return 1;
    if (total <= 240) return 0.7;
    return 0.4;
  }
  const budget = resolveTimeBudget(
    slotKind,
    isBusyDay,
    user.defaultMaxWeeknightMinutes,
  );
  if (total <= budget) return 1;
  if (total <= budget * 1.2) return 0.8;
  if (total <= budget * 1.5) return 0.4;
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
    // Small household — avoid batch-only recipes that mandate multi-batch notes.
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

function isSourceForLeftoverTarget(input: ScoreCandidateInput): boolean {
  return input.slot.feedsFutureLeftoverTarget &&
    input.candidate.leftoversFriendly;
}

export function scoreSlotFit(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const kind = input.slot.slotKind;
  const isBusyDay = input.slot.isBusyDay;

  if (kind === "weekend_flexible_slot") {
    const subs = SLOT_FIT_SUBWEIGHTS.weekend;
    const norm = clamp01(
      subs.difficulty * difficultyFit(input.candidate, input.user, "weekend") +
        subs.timeCompat *
          slotTimeCompatibility(
            input.candidate,
            kind,
            isBusyDay,
            input.user,
          ) +
        subs.householdComplexity * householdComplexity(input),
    );
    return { raw: norm, weighted: norm * weight };
  }

  // Leftover source treatment when feeding a future busy-day target.
  if (isSourceForLeftoverTarget(input)) {
    const subs = SLOT_FIT_SUBWEIGHTS.leftoverSource;
    const norm = clamp01(
      subs.difficulty * difficultyFit(input.candidate, input.user, "normal") +
        subs.timeCompat *
          slotTimeCompatibility(
            input.candidate,
            "cook_slot",
            false, // source slot is not itself busy
            input.user,
          ) +
        subs.leftoversEligible * leftoversEligible(input) +
        subs.leftoverYield * leftoverYieldConfidence(input),
    );
    return { raw: norm, weighted: norm * weight };
  }

  // Busy-day cook slot: stronger easy + fast bias so the user isn't handed a
  // 90-minute project dinner on a day they flagged as busy.
  if (isBusyDay && kind === "cook_slot") {
    const subs = SLOT_FIT_SUBWEIGHTS.busyCookSlot;
    const norm = clamp01(
      subs.difficulty * difficultyFit(input.candidate, input.user, "busy") +
        subs.timeCompat *
          slotTimeCompatibility(input.candidate, kind, true, input.user) +
        subs.householdComplexity * householdComplexity(input),
    );
    return { raw: norm, weighted: norm * weight };
  }

  const subs = SLOT_FIT_SUBWEIGHTS.cook;
  const norm = clamp01(
    subs.difficulty * difficultyFit(input.candidate, input.user, "normal") +
      subs.timeCompat *
        slotTimeCompatibility(input.candidate, kind, false, input.user) +
      subs.householdComplexity * householdComplexity(input),
  );
  return { raw: norm, weighted: norm * weight };
}
