/**
 * Meal Plan Client Types
 *
 * Minimal slot-based types mirroring the meal-planner edge function response
 * contract. Extended as more planner actions land on the client.
 */

export type CanonicalMealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'dessert'
  | 'beverage';

export type SlotStatus = 'planned' | 'cooked' | 'skipped';

export interface MealPlanSlotComponent {
  id: string;
  componentRole: string;
  sourceKind: string;
  recipeId: string | null;
  title: string;
  imageUrl: string | null;
  totalTimeMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  portions: number | null;
  isPrimary: boolean;
  displayOrder: number;
}

export interface MealPlanSlot {
  id: string;
  plannedDate: string;
  dayIndex: number;
  mealType: CanonicalMealType;
  displayMealLabel: string;
  displayOrder: number;
  status: SlotStatus;
  components: MealPlanSlotComponent[];
}

export interface MealPlan {
  planId: string;
  weekStart: string;
  locale: string;
  requestedDayIndexes: number[];
  requestedMealTypes: string[];
  slots: MealPlanSlot[];
}

export interface AddRecipeToSlotPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  recipeId: string;
}

export interface AddRecipeToSlotResponse {
  slot: MealPlanSlot | null;
  warnings: string[];
}
