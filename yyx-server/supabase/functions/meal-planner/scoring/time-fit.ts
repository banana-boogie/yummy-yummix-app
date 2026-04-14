/**
 * Factor: Time Fit (0..15)
 *
 * Compares candidate total_time against the slot's time budget.
 *
 * Spec: ranking-algorithm-detail.md §4.6
 */

import { clamp01, resolveTimeBudget } from "../scoring-config.ts";
import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

export function scoreTimeFit(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const total = input.candidate.totalTimeMinutes;
  if (total === null) {
    // missing time → neutral (avoid a silent zero)
    return { raw: 0.5, weighted: 0.5 * weight };
  }
  const budget = resolveTimeBudget(
    input.slot.slotKind,
    input.slot.isBusyDay,
    input.user.defaultMaxWeeknightMinutes,
  );
  const norm = clamp01(1 - Math.max(0, total - budget) / Math.max(budget, 1));
  return { raw: norm, weighted: norm * weight };
}
