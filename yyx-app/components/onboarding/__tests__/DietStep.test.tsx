/**
 * DietStep Tests
 *
 * Tests for diet step component covering:
 * - Diet type options display
 * - Single and multiple selection
 * - "None" option behavior
 * - "Other" option with custom input
 * - Form completion submission
 * - Navigation
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DietStep } from '../steps/DietStep';

// Create stable references for mocks
const mockUpdateFormData = jest.fn();
const mockGoToPreviousStep = jest.fn();

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
  StepNavigationButtons: ({ onNext, onBack, disabled, loading, isLastStep }: any) => {
    const { View, Pressable, Text } = require('react-native');
    return (
      <View>
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Pressable testID="next-button" onPress={onNext} disabled={disabled || loading}>
          <Text>{isLastStep ? 'Complete' : 'Next'}</Text>
          {loading && <Text testID="loading-indicator">Loading...</Text>}
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

// Mock diet types
jest.mock('@/types/dietary', () => ({
  DIET_TYPES: ['vegetarian', 'vegan', 'keto', 'none', 'other'],
}));

// Mock dietary icons
jest.mock('@/constants/dietaryIcons', () => ({
  getDietTypeIcon: () => null,
}));

describe('DietStep', () => {
  const mockOnComplete = jest.fn();
  const defaultProps = {
    onComplete: mockOnComplete,
    isSubmitting: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormData = { dietTypes: [] };
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('displays title', () => {
      render(<DietStep {...defaultProps} />);

      expect(screen.getByText('Dietary preferences?')).toBeTruthy();
    });

    it('displays subtitle', () => {
      render(<DietStep {...defaultProps} />);

      expect(screen.getByText('Select all that apply')).toBeTruthy();
    });

    it('displays diet options', () => {
      render(<DietStep {...defaultProps} />);

      expect(screen.getByText('Vegetarian')).toBeTruthy();
      expect(screen.getByText('Vegan')).toBeTruthy();
      expect(screen.getByText('Keto')).toBeTruthy();
      expect(screen.getByText('No specific diet')).toBeTruthy();
    });
  });

  // ============================================================
  // SELECTION TESTS
  // ============================================================

  describe('selection', () => {
    it('selects a diet option', () => {
      render(<DietStep {...defaultProps} />);

      const vegetarianOption = screen.getByTestId('diet-option-vegetarian');
      fireEvent.press(vegetarianOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegetarian'],
      });
    });

    it('allows multiple selections', () => {
      mockFormData = { dietTypes: ['vegetarian'] };
      render(<DietStep {...defaultProps} />);

      const veganOption = screen.getByTestId('diet-option-vegan');
      fireEvent.press(veganOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegetarian', 'vegan'],
      });
    });

    it('deselects a diet option', () => {
      mockFormData = { dietTypes: ['vegetarian', 'vegan'] };
      render(<DietStep {...defaultProps} />);

      const vegetarianOption = screen.getByTestId('diet-option-vegetarian');
      fireEvent.press(vegetarianOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegan'],
      });
    });
  });

  // ============================================================
  // "NONE" OPTION TESTS
  // ============================================================

  describe('"none" option', () => {
    it('clears other selections when "none" is selected', () => {
      mockFormData = { dietTypes: ['vegetarian', 'vegan'] };
      render(<DietStep {...defaultProps} />);

      const noneOption = screen.getByTestId('diet-option-no-specific-diet');
      fireEvent.press(noneOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['none'],
        otherDiet: [],
      });
    });

    it('removes "none" when selecting another option', () => {
      mockFormData = { dietTypes: ['none'] };
      render(<DietStep {...defaultProps} />);

      const vegetarianOption = screen.getByTestId('diet-option-vegetarian');
      fireEvent.press(vegetarianOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietTypes: ['vegetarian'],
      });
    });
  });

  // ============================================================
  // "OTHER" OPTION TESTS
  // ============================================================

  describe('"other" option', () => {
    it('shows input field when "other" is selected', () => {
      mockFormData = { dietTypes: ['other'] };
      render(<DietStep {...defaultProps} />);

      expect(screen.getByTestId('other-input-container')).toBeTruthy();
    });

    it('does not show input field when "other" is not selected', () => {
      mockFormData = { dietTypes: ['vegetarian'] };
      render(<DietStep {...defaultProps} />);

      expect(screen.queryByTestId('other-input-container')).toBeNull();
    });
  });

  // ============================================================
  // COMPLETION TESTS
  // ============================================================

  describe('completion', () => {
    it('calls onComplete with form data when valid', () => {
      mockFormData = { dietTypes: ['vegetarian'], name: 'Test' };
      render(<DietStep {...defaultProps} />);

      const completeButton = screen.getByTestId('next-button');
      fireEvent.press(completeButton);

      expect(mockOnComplete).toHaveBeenCalledWith(mockFormData);
    });

    it('does not call onComplete when no selection', () => {
      mockFormData = { dietTypes: [] };
      render(<DietStep {...defaultProps} />);

      const completeButton = screen.getByTestId('next-button');
      fireEvent.press(completeButton);

      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('shows loading state when submitting', () => {
      mockFormData = { dietTypes: ['vegetarian'] };
      render(<DietStep {...defaultProps} isSubmitting={true} />);

      expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  // ============================================================
  // NAVIGATION TESTS
  // ============================================================

  describe('navigation', () => {
    it('does not complete when no selection', () => {
      mockFormData = { dietTypes: [] };
      render(<DietStep {...defaultProps} />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('completes when selection made', () => {
      mockFormData = { dietTypes: ['vegetarian'] };
      render(<DietStep {...defaultProps} />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it('goes to previous step', () => {
      render(<DietStep {...defaultProps} />);

      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockGoToPreviousStep).toHaveBeenCalled();
    });

    it('shows Complete button text (is last step)', () => {
      mockFormData = { dietTypes: ['vegetarian'] };
      render(<DietStep {...defaultProps} />);

      expect(screen.getByText('Complete')).toBeTruthy();
    });
  });
});
