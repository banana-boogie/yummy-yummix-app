import React from 'react';
import { renderWithProviders, fireEvent, screen, waitFor } from '@/test/utils/render';
import { FirstTimePlanSetupFlow } from '@/components/planner/FirstTimePlanSetupFlow';
import i18n from '@/i18n';
import type { PreferencesResponse } from '@/types/mealPlan';

let mockLocale = 'en-US';
let mockLanguage = 'en';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: mockLanguage,
    locale: mockLocale,
    setLanguage: jest.fn(),
    setLocale: jest.fn(),
  }),
}));

describe('FirstTimePlanSetupFlow', () => {
  beforeEach(() => {
    mockLocale = 'en-US';
    mockLanguage = 'en';
    i18n.locale = 'en';
  });

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

  it('auto-finishes when saved preferences already answer every step', async () => {
    // setupCompletedAt non-null — user has saved before, so populated arrays
    // are real answers and the flow can fast-finish with them.
    const onComplete = jest.fn().mockResolvedValue(undefined);
    const initialPreferences: PreferencesResponse = {
      mealTypes: ['dinner'],
      busyDays: [2],
      activeDayIndexes: [0, 1, 2, 3, 4],
      defaultMaxWeeknightMinutes: 30,
      autoLeftovers: false,
      preferredEatTimes: {},
      setupCompletedAt: '2026-04-25T12:00:00Z',
    };

    renderWithProviders(
      <FirstTimePlanSetupFlow
        initialPreferences={initialPreferences}
        onComplete={onComplete}
        onCancel={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        dayIndexes: [0, 1, 2, 3, 4],
        mealTypes: ['dinner'],
        busyDays: [2],
      });
    });
  });

  it('uses the selected preset when days is the only remaining step (saved prefs)', async () => {
    // Saved prefs (setupCompletedAt non-null) with empty activeDayIndexes —
    // only the days step needs to be answered.
    const onComplete = jest.fn().mockResolvedValue(undefined);
    const initialPreferences: PreferencesResponse = {
      mealTypes: ['dinner'],
      busyDays: [2],
      activeDayIndexes: [],
      defaultMaxWeeknightMinutes: 30,
      autoLeftovers: false,
      preferredEatTimes: {},
      setupCompletedAt: '2026-04-25T12:00:00Z',
    };

    renderWithProviders(
      <FirstTimePlanSetupFlow
        initialPreferences={initialPreferences}
        onComplete={onComplete}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('Every day'));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        dayIndexes: [0, 1, 2, 3, 4, 5, 6],
        mealTypes: ['dinner'],
        busyDays: [2],
      });
    });
  });

  it('renders all steps for a first-time user even when defaults are populated', async () => {
    // Backend returns DEFAULT_PREFERENCES with populated arrays for users with
    // no DB row yet (`setupCompletedAt: null`). The flow must NOT auto-skip
    // those steps — defaults aren't user answers.
    const onComplete = jest.fn().mockResolvedValue(undefined);
    const initialPreferences: PreferencesResponse = {
      mealTypes: ['dinner'],
      busyDays: [2],
      activeDayIndexes: [0, 1, 2, 3, 4],
      defaultMaxWeeknightMinutes: 30,
      autoLeftovers: false,
      preferredEatTimes: {},
      setupCompletedAt: null,
    };

    renderWithProviders(
      <FirstTimePlanSetupFlow
        initialPreferences={initialPreferences}
        onComplete={onComplete}
        onCancel={jest.fn()}
      />,
    );

    // Days step renders first; was being skipped under the old length-only
    // check.
    expect(screen.getByText(/which days do you want meals planned/i)).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('uses comida copy and sends lunch for the locale-primary es-MX option', async () => {
    mockLocale = 'es-MX';
    mockLanguage = 'es';
    i18n.locale = 'es';
    const onComplete = jest.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <FirstTimePlanSetupFlow onComplete={onComplete} onCancel={jest.fn()} />,
    );

    fireEvent.press(screen.getByText('Entre semana'));
    await waitFor(() => screen.getByText('¿Algún día muy ocupado?'));
    fireEvent.press(screen.getByText('Continuar'));
    await waitFor(() => screen.getByText('¿Qué comidas planeo?'));

    fireEvent.press(screen.getByText('Solo comidas'));
    fireEvent.press(screen.getByText('¡A planear tu menú!'));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        dayIndexes: [0, 1, 2, 3, 4],
        mealTypes: ['lunch'],
        busyDays: [],
      });
    });
  });
});
