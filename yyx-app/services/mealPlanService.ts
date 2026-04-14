/**
 * Client for the `meal-planner` Supabase edge function.
 *
 * All planner actions are routed through a single edge function with an
 * `action` discriminator (see server `types.ts`). This service exposes one
 * typed method per action.
 */

import { supabase } from '@/lib/supabase';
import logger from '@/services/logger';
import type {
  GetCurrentPlanPayload,
  GetCurrentPlanResponse,
  GeneratePlanPayload,
  GeneratePlanResponse,
  SwapMealPayload,
  SwapMealResponse,
  SkipMealPayload,
  SkipMealResponse,
  MarkMealCookedPayload,
  MarkMealCookedResponse,
  GenerateShoppingListPayload,
  GenerateShoppingListResponse,
  GetPreferencesResponse,
  UpdatePreferencesPayload,
  UpdatePreferencesResponse,
  LinkShoppingListPayload,
  LinkShoppingListResponse,
  MealPlanAction,
  MealPlannerErrorResponse,
} from '@/types/mealPlan';

const FUNCTION_NAME = 'meal-planner';

function isErrorResponse(value: unknown): value is MealPlannerErrorResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    'error' in (value as Record<string, unknown>) &&
    typeof (value as MealPlannerErrorResponse).error?.code === 'string'
  );
}

async function invoke<TResponse>(
  action: MealPlanAction,
  payload?: Record<string, unknown>,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action, payload: payload ?? {} },
  });

  if (error) {
    logger.error(`meal-planner ${action} failed`, error);
    throw new Error(error.message || 'meal-planner request failed');
  }

  if (isErrorResponse(data)) {
    throw new Error(`${data.error.code}: ${data.error.message}`);
  }

  return data as TResponse;
}

export const mealPlanService = {
  getCurrentPlan(payload: GetCurrentPlanPayload = {}) {
    return invoke<GetCurrentPlanResponse>(
      'get_current_plan',
      payload as unknown as Record<string, unknown>,
    );
  },
  generatePlan(payload: GeneratePlanPayload) {
    return invoke<GeneratePlanResponse>(
      'generate_plan',
      payload as unknown as Record<string, unknown>,
    );
  },
  swapMeal(payload: SwapMealPayload) {
    return invoke<SwapMealResponse>('swap_meal', payload as unknown as Record<string, unknown>);
  },
  skipMeal(payload: SkipMealPayload) {
    return invoke<SkipMealResponse>('skip_meal', payload as unknown as Record<string, unknown>);
  },
  markMealCooked(payload: MarkMealCookedPayload) {
    return invoke<MarkMealCookedResponse>(
      'mark_meal_cooked',
      payload as unknown as Record<string, unknown>,
    );
  },
  generateShoppingList(payload: GenerateShoppingListPayload) {
    return invoke<GenerateShoppingListResponse>(
      'generate_shopping_list',
      payload as unknown as Record<string, unknown>,
    );
  },
  getPreferences() {
    return invoke<GetPreferencesResponse>('get_preferences');
  },
  updatePreferences(payload: UpdatePreferencesPayload) {
    return invoke<UpdatePreferencesResponse>(
      'update_preferences',
      payload as unknown as Record<string, unknown>,
    );
  },
  linkShoppingList(payload: LinkShoppingListPayload) {
    return invoke<LinkShoppingListResponse>(
      'link_shopping_list',
      payload as unknown as Record<string, unknown>,
    );
  },
};

export type MealPlanService = typeof mealPlanService;
