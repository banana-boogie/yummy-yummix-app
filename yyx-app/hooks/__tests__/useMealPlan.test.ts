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
});
