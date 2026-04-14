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
import type {
  GeneratePlanOptions,
  GeneratePlanResponse,
  MealPlanResponse,
  MealPlanSlotResponse,
  PlanProgress,
  PreferencesResponse,
  SwapMealResponse,
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

function todayDayIndex(): number {
  // meal-slot-schema uses Monday = 0
  const day = new Date().getDay();
  return (day + 6) % 7;
}

export interface UseMealPlanReturn {
  activePlan: MealPlanResponse | null;
  preferences: PreferencesResponse | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  generatePlan: (options?: GeneratePlanOptions) => Promise<GeneratePlanResponse>;
  swapSlot: (slotId: string, reason?: string) => Promise<SwapMealResponse>;
  skipSlot: (slotId: string) => Promise<void>;
  markCooked: (slotId: string) => Promise<void>;
  generateShoppingList: () => Promise<string | null>;

  todaysSlots: MealPlanSlotResponse[];
  planProgress: PlanProgress;

  refetch: () => void;
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

  const swapMutation = useMutation({
    mutationFn: async (vars: { slotId: string; reason?: string }) => {
      if (!activePlan) throw new Error('No active plan');
      return mealPlanService.swapMeal({
        mealPlanId: activePlan.planId,
        mealPlanSlotId: vars.slotId,
        reason: vars.reason,
      });
    },
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
  const todaysSlots = useMemo(
    () => (activePlan?.slots ?? []).filter((s) => s.dayIndex === todayIndex),
    [activePlan, todayIndex],
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
    swapSlot: (slotId, reason) => swapMutation.mutateAsync({ slotId, reason }),
    skipSlot: (slotId) => skipMutation.mutateAsync(slotId).then(() => undefined),
    markCooked: (slotId) =>
      markCookedMutation.mutateAsync(slotId).then(() => undefined),
    generateShoppingList: () => shoppingListMutation.mutateAsync(),
    todaysSlots,
    planProgress,
    refetch: () => {
      planQuery.refetch();
    },
  };
}
