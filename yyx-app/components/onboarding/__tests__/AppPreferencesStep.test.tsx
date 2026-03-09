/**
 * AppPreferencesStep Tests
 *
 * Tests for app preferences step component covering:
 * - Language selection
 * - Navigation
 *
 * Note: Some tests are skipped due to i18n module evaluation timing
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Import component AFTER all mocks are set up
import { AppPreferencesStep } from '../steps/AppPreferencesStep';

// Mock i18n BEFORE component import - using full module replacement
jest.mock('@/i18n', () => {
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'onboarding.steps.appPreferences.title': 'App Preferences',
      'onboarding.steps.appPreferences.subtitle': 'Customize your experience',
      'onboarding.steps.appPreferences.language': 'Preferred Language',
      'onboarding.steps.appPreferences.measurementSystem': 'Measurement System',
      'onboarding.steps.appPreferences.measurements.metric.title': 'Metric',
      'onboarding.steps.appPreferences.measurements.metric.examples': 'kg, ml, °C',
      'onboarding.steps.appPreferences.measurements.imperial.title': 'Imperial',
      'onboarding.steps.appPreferences.measurements.imperial.examples': 'oz, cups, °F',
    };
    return translations[key] || key;
  };
  return {
    __esModule: true,
    default: {
      locale: 'en',
      t: mockT,
    },
  };
});

// Mock form data state
const mockState = {
  formData: {} as any,
};
const mockUpdateFormData = jest.fn((updates) => {
  mockState.formData = { ...mockState.formData, ...updates };
});
const mockGoToNextStep = jest.fn();
const mockGoToPreviousStep = jest.fn();

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    formData: mockState.formData,
    updateFormData: mockUpdateFormData,
    goToNextStep: mockGoToNextStep,
    goToPreviousStep: mockGoToPreviousStep,
  }),
}));

// Mock LanguageContext
const mockSetLanguage = jest.fn();
const mockSetLocale = jest.fn().mockResolvedValue(undefined);
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    setLanguage: mockSetLanguage,
    setLocale: mockSetLocale,
  }),
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

// Mock Supabase - the component fetches locales from the DB
const mockSupabaseOrder = jest.fn().mockResolvedValue({
  data: [
    { code: 'en', display_name: 'English' },
    { code: 'es', display_name: 'Espanol' },
  ],
  error: null,
});
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: mockSupabaseOrder,
          }),
        }),
      }),
    }),
  },
}));

// Mock Button
jest.mock('@/components/common/Button', () => ({
  Button: ({ label, variant, onPress, children }: any) => {
    const { Pressable, Text: RNText } = require('react-native');
    return (
      <Pressable
        testID={`button-${(label || 'custom').toLowerCase().replace(/\s/g, '-')}`}
        onPress={onPress}
        accessibilityState={{ selected: variant === 'primary' }}
      >
        {label ? <RNText>{label}</RNText> : children}
      </Pressable>
    );
  },
}));

// Mock StepNavigationButtons
jest.mock('../StepNavigationButtons', () => ({
  StepNavigationButtons: ({ onNext, onBack }: any) => {
    const { View: RNView, Pressable, Text: RNText } = require('react-native');
    return (
      <RNView>
        <Pressable testID="back-button" onPress={onBack}>
          <RNText>Back</RNText>
        </Pressable>
        <Pressable testID="next-button" onPress={onNext}>
          <RNText>Next</RNText>
        </Pressable>
      </RNView>
    );
  },
}));

describe('AppPreferencesStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.formData = {};
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('displays title', () => {
      render(<AppPreferencesStep />);

      expect(screen.getByText('App Preferences')).toBeTruthy();
    });

    it('displays subtitle', () => {
      render(<AppPreferencesStep />);

      expect(screen.getByText('Customize your experience')).toBeTruthy();
    });

    it('displays language section', () => {
      render(<AppPreferencesStep />);

      expect(screen.getByText('Preferred Language')).toBeTruthy();
    });

    it('displays measurement section', () => {
      render(<AppPreferencesStep />);

      expect(screen.getByText('Measurement System')).toBeTruthy();
    });

    it('displays language options', async () => {
      render(<AppPreferencesStep />);

      // Wait for locale options to load from the mock DB fetch
      await waitFor(() => {
        expect(screen.getByText('English')).toBeTruthy();
        expect(screen.getByText('Espanol')).toBeTruthy();
      });
    });
  });

  // ============================================================
  // LANGUAGE SELECTION TESTS
  // ============================================================

  describe('language selection', () => {
    it('selects English language', async () => {
      mockState.formData = { language: 'es' };
      render(<AppPreferencesStep />);

      // Wait for locale options to load from the mock DB fetch
      await waitFor(() => {
        expect(screen.getByTestId('button-english')).toBeTruthy();
      });

      const englishButton = screen.getByTestId('button-english');
      fireEvent.press(englishButton);

      await waitFor(() => {
        expect(mockSetLocale).toHaveBeenCalledWith('en');
      });
      expect(mockUpdateFormData).toHaveBeenCalledWith({ language: 'en' });
    });

    it('selects Spanish language', async () => {
      mockState.formData = { language: 'en' };
      render(<AppPreferencesStep />);

      // Wait for locale options to load from the mock DB fetch
      await waitFor(() => {
        expect(screen.getByTestId('button-espanol')).toBeTruthy();
      });

      const spanishButton = screen.getByTestId('button-espanol');
      fireEvent.press(spanishButton);

      await waitFor(() => {
        expect(mockSetLocale).toHaveBeenCalledWith('es');
      });
      expect(mockUpdateFormData).toHaveBeenCalledWith({ language: 'es' });
    });
  });

  // ============================================================
  // NAVIGATION TESTS
  // ============================================================

  describe('navigation', () => {
    it('goes to next step', () => {
      render(<AppPreferencesStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockGoToNextStep).toHaveBeenCalled();
    });

    it('goes to previous step', () => {
      render(<AppPreferencesStep />);

      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockGoToPreviousStep).toHaveBeenCalled();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('accepts custom className', () => {
      const { toJSON } = render(<AppPreferencesStep className="custom-class" />);

      expect(toJSON()).toBeTruthy();
    });

    it('accepts custom style', () => {
      const customStyle = { backgroundColor: 'red' };
      const { toJSON } = render(<AppPreferencesStep style={customStyle} />);

      expect(toJSON()).toBeTruthy();
    });
  });
});
