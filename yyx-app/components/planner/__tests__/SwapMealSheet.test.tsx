import React from 'react';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { SwapMealSheet } from '@/components/planner/SwapMealSheet';
import type {
  MealPlanSlotResponse,
  SwapAlternative,
  SwapMealResponse,
} from '@/types/mealPlan';

function buildSlot(id: string, title: string): MealPlanSlotResponse {
  return {
    id,
    plannedDate: '2026-04-25',
    dayIndex: 5,
    mealType: 'lunch',
    displayMealLabel: 'Comida',
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
    components: [
      {
        id: `${id}-c0`,
        componentRole: 'main',
        sourceKind: 'recipe',
        recipeId: `recipe-${id}`,
        sourceComponentId: null,
        foodGroupsSnapshot: [],
        pairingBasis: 'standalone',
        displayOrder: 0,
        isPrimary: true,
        title,
        imageUrl: null,
        totalTimeMinutes: 30,
        difficulty: 'easy',
        portions: 4,
        equipmentTags: [],
      },
    ],
  };
}

function buildAlternative(id: string, title: string): SwapAlternative {
  return { slot: buildSlot(id, title), selectionReason: 'test' };
}

describe('SwapMealSheet', () => {
  const slot = buildSlot('slot-1', 'Original lunch');

  it('shows loading state then renders alternatives on success', async () => {
    const onSwap = jest.fn().mockResolvedValue({
      alternatives: [
        buildAlternative('alt-1', 'Tacos al pastor'),
        buildAlternative('alt-2', 'Sopa azteca'),
      ],
      warnings: [],
    } satisfies SwapMealResponse);

    renderWithProviders(
      <SwapMealSheet
        visible
        slot={slot}
        onSwap={onSwap}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Looking for alternatives…')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Tacos al pastor')).toBeTruthy();
    });
    expect(screen.getByText('Sopa azteca')).toBeTruthy();
  });

  it('renders empty state when alternatives is empty', async () => {
    const onSwap = jest.fn().mockResolvedValue({ alternatives: [], warnings: [] });

    renderWithProviders(
      <SwapMealSheet
        visible
        slot={slot}
        onSwap={onSwap}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No alternatives found. Try again later.'),
      ).toBeTruthy();
    });
  });

  it('renders error state when onSwap rejects', async () => {
    const onSwap = jest.fn().mockRejectedValue(new Error('network'));

    renderWithProviders(
      <SwapMealSheet
        visible
        slot={slot}
        onSwap={onSwap}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No alternatives found. Try again later.'),
      ).toBeTruthy();
    });
  });

  it('calls onClose and onPickAlternative when an alternative is tapped', async () => {
    const onSwap = jest.fn().mockResolvedValue({
      alternatives: [buildAlternative('alt-1', 'Tacos al pastor')],
      warnings: [],
    });
    const onClose = jest.fn();
    const onPick = jest.fn();

    renderWithProviders(
      <SwapMealSheet
        visible
        slot={slot}
        onSwap={onSwap}
        onClose={onClose}
        onPickAlternative={onPick}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Tacos al pastor')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Tacos al pastor'));
    expect(onPick).toHaveBeenCalledWith({
      slotId: 'alt-1',
      newRecipeId: 'recipe-alt-1',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('passes newRecipeId: null when alternative has no primary recipe', async () => {
    const altSlot = buildSlot('alt-no-recipe', 'Mystery dish');
    // Strip recipeId from primary component to simulate orphaned/missing data.
    altSlot.components = altSlot.components.map((c) => ({
      ...c,
      recipeId: null,
    }));
    const onSwap = jest.fn().mockResolvedValue({
      alternatives: [{ slot: altSlot, selectionReason: 'test' }],
      warnings: [],
    });
    const onPick = jest.fn();

    renderWithProviders(
      <SwapMealSheet
        visible
        slot={slot}
        onSwap={onSwap}
        onClose={jest.fn()}
        onPickAlternative={onPick}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Mystery dish')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Mystery dish'));
    expect(onPick).toHaveBeenCalledWith({
      slotId: 'alt-no-recipe',
      newRecipeId: null,
    });
  });

  it('exposes a labeled close button', async () => {
    const onSwap = jest.fn().mockResolvedValue({ alternatives: [], warnings: [] });
    const onClose = jest.fn();
    renderWithProviders(
      <SwapMealSheet
        visible
        slot={slot}
        onSwap={onSwap}
        onClose={onClose}
      />,
    );

    const closeButtons = screen.getAllByLabelText('Close');
    // Tap one of them.
    fireEvent.press(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
