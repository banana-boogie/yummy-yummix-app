/**
 * DietStep Tests
 *
 * Tests for diet step component covering:
 * - Diet type options display (now database-driven)
 * - Single and multiple selection
 * - "None" option behavior
 * - "Other" option with custom input
 * - Navigation to next step
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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

// Mock LanguageContext
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

// Mock preferencesService
jest.mock('@/services/preferencesService', () => ({
  __esModule: true,
  default: {
    getDietTypes: jest.fn().mockResolvedValue([
      { id: '1', slug: 'vegan', name: 'Vegan', iconName: 'vegan-diet' },
      { id: '2', slug: 'vegetarian', name: 'Vegetarian', iconName: 'vegetarian-diet' },
      { id: '3', slug: 'keto', name: 'Keto', iconName: 'keto-diet' },
    ]),
  },
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'onboarding.steps.diet.title': 'Dietary preferences?',
        'onboarding.steps.diet.subtitle': 'Select all that apply',
        'onboarding.steps.diet.options.none': 'No specific diet',
        'onboarding.steps.diet.options.other': 'Other',
        'onboarding.steps.diet.otherPlaceholder': 'Enter other diet',
        'onboarding.common.addAnother': 'Add another',
        'validation.otherDietRequired': 'Please enter your other diet',
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

// Mock OtherInputField
jest.mock('@/components/form/OtherInputField', () => ({
  OtherInputField: ({ items, onItemsChange, placeholder, error }: any) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View testID="other-input-container">
        {items.map((item: string, index: number) => (
          <TextInput
            key={index}
            testID={`other-input-${index}`}
            value={item}
            onChangeText={(text: string) => {
              const newItems = [...items];
              newItems[index] = text;
              onItemsChange(newItems);
            }}
            placeholder={placeholder}
          />
        ))}
        {error && <Text testID="error-message">{error}</Text>}
      </View>
    );
  },
}));

// Mock dietary icons
jest.mock('@/constants/dietaryIcons', () => ({
  getDietTypeIcon: () => null,
  DIETARY_RESTRICTION_ICONS: {
    none: 1,
    other: 2,
  },
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
    it('displays title', async () => {
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Dietary preferences?')).toBeTruthy();
      });
    });

    it('displays subtitle', async () => {
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Select all that apply')).toBeTruthy();
      });
    });

    it('displays diet options from database', async () => {
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Vegan')).toBeTruthy();
        expect(screen.getByText('Vegetarian')).toBeTruthy();
        expect(screen.getByText('Keto')).toBeTruthy();
        expect(screen.getByText('No specific diet')).toBeTruthy();
      });
    });
  });

  // ============================================================
  // SELECTION TESTS
  // ============================================================

  describe('selection', () => {
    it('selects a diet option', async () => {
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Vegan')).toBeTruthy();
      });

      const veganOption = screen.getByTestId('diet-option-vegan');
      fireEvent.press(veganOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegan'],
      });
    });

    it('allows multiple selections', async () => {
      mockFormData = { dietTypes: ['vegan'] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Vegetarian')).toBeTruthy();
      });

      const vegetarianOption = screen.getByTestId('diet-option-vegetarian');
      fireEvent.press(vegetarianOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegan', 'vegetarian'],
      });
    });

    it('deselects a diet option', async () => {
      mockFormData = { dietTypes: ['vegan', 'vegetarian'] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Vegan')).toBeTruthy();
      });

      const veganOption = screen.getByTestId('diet-option-vegan');
      fireEvent.press(veganOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegetarian'],
      });
    });
  });

  // ============================================================
  // "NONE" OPTION TESTS
  // ============================================================

  describe('"none" option', () => {
    it('clears other selections when "none" is selected', async () => {
      mockFormData = { dietTypes: ['vegan', 'vegetarian'] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('No specific diet')).toBeTruthy();
      });

      const noneOption = screen.getByTestId('diet-option-no-specific-diet');
      fireEvent.press(noneOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['none'],
        otherDiet: [],
      });
    });

    it('removes "none" when selecting another option', async () => {
      mockFormData = { dietTypes: ['none'] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Vegan')).toBeTruthy();
      });

      const veganOption = screen.getByTestId('diet-option-vegan');
      fireEvent.press(veganOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegan'],
      });
    });
  });

  // ============================================================
  // "OTHER" OPTION TESTS
  // ============================================================

  describe('"other" option', () => {
    it('shows input field when "other" is selected', async () => {
      mockFormData = { dietTypes: ['other'] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByTestId('other-input-container')).toBeTruthy();
      });
    });

    it('does not show input field when "other" is not selected', async () => {
      mockFormData = { dietTypes: ['vegan'] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByText('Vegan')).toBeTruthy();
      });

      expect(screen.queryByTestId('other-input-container')).toBeNull();
    });
  });

  // ============================================================
  // NAVIGATION TESTS
  // ============================================================

  describe('navigation', () => {
    it('does not go to next step when no selection', async () => {
      mockFormData = { dietTypes: [] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByTestId('next-button')).toBeTruthy();
      });

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockGoToNextStep).not.toHaveBeenCalled();
    });

    it('goes to next step when selection made', async () => {
      mockFormData = { dietTypes: ['vegan'] };
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByTestId('next-button')).toBeTruthy();
      });

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockGoToNextStep).toHaveBeenCalled();
    });

    it('goes to previous step', async () => {
      render(<DietStep />);

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeTruthy();
      });

      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockGoToPreviousStep).toHaveBeenCalled();
    });
  });
});
