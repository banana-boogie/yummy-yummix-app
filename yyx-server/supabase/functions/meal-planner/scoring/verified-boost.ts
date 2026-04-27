/**
 * Factor: Verified Boost (0..5 normal / 0..10 first-week trust)
 *
 * Recipes with verified_at set receive the full factor weight. The quality
 * gate itself is is_published = true (enforced in candidate retrieval).
 *
 * Spec: ranking-algorithm-detail.md §4.2
 */

import type { ScoreCandidateInput } from "./types.ts";
import type { FactorOutput } from "./taste-household-fit.ts";

export function scoreVerifiedBoost(
  input: ScoreCandidateInput,
  weight: number,
): FactorOutput {
  const verified = input.candidate.verifiedAt !== null;
  const raw = verified ? 1 : 0;
  return { raw, weighted: raw * weight };
}
