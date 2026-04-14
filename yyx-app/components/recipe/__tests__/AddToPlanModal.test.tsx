/**
 * AddToPlanModal Tests
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { AddToPlanModal } from '../AddToPlanModal';
import { recipeFactory } from '@/test/factories';
import type { MealPlan } from '@/types/mealPlan';

const mockMutateAsync = jest.fn();

jest.mock('@/hooks/useMealPlan', () => ({
  useMealPlan: () => ({
    plan: null,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    addRecipeToSlot: {
      mutateAsync: mockMutateAsync,
    },
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockLogAddToPlan = jest.fn();
jest.mock('@/services/eventService', () => ({
  eventService: {
    logExploreAddToPlan: (payload: unknown) => mockLogAddToPlan(payload),
  },
}));

describe('AddToPlanModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty-state prompt when there is no active plan', () => {
    const recipe = recipeFactory.create();
    renderWithProviders(
      <AddToPlanModal
        visible
        recipe={recipe}
        onClose={jest.fn()}
        activePlan={null}
      />,
    );
    expect(screen.getByText(/Create a plan/i)).toBeTruthy();
  });

  it('calls addRecipeToSlot and fires analytics on slot press', async () => {
    const recipe = recipeFactory.create();
    const plan: MealPlan = {
      planId: 'plan-1',
      weekStart: '2026-04-14',
      locale: 'en',
      requestedDayIndexes: [0],
      requestedMealTypes: ['dinner'],
      slots: [
        {
          id: 'slot-1',
          plannedDate: '2026-04-14',
          dayIndex: 1,
          mealType: 'dinner',
          displayMealLabel: 'Dinner',
          displayOrder: 0,
          status: 'planned',
          components: [],
        },
      ],
    };
    mockMutateAsync.mockResolvedValue({ slot: plan.slots[0], warnings: [] });
    const onClose = jest.fn();

    renderWithProviders(
      <AddToPlanModal
        visible
        recipe={recipe}
        onClose={onClose}
        activePlan={plan}
      />,
    );

    fireEvent.press(screen.getByText('Dinner'));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        mealPlanId: 'plan-1',
        mealPlanSlotId: 'slot-1',
        recipeId: recipe.id,
      });
    });
    expect(mockLogAddToPlan).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
