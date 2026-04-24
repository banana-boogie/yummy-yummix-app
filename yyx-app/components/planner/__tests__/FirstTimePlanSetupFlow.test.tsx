import React from 'react';
import { renderWithProviders, fireEvent, screen, waitFor } from '@/test/utils/render';
import { FirstTimePlanSetupFlow } from '@/components/planner/FirstTimePlanSetupFlow';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', locale: 'en-US', setLanguage: jest.fn(), setLocale: jest.fn() }),
}));

describe('FirstTimePlanSetupFlow', () => {
  it('walks through days → busy → mealTypes and emits answers', async () => {
    const onComplete = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    renderWithProviders(
      <FirstTimePlanSetupFlow onComplete={onComplete} onCancel={onCancel} />,
    );

    // Step 1: days — choose Weekdays (auto-advance)
    fireEvent.press(screen.getByText('Weekdays'));

    // Step 2: busy — continue with no selection
    await waitFor(() => screen.getByText('Any busy days?'));
    fireEvent.press(screen.getByText('Continue'));

    // Step 3: mealTypes — choose "Just dinners" then submit
    await waitFor(() => screen.getByText('What should I plan?'));
    fireEvent.press(screen.getByText('Just dinners'));
    fireEvent.press(screen.getByText("Let's plan your menu!"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        dayIndexes: [0, 1, 2, 3, 4],
        mealTypes: ['dinner'],
        busyDays: [],
      });
    });
  });

  it('does not render a household step', () => {
    renderWithProviders(
      <FirstTimePlanSetupFlow onComplete={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.queryByText('Who are you cooking for?')).toBeNull();
  });

  it('surfaces onComplete rejection without crashing', async () => {
    const onComplete = jest.fn().mockRejectedValue(new Error('boom'));

    renderWithProviders(
      <FirstTimePlanSetupFlow onComplete={onComplete} onCancel={jest.fn()} />,
    );

    fireEvent.press(screen.getByText('Weekdays'));
    await waitFor(() => screen.getByText('Any busy days?'));
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => screen.getByText('What should I plan?'));
    fireEvent.press(screen.getByText('Just dinners'));
    fireEvent.press(screen.getByText("Let's plan your menu!"));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    // Still mounted after rejection
    expect(screen.getByText('What should I plan?')).toBeTruthy();
  });
});
