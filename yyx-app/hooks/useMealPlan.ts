/**
 * TanStack Query hook for the user's active meal plan.
 *
 * Exposes plan data + action mutations. Mutations invalidate the active-plan
 * query so the UI updates immediately after swap/skip/mark-cooked/approval.
 */

import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { mealPlanService } from '@/services/mealPlanService';
import {
  todayDayIndex,
  todayLocalISO,
} from '@/components/planner/utils/dayIndex';
import type {
  GeneratePlanOptions,
  GeneratePlanResponse,
  MealPlanResponse,
  MealPlanSlotResponse,
  PlanProgress,
  PreferencesResponse,
  SwapMealResponse,
  UpdatePreferencesPayload,
  UpdatePreferencesResponse,
} from '@/types/mealPlan';

export const mealPlanKeys = {
  all: ['mealPlan'] as const,
  active: () => [...mealPlanKeys.all, 'active'] as const,
  preferences: () => [...mealPlanKeys.all, 'preferences'] as const,
};

function startOfWeekISO(date = new Date()): string {
  // ISO week start = Monday
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // 0 for Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export interface UseMealPlanReturn {
  activePlan: MealPlanResponse | null;
  preferences: PreferencesResponse | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  generatePlan: (options?: GeneratePlanOptions) => Promise<GeneratePlanResponse>;
  updatePreferences: (
    payload: UpdatePreferencesPayload,
  ) => Promise<UpdatePreferencesResponse>;
  swapSlot: (slotId: string, reason?: string) => Promise<SwapMealResponse>;
  /**
   * Apply a chosen alternative to a slot. Calls swap_meal with
   * selectedRecipeId, which triggers the server to swap the slot's primary
   * component, increment swap_count, stamp last_swapped_at, and return
   * fresh alternatives. The plan is invalidated and refetched on success.
   */
  applySwap: (slotId: string, recipeId: string) => Promise<SwapMealResponse>;
  skipSlot: (slotId: string) => Promise<void>;
  markCooked: (slotId: string) => Promise<void>;
  generateShoppingList: () => Promise<string | null>;

  todaysSlots: MealPlanSlotResponse[];
  planProgress: PlanProgress;

  /** True when planQuery has cached data (i.e., a previous successful fetch). */
  hasCachedPlan: boolean;
  /** Awaitable refetch. Resolves once the underlying query refetch settles. */
  refetch: () => Promise<void>;
}

export function useMealPlan(): UseMealPlanReturn {
  const queryClient = useQueryClient();

  const planQuery = useQuery({
    queryKey: mealPlanKeys.active(),
    queryFn: () => mealPlanService.getCurrentPlan({}),
    staleTime: 60 * 1000,
  });

  const prefsQuery = useQuery({
    queryKey: mealPlanKeys.preferences(),
    queryFn: () => mealPlanService.getPreferences(),
    staleTime: 5 * 60 * 1000,
  });

  const activePlan = planQuery.data?.plan ?? null;
  const preferences = prefsQuery.data?.preferences ?? null;

  const invalidatePlan = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: mealPlanKeys.active() });
  }, [queryClient]);

  const invalidatePreferences = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: mealPlanKeys.preferences() });
  }, [queryClient]);

  const generateMutation = useMutation({
    mutationFn: async (options: GeneratePlanOptions = {}) => {
      const weekStart = options.weekStart ?? startOfWeekISO();
      const dayIndexes = options.dayIndexes ?? [0, 1, 2, 3, 4];
      const mealTypes = options.mealTypes ?? ['dinner'];
      return mealPlanService.generatePlan({
        weekStart,
        dayIndexes,
        mealTypes,
        busyDays: options.busyDays,
        preferLeftoversForLunch: options.preferLeftoversForLunch,
        replaceExisting: options.replaceExisting,
      });
    },
    onSuccess: () => invalidatePlan(),
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (payload: UpdatePreferencesPayload) =>
      mealPlanService.updatePreferences(payload),
    onSuccess: () => {
      invalidatePreferences();
      invalidatePlan();
    },
  });

  const swapMutation = useMutation({
    mutationFn: async (vars: { slotId: string; reason?: string }) => {
      if (!activePlan) throw new Error('No active plan');
      return mealPlanService.swapMeal({
        mealPlanId: activePlan.planId,
        mealPlanSlotId: vars.slotId,
        reason: vars.reason,
      });
    },
    onSuccess: () => invalidatePlan(),
  });

  const applySwapMutation = useMutation({
    mutationFn: async (vars: { slotId: string; recipeId: string }) => {
      if (!activePlan) throw new Error('No active plan');
      return mealPlanService.swapMeal({
        mealPlanId: activePlan.planId,
        mealPlanSlotId: vars.slotId,
        selectedRecipeId: vars.recipeId,
      });
    },
    onSuccess: () => invalidatePlan(),
  });

  const skipMutation = useMutation({
    mutationFn: async (slotId: string) => {
      if (!activePlan) throw new Error('No active plan');
      await mealPlanService.skipMeal({
        mealPlanId: activePlan.planId,
        mealPlanSlotId: slotId,
      });
    },
    onSuccess: () => invalidatePlan(),
  });

  const markCookedMutation = useMutation({
    mutationFn: async (slotId: string) => {
      if (!activePlan) throw new Error('No active plan');
      await mealPlanService.markMealCooked({
        mealPlanId: activePlan.planId,
        mealPlanSlotId: slotId,
      });
    },
    onSuccess: () => invalidatePlan(),
  });

  const shoppingListMutation = useMutation({
    mutationFn: async () => {
      if (!activePlan) throw new Error('No active plan');
      const res = await mealPlanService.generateShoppingList({
        mealPlanId: activePlan.planId,
      });
      return res.shoppingListId;
    },
    onSuccess: () => invalidatePlan(),
  });

  const todayIndex = todayDayIndex();
  const todayISO = todayLocalISO();
  const todaysSlots = useMemo(
    () =>
      (activePlan?.slots ?? []).filter(
        (s) => s.dayIndex === todayIndex && s.plannedDate === todayISO,
      ),
    [activePlan, todayIndex, todayISO],
  );

  const planProgress = useMemo<PlanProgress>(() => {
    const slots = activePlan?.slots ?? [];
    return {
      planned: slots.length,
      cooked: slots.filter((s) => s.status === 'cooked').length,
      skipped: slots.filter((s) => s.status === 'skipped').length,
    };
  }, [activePlan]);

  const error =
    (planQuery.error as Error | undefined)?.message ??
    (generateMutation.error as Error | undefined)?.message ??
    null;

  return {
    activePlan,
    preferences,
    isLoading: planQuery.isLoading || prefsQuery.isLoading,
    isGenerating: generateMutation.isPending,
    error,
    generatePlan: (options) => generateMutation.mutateAsync(options ?? {}),
    updatePreferences: (payload) =>
      updatePreferencesMutation.mutateAsync(payload),
    swapSlot: (slotId, reason) => swapMutation.mutateAsync({ slotId, reason }),
    applySwap: (slotId, recipeId) =>
      applySwapMutation.mutateAsync({ slotId, recipeId }),
    skipSlot: (slotId) => skipMutation.mutateAsync(slotId).then(() => undefined),
    markCooked: (slotId) =>
      markCookedMutation.mutateAsync(slotId).then(() => undefined),
    generateShoppingList: () => shoppingListMutation.mutateAsync(),
    todaysSlots,
    planProgress,
    // Stub backend can return `{ plan: null }` after generate; that's not a
    // useful cache to fall back on, so the blocking-error path should still
    // fire. Only treat the query as cached when there's an actual plan.
    hasCachedPlan: planQuery.data?.plan != null,
    refetch: () => planQuery.refetch().then(() => undefined),
  };
}
