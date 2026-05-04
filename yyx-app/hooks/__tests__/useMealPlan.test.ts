import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMealPlan } from '@/hooks/useMealPlan';
import { createTestQueryClient } from '@/test/utils/render';
import {
  mockEdgeFunctionSuccess,
  resetSupabaseMocks,
  getMockSupabaseClient,
} from '@/test/mocks/supabase';
import type {
  GetCurrentPlanResponse,
  GetPreferencesResponse,
  MealPlanResponse,
  UpdatePreferencesResponse,
} from '@/types/mealPlan';

function buildPlan(overrides: Partial<MealPlanResponse> = {}): MealPlanResponse {
  return {
    planId: 'plan-1',
    weekStart: '2026-04-20',
    locale: 'en',
    requestedDayIndexes: [0, 1, 2, 3, 4],
    requestedMealTypes: ['dinner'],
    shoppingListId: null,
    shoppingSyncState: 'not_created',
    slots: [
      {
        id: 'slot-1',
        plannedDate: '2026-04-20',
        dayIndex: 0,
        mealType: 'dinner',
        displayMealLabel: 'Dinner',
        displayOrder: 0,
        slotType: 'cook_slot',
        structureTemplate: 'single_component',
        expectedFoodGroups: [],
        selectionReason: '',
        shoppingSyncState: 'not_created',
        status: 'cooked',
        swapCount: 0,
        lastSwappedAt: null,
        cookedAt: null,
        skippedAt: null,
        mergedCookingGuide: null,
    coverageComplete: true,
        components: [],
      },
      {
        id: 'slot-2',
        plannedDate: '2026-04-21',
        dayIndex: 1,
        mealType: 'dinner',
        displayMealLabel: 'Dinner',
        displayOrder: 0,
        slotType: 'cook_slot',
        structureTemplate: 'single_component',
        expectedFoodGroups: [],
        selectionReason: '',
        shoppingSyncState: 'not_created',
        status: 'planned',
        swapCount: 0,
        lastSwappedAt: null,
        cookedAt: null,
        skippedAt: null,
        mergedCookingGuide: null,
    coverageComplete: true,
        components: [],
      },
      {
        id: 'slot-3',
        plannedDate: '2026-04-22',
        dayIndex: 2,
        mealType: 'dinner',
        displayMealLabel: 'Dinner',
        displayOrder: 0,
        slotType: 'cook_slot',
        structureTemplate: 'single_component',
        expectedFoodGroups: [],
        selectionReason: '',
        shoppingSyncState: 'not_created',
        status: 'skipped',
        swapCount: 0,
        lastSwappedAt: null,
        cookedAt: null,
        skippedAt: null,
        mergedCookingGuide: null,
    coverageComplete: true,
        components: [],
      },
    ],
    ...overrides,
  };
}

function wrapper(queryClient = createTestQueryClient()) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useMealPlan', () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('derives plan progress from slot statuses', async () => {
    const planResponse: GetCurrentPlanResponse = {
      plan: buildPlan(),
      warnings: [],
    };
    const prefsResponse: GetPreferencesResponse = {
      preferences: {
        mealTypes: ['dinner'],
        busyDays: [],
        activeDayIndexes: [0, 1, 2, 3, 4],
        defaultMaxWeeknightMinutes: 30,
        preferLeftoversForLunch: false,
        preferredEatTimes: {},
        setupCompletedAt: null,
      },
      warnings: [],
    };

    // One invoke handler that routes by action
    const mockClient = getMockSupabaseClient();
    mockClient.functions.invoke.mockImplementation(
      (_name: string, opts: { body: { action: string } }) => {
        const action = opts.body.action;
        if (action === 'get_current_plan') {
          return Promise.resolve({ data: planResponse, error: null });
        }
        if (action === 'get_preferences') {
          return Promise.resolve({ data: prefsResponse, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    );

    const { result } = renderHook(() => useMealPlan(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.activePlan).not.toBeNull();
    });

    expect(result.current.planProgress).toEqual({
      planned: 3,
      cooked: 1,
      skipped: 1,
    });
  });

  it('invalidates both plan and preferences queries after updatePreferences', async () => {
    const updateResponse: UpdatePreferencesResponse = {
      preferences: {
        mealTypes: ['lunch', 'dinner'],
        busyDays: [4],
        activeDayIndexes: [0, 1, 2, 3, 4],
        defaultMaxWeeknightMinutes: 30,
        preferLeftoversForLunch: false,
        preferredEatTimes: {},
        setupCompletedAt: null,
      },
      updated: true,
      warnings: [],
    };

    mockEdgeFunctionSuccess('meal-planner', updateResponse);

    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMealPlan(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.updatePreferences({
        dayIndexes: [0, 1, 2, 3, 4],
        mealTypes: ['lunch', 'dinner'],
        busyDays: [4],
      });
    });

    const keys = invalidateSpy.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey: readonly string[] }).queryKey),
    );
    expect(keys).toContain(JSON.stringify(['mealPlan', 'preferences']));
    expect(keys).toContain(JSON.stringify(['mealPlan', 'active']));
  });

  it('filters out slots whose plannedDate does not match today (stale-plan guard)', async () => {
    // Pin "today" to Monday 2026-04-20. todayDayIndex() => 0.
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T12:00:00'));

    const planResponse: GetCurrentPlanResponse = {
      plan: buildPlan({
        slots: [
          {
            id: 'fresh-slot',
            plannedDate: '2026-04-20',
            dayIndex: 0,
            mealType: 'dinner',
            displayMealLabel: 'Dinner',
            displayOrder: 0,
            slotType: 'cook_slot',
            structureTemplate: 'single_component',
            expectedFoodGroups: [],
            selectionReason: '',
            shoppingSyncState: 'not_created',
            status: 'planned',
            swapCount: 0,
            lastSwappedAt: null,
            cookedAt: null,
            skippedAt: null,
            mergedCookingGuide: null,
    coverageComplete: true,
            components: [],
          },
          {
            // Stale: same dayIndex but plannedDate from 2 weeks ago.
            id: 'stale-slot',
            plannedDate: '2026-04-06',
            dayIndex: 0,
            mealType: 'dinner',
            displayMealLabel: 'Dinner',
            displayOrder: 0,
            slotType: 'cook_slot',
            structureTemplate: 'single_component',
            expectedFoodGroups: [],
            selectionReason: '',
            shoppingSyncState: 'not_created',
            status: 'planned',
            swapCount: 0,
            lastSwappedAt: null,
            cookedAt: null,
            skippedAt: null,
            mergedCookingGuide: null,
    coverageComplete: true,
            components: [],
          },
        ],
      }),
      warnings: [],
    };
    const prefsResponse: GetPreferencesResponse = {
      preferences: {
        mealTypes: ['dinner'],
        busyDays: [],
        activeDayIndexes: [0, 1, 2, 3, 4],
        defaultMaxWeeknightMinutes: 30,
        preferLeftoversForLunch: false,
        preferredEatTimes: {},
        setupCompletedAt: null,
      },
      warnings: [],
    };

    const mockClient = getMockSupabaseClient();
    mockClient.functions.invoke.mockImplementation(
      (_name: string, opts: { body: { action: string } }) => {
        const action = opts.body.action;
        if (action === 'get_current_plan') {
          return Promise.resolve({ data: planResponse, error: null });
        }
        if (action === 'get_preferences') {
          return Promise.resolve({ data: prefsResponse, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    );

    const { result } = renderHook(() => useMealPlan(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.activePlan).not.toBeNull();
    });

    expect(result.current.todaysSlots).toHaveLength(1);
    expect(result.current.todaysSlots[0].id).toBe('fresh-slot');
  });

  it('returns awaitable refetch that settles only after refetch resolves (F3)', async () => {
    const planResponse: GetCurrentPlanResponse = {
      plan: buildPlan(),
      warnings: [],
    };
    const prefsResponse: GetPreferencesResponse = {
      preferences: {
        mealTypes: ['dinner'],
        busyDays: [],
        activeDayIndexes: [0, 1, 2, 3, 4],
        defaultMaxWeeknightMinutes: 30,
        preferLeftoversForLunch: false,
        preferredEatTimes: {},
        setupCompletedAt: null,
      },
      warnings: [],
    };

    const mockClient = getMockSupabaseClient();
    let initialResolved = false;
    let deferredResolve: (() => void) | null = null;

    mockClient.functions.invoke.mockImplementation(
      (_name: string, opts: { body: { action: string } }) => {
        const action = opts.body.action;
        if (action === 'get_current_plan') {
          if (!initialResolved) {
            initialResolved = true;
            return Promise.resolve({ data: planResponse, error: null });
          }
          // Second call (refetch) — gate it on a deferred we can release.
          return new Promise((resolve) => {
            deferredResolve = () =>
              resolve({ data: planResponse, error: null });
          });
        }
        if (action === 'get_preferences') {
          return Promise.resolve({ data: prefsResponse, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    );

    const { result } = renderHook(() => useMealPlan(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.activePlan).not.toBeNull();
    });
    expect(result.current.hasCachedPlan).toBe(true);

    let settled = false;
    let refetchPromise: Promise<void> | null = null;
    act(() => {
      refetchPromise = result.current.refetch().then(() => {
        settled = true;
      });
    });

    // Refetch is in-flight — the returned promise must not have resolved yet.
    await Promise.resolve();
    expect(settled).toBe(false);

    // Release the deferred and confirm the promise settles.
    await act(async () => {
      deferredResolve?.();
      await refetchPromise;
    });
    expect(settled).toBe(true);
  });

  it('does not treat a cached null plan response as a usable cached plan', async () => {
    const planResponse: GetCurrentPlanResponse = {
      plan: null,
      warnings: [],
    };
    const prefsResponse: GetPreferencesResponse = {
      preferences: {
        mealTypes: ['dinner'],
        busyDays: [],
        activeDayIndexes: [0, 1, 2, 3, 4],
        defaultMaxWeeknightMinutes: 30,
        preferLeftoversForLunch: false,
        preferredEatTimes: {},
        setupCompletedAt: null,
      },
      warnings: [],
    };

    const mockClient = getMockSupabaseClient();
    mockClient.functions.invoke.mockImplementation(
      (_name: string, opts: { body: { action: string } }) => {
        const action = opts.body.action;
        if (action === 'get_current_plan') {
          return Promise.resolve({ data: planResponse, error: null });
        }
        if (action === 'get_preferences') {
          return Promise.resolve({ data: prefsResponse, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    );

    const { result } = renderHook(() => useMealPlan(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activePlan).toBeNull();
    expect(result.current.hasCachedPlan).toBe(false);
  });

  it('invalidates the active-plan query after a successful swap', async () => {
    const planResponse: GetCurrentPlanResponse = {
      plan: buildPlan(),
      warnings: [],
    };
    const prefsResponse: GetPreferencesResponse = {
      preferences: {
        mealTypes: ['dinner'],
        busyDays: [],
        activeDayIndexes: [0, 1, 2, 3, 4],
        defaultMaxWeeknightMinutes: 30,
        preferLeftoversForLunch: false,
        preferredEatTimes: {},
        setupCompletedAt: null,
      },
      warnings: [],
    };

    const mockClient = getMockSupabaseClient();
    mockClient.functions.invoke.mockImplementation(
      (_name: string, opts: { body: { action: string } }) => {
        const action = opts.body.action;
        if (action === 'get_current_plan') {
          return Promise.resolve({ data: planResponse, error: null });
        }
        if (action === 'get_preferences') {
          return Promise.resolve({ data: prefsResponse, error: null });
        }
        if (action === 'swap_meal') {
          return Promise.resolve({
            data: { alternatives: [], warnings: [] },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    );

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useMealPlan(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.activePlan).not.toBeNull();
    });

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.swapSlot('slot-2', 'too-busy');
    });

    const keys = invalidateSpy.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey: readonly string[] }).queryKey),
    );
    expect(keys).toContain(JSON.stringify(['mealPlan', 'active']));
  });

  it('surfaces preference fetch failures in the error state', async () => {
    // Setup state derives from preferences. A silent prefsQuery error would
    // render as a default first-time empty state instead of a network failure
    // alert. This test pins that prefsQuery.error participates in the
    // surfaced error coalescing.
    const planResponse: GetCurrentPlanResponse = {
      plan: buildPlan(),
      warnings: [],
    };

    const mockClient = getMockSupabaseClient();
    mockClient.functions.invoke.mockImplementation(
      (_name: string, opts: { body: { action: string } }) => {
        const action = opts.body.action;
        if (action === 'get_current_plan') {
          return Promise.resolve({ data: planResponse, error: null });
        }
        if (action === 'get_preferences') {
          return Promise.resolve({
            data: null,
            error: { message: 'prefs unreachable' },
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    );

    const { result } = renderHook(() => useMealPlan(), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('prefs unreachable');
    });
  });
});
