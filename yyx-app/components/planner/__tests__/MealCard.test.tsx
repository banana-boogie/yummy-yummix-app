import React from 'react';
import { renderWithProviders, screen } from '@/test/utils/render';
import { MealCard } from '@/components/planner/MealCard';
import type {
  MealPlanSlotResponse,
  MealPlanSlotComponentResponse,
} from '@/types/mealPlan';

function buildComponent(
  overrides: Partial<MealPlanSlotComponentResponse> = {},
): MealPlanSlotComponentResponse {
  return {
    id: 'c-1',
    componentRole: 'main',
    sourceKind: 'recipe',
    recipeId: 'r-1',
    sourceComponentId: null,
    foodGroupsSnapshot: [],
    pairingBasis: 'standalone',
    displayOrder: 0,
    isPrimary: true,
    title: 'Air Fryer Chicken Thighs',
    imageUrl: null,
    totalTimeMinutes: 30,
    difficulty: 'easy',
    portions: 4,
    equipmentTags: [],
    ...overrides,
  };
}

function buildSlot(
  overrides: Partial<MealPlanSlotResponse> = {},
): MealPlanSlotResponse {
  return {
    id: 's-1',
    plannedDate: '2026-04-30',
    dayIndex: 4,
    mealType: 'dinner',
    displayMealLabel: 'Dinner',
    displayOrder: 0,
    slotType: 'cook_slot',
    structureTemplate: 'main_plus_one_component',
    expectedFoodGroups: [],
    selectionReason: '',
    shoppingSyncState: 'not_created',
    status: 'planned',
    swapCount: 0,
    lastSwappedAt: null,
    cookedAt: null,
    skippedAt: null,
    mergedCookingGuide: null,
    components: [buildComponent()],
    coverageComplete: true,
    ...overrides,
  };
}

describe('MealCard multi-component rendering', () => {
  it('renders both main and side titles when the slot has two components', () => {
    const slot = buildSlot({
      components: [
        buildComponent({ id: 'c-1', isPrimary: true, displayOrder: 0 }),
        buildComponent({
          id: 'c-2',
          isPrimary: false,
          displayOrder: 1,
          componentRole: 'side',
          title: 'Arroz Rojo',
        }),
      ],
    });

    renderWithProviders(<MealCard slot={slot} mode="active" />);

    expect(screen.getByText('Air Fryer Chicken Thighs')).toBeTruthy();
    expect(screen.getByText(/Arroz Rojo/)).toBeTruthy();
  });

  it('exposes all component titles in the accessibility label', () => {
    const slot = buildSlot({
      components: [
        buildComponent({ id: 'c-1', isPrimary: true, title: 'Mongolian Beef' }),
        buildComponent({
          id: 'c-2',
          isPrimary: false,
          componentRole: 'side',
          title: 'Steamed Broccoli',
          displayOrder: 1,
        }),
      ],
    });

    renderWithProviders(<MealCard slot={slot} mode="active" />);

    expect(
      screen.getByLabelText(/Dinner.*Mongolian Beef.*Steamed Broccoli/),
    ).toBeTruthy();
  });

  it('shows coverage-incomplete hint when coverageComplete is false', () => {
    const slot = buildSlot({ coverageComplete: false });
    renderWithProviders(<MealCard slot={slot} mode="active" />);
    expect(
      screen.getByText(/Couldn't complete this meal/),
    ).toBeTruthy();
  });

  it('does not show the coverage hint when coverageComplete is true', () => {
    const slot = buildSlot({ coverageComplete: true });
    renderWithProviders(<MealCard slot={slot} mode="active" />);
    expect(screen.queryByText(/Couldn't complete this meal/)).toBeNull();
  });
});
