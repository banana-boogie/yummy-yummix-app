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
import i18n from '@/i18n';
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

/**
 * Format a YYYY-MM-DD plan-week-start in the user's locale.
 * Returns "May 4" (en) / "4 may" (es) / falls back to the raw ISO if parsing fails.
 */
function formatPlanDate(weekStartISO: string | undefined, locale: string): string {
  if (!weekStartISO) return '';
  // Build a Date from the local ISO without TZ shift — split on '-' so we
  // get the date the user thinks they have, not UTC midnight in their zone.
  const [y, m, d] = weekStartISO.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return weekStartISO;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return weekStartISO;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return weekStartISO;
  }
}

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
    onSuccess: (data) => {
      // Seed the active-plan cache from the response so the plan view paints
      // immediately after setup — no empty-state flash while a refetch is in
      // flight. Project to GetCurrentPlanResponse shape (drop generate-only
      // fields). Invalidate after to keep server-side ranking changes in
      // sync on the next read.
      queryClient.setQueryData(mealPlanKeys.active(), {
        plan: data.plan,
        warnings: data.warnings,
      });
      invalidatePlan();
    },
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
      // Format the plan's week-start date in the user's locale so the list
      // name reads "Mi Menú - 4 may" / "My Menu - May 4" — anchors the list
      // to the plan it represents, not the moment the user clicked.
      const formattedDate = formatPlanDate(activePlan.weekStart, i18n.locale);
      const res = await mealPlanService.generateShoppingList({
        mealPlanId: activePlan.planId,
        defaultListName: i18n.t('planner.shoppingListDefaultName', {
          date: formattedDate,
        }),
      });
      return res.shoppingListId;
    },
    onSuccess: () => invalidatePlan(),
  });

  const { mutateAsync: generatePlanAsync, isPending: isGenerating } = generateMutation;
  const { mutateAsync: updatePreferencesAsync } = updatePreferencesMutation;
  const { mutateAsync: swapMealAsync } = swapMutation;
  const { mutateAsync: applySwapAsync } = applySwapMutation;
  const { mutateAsync: skipMealAsync } = skipMutation;
  const { mutateAsync: markCookedAsync } = markCookedMutation;
  const { mutateAsync: generateShoppingListAsync } = shoppingListMutation;
  const { refetch: refetchPlan } = planQuery;

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

  // Include preference fetch failures: setup state derives from preferences,
  // so a silent prefsQuery error makes a network failure look like first-time
  // onboarding instead of a connection problem.
  const error =
    (planQuery.error as Error | undefined)?.message ??
    (prefsQuery.error as Error | undefined)?.message ??
    (generateMutation.error as Error | undefined)?.message ??
    null;

  const generatePlan = useCallback(
    (options?: GeneratePlanOptions) => generatePlanAsync(options ?? {}),
    [generatePlanAsync],
  );

  const updatePreferences = useCallback(
    (payload: UpdatePreferencesPayload) =>
      updatePreferencesAsync(payload),
    [updatePreferencesAsync],
  );

  const swapSlot = useCallback(
    (slotId: string, reason?: string) =>
      swapMealAsync({ slotId, reason }),
    [swapMealAsync],
  );

  const applySwap = useCallback(
    (slotId: string, recipeId: string) =>
      applySwapAsync({ slotId, recipeId }),
    [applySwapAsync],
  );

  const skipSlot = useCallback(
    (slotId: string) => skipMealAsync(slotId).then(() => undefined),
    [skipMealAsync],
  );

  const markCooked = useCallback(
    (slotId: string) =>
      markCookedAsync(slotId).then(() => undefined),
    [markCookedAsync],
  );

  const generateShoppingList = useCallback(
    () => generateShoppingListAsync(),
    [generateShoppingListAsync],
  );

  const refetch = useCallback(
    () => refetchPlan().then(() => undefined),
    [refetchPlan],
  );

  return useMemo(() => ({
    activePlan,
    preferences,
    isLoading: planQuery.isLoading || prefsQuery.isLoading,
    isGenerating,
    error,
    generatePlan,
    updatePreferences,
    swapSlot,
    applySwap,
    skipSlot,
    markCooked,
    generateShoppingList,
    todaysSlots,
    planProgress,
    // Stub backend can return `{ plan: null }` after generate; that's not a
    // useful cache to fall back on, so the blocking-error path should still
    // fire. Only treat the query as cached when there's an actual plan.
    hasCachedPlan: planQuery.data?.plan != null,
    refetch,
  }), [
    activePlan,
    preferences,
    planQuery.isLoading,
    prefsQuery.isLoading,
    isGenerating,
    error,
    generatePlan,
    updatePreferences,
    swapSlot,
    applySwap,
    skipSlot,
    markCooked,
    generateShoppingList,
    todaysSlots,
    planProgress,
    planQuery.data?.plan,
    refetch,
  ]);
}
