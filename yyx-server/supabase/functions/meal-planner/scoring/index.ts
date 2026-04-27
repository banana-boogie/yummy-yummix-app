/**
 * Scoring orchestrator — combines all factor modules into the 100-point score.
 *
 * Hard-rule checks (allergen conflicts, explicit dietary violations, repeat
 * already-assigned recipes) are evaluated here so callers get a unified
 * `hardRuleViolations` list.
 */

import {
  pickWeights,
  SCORE_MODIFIERS,
  type ScoringMode,
  type ScoringWeights,
} from "../scoring-config.ts";
import { isAlternateRoleMatch } from "../candidate-retrieval.ts";
import type { CandidateScoreDetail, ScoreCandidateInput } from "./types.ts";
import { scoreTasteHouseholdFit } from "./taste-household-fit.ts";
import { scoreVerifiedBoost } from "./verified-boost.ts";
import { scoreSlotFit } from "./slot-fit.ts";
import { scoreTimeFit } from "./time-fit.ts";
import { scoreNutritionFit } from "./nutrition-fit.ts";
import { scoreVariety } from "./variety.ts";
import { scoreIngredientOverlap } from "./ingredient-overlap.ts";

export function scoreCandidate(
  input: ScoreCandidateInput,
): CandidateScoreDetail {
  const weights: ScoringWeights = pickWeights(input.state.mode);

  const tasteHousehold = scoreTasteHouseholdFit(input, weights.tasteHousehold);
  const slotFit = scoreSlotFit(input, weights.slotFit);
  const timeFit = scoreTimeFit(input, weights.timeFit);
  const ingredientOverlap = scoreIngredientOverlap(
    input,
    weights.ingredientOverlap,
  );
  const variety = scoreVariety(input, weights.variety);
  const nutrition = scoreNutritionFit(input, weights.nutrition);
  const verified = scoreVerifiedBoost(input, weights.verified);

  const softPenalties: string[] = [];
  const hardRuleViolations: string[] = [];

  if (input.state.assignedRecipeIds.has(input.candidate.id)) {
    hardRuleViolations.push("already_assigned_this_week");
  }
  if (input.candidate.hasAllergenConflict) {
    hardRuleViolations.push("allergen_conflict");
  }
  if (input.candidate.hasDislikeConflict) {
    hardRuleViolations.push("ingredient_dislike_conflict");
  }
  if (!input.candidate.isPublished) {
    hardRuleViolations.push("not_published");
  }

  let total = tasteHousehold.weighted +
    slotFit.weighted +
    timeFit.weighted +
    ingredientOverlap.weighted +
    variety.weighted +
    nutrition.weighted +
    verified.weighted;

  // Primary-role preference: a recipe matched only via alternate_planner_roles
  // takes a small penalty so a recipe in its default role is preferred when
  // both fit the slot. Per recipe-role-model.md §6.3.
  if (isAlternateRoleMatch(input.slot, input.candidate)) {
    total -= SCORE_MODIFIERS.primaryRolePreferencePenalty;
    softPenalties.push("alternate_role_match");
  }

  return {
    slotId: input.slot.slotId,
    recipeId: input.candidate.id,
    total,
    factors: {
      tasteHousehold,
      slotFit,
      timeFit,
      ingredientOverlap,
      variety,
      nutrition,
      verified,
    },
    softPenalties,
    hardRuleViolations,
  };
}

export function violatesHardRules(detail: CandidateScoreDetail): boolean {
  return detail.hardRuleViolations.length > 0;
}

export type { CandidateScoreDetail, ScoreCandidateInput } from "./types.ts";
export type { ScoringMode };
