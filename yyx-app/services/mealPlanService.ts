/**
 * Meal Plan Service
 *
 * Thin wrapper around the `meal-planner` edge function. Only implements the
 * actions the Explore track needs: fetching the active plan and adding a
 * recipe to a slot.
 */

import { supabase } from '@/lib/supabase';
import logger from '@/services/logger';
import type {
  AddRecipeToSlotPayload,
  AddRecipeToSlotResponse,
  MealPlan,
} from '@/types/mealPlan';

interface MealPlannerErrorBody {
  error?: { code?: string; message?: string };
}

async function invokePlanner<T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('meal-planner', {
    body: { action, payload },
  });

  if (error) {
    logger.warn(`[mealPlanService] ${action} failed:`, error.message);
    throw error;
  }

  if (data && typeof data === 'object' && 'error' in data) {
    const body = data as MealPlannerErrorBody;
    const message = body.error?.message ?? `meal-planner ${action} failed`;
    throw new Error(message);
  }

  return data as T;
}

export const mealPlanService = {
  async getCurrentPlan(): Promise<MealPlan | null> {
    const data = await invokePlanner<{ plan: MealPlan | null; warnings: string[] }>(
      'get_current_plan',
      {},
    );
    return data.plan ?? null;
  },

  async addRecipeToSlot(
    payload: AddRecipeToSlotPayload,
  ): Promise<AddRecipeToSlotResponse> {
    return invokePlanner<AddRecipeToSlotResponse>('add_recipe_to_slot', {
      mealPlanId: payload.mealPlanId,
      mealPlanSlotId: payload.mealPlanSlotId,
      recipeId: payload.recipeId,
    });
  },
};

export default mealPlanService;
