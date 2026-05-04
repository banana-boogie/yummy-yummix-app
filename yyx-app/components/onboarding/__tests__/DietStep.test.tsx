/**
 * DietStep Tests
 *
 * Tests for diet step component covering:
 * - Diet type options display
 * - Single and multiple selection
 * - Empty selection as no preference
 * - Navigation to next step
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { DietStep } from '../steps/DietStep';

// Create stable references for mocks
const mockUpdateFormData = jest.fn();
const mockGoToPreviousStep = jest.fn();
const mockGoToNextStep = jest.fn();

// Test state that gets read dynamically
let mockFormData: any = { dietTypes: [] };

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    get formData() {
      return mockFormData;
    },
    updateFormData: (updates: any) => {
      mockUpdateFormData(updates);
      mockFormData = { ...mockFormData, ...updates };
    },
    goToPreviousStep: mockGoToPreviousStep,
    goToNextStep: mockGoToNextStep,
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'onboarding.steps.diet.title': 'Dietary preferences?',
        'onboarding.steps.diet.subtitle': 'Select all that apply',
        'onboarding.steps.diet.options.vegetarian': 'Vegetarian',
        'onboarding.steps.diet.options.vegan': 'Vegan',
        'onboarding.steps.diet.options.keto': 'Keto',
        'onboarding.steps.diet.options.low_carb': 'Low Carb',
        'onboarding.steps.diet.options.paleo': 'Paleo',
        'onboarding.steps.diet.options.low_sodium': 'Low Sodium',
        'onboarding.steps.diet.options.low_sugar': 'Low Sugar',
        'onboarding.steps.diet.options.high_protein': 'High Protein',
        'onboarding.steps.diet.options.pescatarian': 'Pescatarian',
      };
      return translations[key] || key;
    },
  },
}));

// Mock SelectableCard
jest.mock('@/components/common/SelectableCard', () => ({
  SelectableCard: ({ label, selected, onPress }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity
        testID={`diet-option-${label.toLowerCase().replace(/\s/g, '-')}`}
        onPress={onPress}
        accessibilityState={{ selected }}
      >
        <Text>{label}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock StepNavigationButtons
jest.mock('@/components/onboarding/StepNavigationButtons', () => ({
  StepNavigationButtons: ({ onNext, onBack, disabled }: any) => {
    const { View, Pressable, Text } = require('react-native');
    return (
      <View>
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Pressable testID="next-button" onPress={onNext} disabled={disabled}>
          <Text>Next</Text>
        </Pressable>
      </View>
    );
  },
}));

// Mock dietary icons
jest.mock('@/constants/dietaryIcons', () => ({
  getDietTypeIcon: () => null,
}));

describe('DietStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormData = { dietTypes: [] };
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('displays title', () => {
      renderWithProviders(<DietStep />);
      expect(screen.getByText('Dietary preferences?')).toBeTruthy();
    });

    it('displays subtitle', () => {
      renderWithProviders(<DietStep />);
      expect(screen.getByText('Select all that apply')).toBeTruthy();
    });

    it('displays diet options', () => {
      renderWithProviders(<DietStep />);
      expect(screen.getByText('Vegan')).toBeTruthy();
      expect(screen.getByText('Vegetarian')).toBeTruthy();
      expect(screen.getByText('Keto')).toBeTruthy();
      expect(screen.getByText('Low Sugar')).toBeTruthy();
    });

    it('does not display legacy sentinel or diet values', () => {
      renderWithProviders(<DietStep />);
      expect(screen.queryByText('No specific diet')).toBeNull();
      expect(screen.queryByText('Other')).toBeNull();
      expect(screen.queryByText('Mediterranean')).toBeNull();
      expect(screen.queryByText('Sugar Free')).toBeNull();
    });
  });

  // ============================================================
  // SELECTION TESTS
  // ============================================================

  describe('selection', () => {
    it('selects a diet option', () => {
      renderWithProviders(<DietStep />);

      const veganOption = screen.getByTestId('diet-option-vegan');
      fireEvent.press(veganOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegan'],
        otherDiet: [],
      });
    });

    it('allows multiple selections', () => {
      mockFormData = { dietTypes: ['vegan'] };
      renderWithProviders(<DietStep />);

      const vegetarianOption = screen.getByTestId('diet-option-vegetarian');
      fireEvent.press(vegetarianOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegan', 'vegetarian'],
        otherDiet: [],
      });
    });

    it('deselects a diet option', () => {
      mockFormData = { dietTypes: ['vegan', 'vegetarian'] };
      renderWithProviders(<DietStep />);

      const veganOption = screen.getByTestId('diet-option-vegan');
      fireEvent.press(veganOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegetarian'],
        otherDiet: [],
      });
    });
  });

  // ============================================================
  // EMPTY SELECTION TESTS
  // ============================================================

  describe('empty selection', () => {
    it('treats no selection as no preference and allows next step', () => {
      mockFormData = { dietTypes: [] };
      renderWithProviders(<DietStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: [],
        otherDiet: [],
      });
      expect(mockGoToNextStep).toHaveBeenCalled();
    });
  });

  // ============================================================
  // NAVIGATION TESTS
  // ============================================================

  describe('navigation', () => {
    it('goes to next step when selection made', () => {
      mockFormData = { dietTypes: ['vegan'] };
      renderWithProviders(<DietStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegan'],
        otherDiet: [],
      });
      expect(mockGoToNextStep).toHaveBeenCalled();
    });

    it('goes to previous step', () => {
      renderWithProviders(<DietStep />);

      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockGoToPreviousStep).toHaveBeenCalled();
    });
  });
});
