/**
 * Shared types for scoring factors.
 * Kept separate from scoring-config.ts so factor modules can import without
 * circular dependencies.
 */

import type { MealSlot } from "../slot-classifier.ts";
import type { RecipeCandidate } from "../candidate-retrieval.ts";
import type { NutritionGoal } from "../scoring-config.ts";

export interface UserContext {
  userId: string;
  locale: string;
  localeChain: string[];
  householdSize: number;
  skillLevel: "beginner" | "intermediate" | "experienced" | null;
  dietaryRestrictions: string[];
  dietTypes: string[];
  cuisinePreferences: string[];
  ingredientDislikes: string[];
  kitchenEquipment: string[];
  nutritionGoal: NutritionGoal;
  preferLeftoversForLunch: boolean;
  defaultMaxWeeknightMinutes: number;
  // Implicit preference scores keyed by `${dimension}:${key}` → signed −3..3
  implicitPreferences: Map<string, { score: number; confidence: number }>;
  // user_day_patterns evidence. evidenceWeeks === 0 triggers first-week trust.
  evidenceWeeks: number;
  // Cooked history: recipeId → most-recent cook timestamp.
  recentCookedRecipes: Map<string, Date>;
  // Cook count per recipe → used for familyFavoriteBoost.
  cookCountByRecipe: Map<string, number>;
}

export interface WeekStateReadOnly {
  assignedRecipeIds: Set<string>;
  assignedProteinByDayIndex: Map<number, string | null>;
  assignedCuisineCounts: Map<string, number>;
  ingredientIdUsage: Map<string, number>;
  noveltyCount: number;
  mode: "normal" | "first_week_trust";
  slotIndex: number;
}

export interface FactorBreakdown {
  raw: number; // normalized 0..1
  weighted: number; // contribution in final 100-point score
}

export interface CandidateScoreDetail {
  slotId: string;
  recipeId: string;
  total: number;
  factors: {
    tasteHousehold: FactorBreakdown;
    slotFit: FactorBreakdown;
    timeFit: FactorBreakdown;
    ingredientOverlap: FactorBreakdown;
    variety: FactorBreakdown;
    nutrition: FactorBreakdown;
    verified: FactorBreakdown;
  };
  softPenalties: string[];
  hardRuleViolations: string[];
}

export interface ScoreCandidateInput {
  slot: MealSlot;
  candidate: RecipeCandidate;
  state: WeekStateReadOnly;
  user: UserContext;
}
