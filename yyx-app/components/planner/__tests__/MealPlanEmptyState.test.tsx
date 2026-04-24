import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { MealPlanEmptyState } from '@/components/planner/MealPlanEmptyState';

describe('MealPlanEmptyState', () => {
  it('renders the first-time variant with bullets', () => {
    renderWithProviders(
      <MealPlanEmptyState variant="first-time" onPressPlan={jest.fn()} />,
    );
    expect(screen.getByText('Ready to plan your menu?')).toBeTruthy();
    expect(screen.getByText(/Choose your meals and days/)).toBeTruthy();
  });

  it('renders the ready variant without bullets', () => {
    renderWithProviders(
      <MealPlanEmptyState variant="ready" onPressPlan={jest.fn()} />,
    );
    expect(screen.getByText("Let's plan another menu")).toBeTruthy();
    expect(screen.queryByText(/Choose your meals and days/)).toBeNull();
  });

  it('fires onPressPlan when the primary CTA is tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(
      <MealPlanEmptyState variant="first-time" onPressPlan={onPress} />,
    );
    fireEvent.press(screen.getByText('Plan My Menu'));
    expect(onPress).toHaveBeenCalled();
  });
});
