import React from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, renderWithProviders, screen } from '@/test/utils/render';
import { MealPlanView } from '@/components/planner/MealPlanView';
import type {
  MealPlanResponse,
  MealPlanSlotComponentResponse,
  MealPlanSlotResponse,
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
    title: 'Visible Meal',
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
    plannedDate: '2026-04-27',
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
    components: [buildComponent()],
    coverageComplete: true,
    ...overrides,
  };
}

function buildPlan(
  overrides: Partial<MealPlanResponse> = {},
): MealPlanResponse {
  return {
    planId: 'plan-1',
    weekStart: '2026-04-27',
    locale: 'en',
    requestedDayIndexes: [0],
    requestedMealTypes: ['dinner'],
    shoppingListId: null,
    shoppingSyncState: 'not_created',
    slots: [buildSlot()],
    ...overrides,
  };
}

function renderMealPlanView(
  plan: MealPlanResponse,
  overrides: Partial<React.ComponentProps<typeof MealPlanView>> = {},
) {
  return renderWithProviders(
    <MealPlanView
      plan={plan}
      todayDayIndex={0}
      isApproving={false}
      onApprove={jest.fn()}
      onActiveCtaPress={jest.fn()}
      onRemove={jest.fn()}
      {...overrides}
    />,
  );
}

describe('MealPlanView', () => {
  it('hides skipped meal slots from the week view', () => {
    const plan = buildPlan({
      slots: [
        buildSlot({
          id: 'visible-slot',
          components: [buildComponent({ title: 'Visible Meal' })],
        }),
        buildSlot({
          id: 'removed-slot',
          status: 'skipped',
          skippedAt: '2026-04-27T12:00:00Z',
          displayOrder: 1,
          components: [buildComponent({ id: 'c-removed', title: 'Removed Meal' })],
        }),
      ],
    });

    renderMealPlanView(plan);

    expect(screen.getByText('Visible Meal')).toBeTruthy();
    expect(screen.queryByText('Removed Meal')).toBeNull();
  });

  it('calls the active CTA handler instead of routing to a missing shopping tab', () => {
    const onActiveCtaPress = jest.fn();
    const plan = buildPlan({ shoppingListId: 'shop-1' });

    renderMealPlanView(plan, { onActiveCtaPress });

    fireEvent.press(screen.getByText('Go to today'));

    expect(onActiveCtaPress).toHaveBeenCalledTimes(1);
  });

  it('excludes skipped slots from the progress bar (not just the cards)', () => {
    const plan = buildPlan({
      slots: [
        buildSlot({ id: 'a', components: [buildComponent({ id: 'ca' })] }),
        buildSlot({
          id: 'b',
          status: 'skipped',
          skippedAt: '2026-04-27T12:00:00Z',
          displayOrder: 1,
          components: [buildComponent({ id: 'cb' })],
        }),
      ],
    });

    renderMealPlanView(plan);

    // After hiding the skipped slot, only one slot is visible — the bar must
    // read "0 of 1 cooked", not "0 of 2".
    expect(screen.getByText('0 of 1 cooked')).toBeTruthy();
  });

  it('scrolls the day list to the tapped day-tab using the captured y offset (B-20260504-07)', () => {
    const scrollSpy = jest
      .spyOn(ScrollView.prototype as unknown as { scrollTo: () => void }, 'scrollTo')
      .mockImplementation(() => {});
    const rafSpy = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0 as unknown as number;
      });

    try {
      const plan = buildPlan({
        requestedDayIndexes: [0, 1, 2],
        slots: [
          buildSlot({ id: 's-mon', dayIndex: 0 }),
          buildSlot({
            id: 's-tue',
            dayIndex: 1,
            components: [buildComponent({ id: 'c-tue', title: 'Tuesday Meal' })],
          }),
          buildSlot({
            id: 's-wed',
            dayIndex: 2,
            components: [buildComponent({ id: 'c-wed', title: 'Wednesday Meal' })],
          }),
        ],
      });

      renderMealPlanView(plan);

      // Simulate layout: Mon at y=0, Tue at y=120, Wed at y=240.
      const layouts: Record<number, number> = { 0: 0, 1: 120, 2: 240 };
      for (const [i, y] of Object.entries(layouts)) {
        fireEvent(
          screen.getByTestId(`meal-plan-day-${i}`),
          'layout',
          { nativeEvent: { layout: { x: 0, y, width: 320, height: 80 } } },
        );
      }

      // The day strip uses short labels — tap Wednesday ("Wed").
      fireEvent.press(screen.getByLabelText('Wed'));

      expect(scrollSpy).toHaveBeenCalledWith({ y: 240, animated: true });
    } finally {
      scrollSpy.mockRestore();
      rafSpy.mockRestore();
    }
  });
});
