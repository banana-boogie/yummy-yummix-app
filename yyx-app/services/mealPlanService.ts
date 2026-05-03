/**
 * Client for the `meal-planner` Supabase edge function.
 *
 * All planner actions are routed through a single edge function with an
 * `action` discriminator (see server `types.ts`). This service exposes one
 * typed method per action.
 */

import { supabase } from '@/lib/supabase';
import logger from '@/services/logger';
import i18n from '@/i18n';
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
  MealPlannerErrorCode,
  MealPlannerErrorResponse,
} from '@/types/mealPlan';

const FUNCTION_NAME = 'meal-planner';

export class MealPlannerError extends Error {
  constructor(
    public readonly code: MealPlannerErrorCode | 'UNKNOWN',
    message: string,
    public readonly action: MealPlanAction,
  ) {
    super(message);
    this.name = 'MealPlannerError';
  }
}

function isErrorResponse(value: unknown): value is MealPlannerErrorResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    'error' in (value as Record<string, unknown>) &&
    typeof (value as MealPlannerErrorResponse).error?.code === 'string'
  );
}

async function parseStructuredError(
  err: unknown,
): Promise<{ code: MealPlannerErrorCode; message: string } | null> {
  // supabase-js FunctionsHttpError exposes the original Response via .context.
  const response = (err as { context?: Response | { json?: () => Promise<unknown> } })
    ?.context;
  if (!response || typeof (response as Response).json !== 'function') return null;
  try {
    const body = await (response as Response).clone().json();
    if (isErrorResponse(body)) {
      return { code: body.error.code, message: body.error.message };
    }
  } catch {
    // Not JSON, or already consumed — fall through.
  }
  return null;
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
    const structured = await parseStructuredError(error);
    if (structured) {
      throw new MealPlannerError(structured.code, structured.message, action);
    }
    throw new MealPlannerError(
      'UNKNOWN',
      error.message || 'meal-planner request failed',
      action,
    );
  }

  if (isErrorResponse(data)) {
    throw new MealPlannerError(data.error.code, data.error.message, action);
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

/**
 * Map a thrown error from `mealPlanService` to a user-friendly translated string.
 */
export function mealPlannerErrorMessage(err: unknown): string {
  if (err instanceof MealPlannerError) {
    switch (err.code) {
      case 'INSUFFICIENT_RECIPES':
        return i18n.t('planner.error.insufficientRecipes');
      case 'INVALID_INPUT':
        return i18n.t('planner.error.invalidInput');
      case 'UNAUTHORIZED':
        return i18n.t('planner.error.unauthorized');
      case 'PLAN_NOT_FOUND':
        return i18n.t('planner.error.notFound');
      case 'PLAN_ALREADY_EXISTS':
        return i18n.t('planner.error.conflict');
      case 'SWAP_NOT_AVAILABLE':
        return i18n.t('planner.error.swapNotAvailable');
      case 'LIMITED_CATALOG_COVERAGE':
        return i18n.t('planner.error.limitedCatalog');
      case 'INTERNAL_ERROR':
      case 'UNKNOWN':
      default:
        return i18n.t('planner.error.generic');
    }
  }
  return i18n.t('planner.error.generic');
}
