/**
 * AllergiesStep Tests
 *
 * Tests for allergies step component covering:
 * - Allergy options display
 * - Single and multiple selection
 * - "None" option behavior
 * - "Other" option with custom input
 * - Navigation
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AllergiesStep } from '../steps/AllergiesStep';

if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'function') {
  // React test renderer reports uncaught errors through window.dispatchEvent.
  (window as any).dispatchEvent = jest.fn();
}

// Create stable references for mocks
const mockUpdateFormData = jest.fn();
const mockGoToNextStep = jest.fn();
const mockGoToPreviousStep = jest.fn();

// Test state that gets read dynamically
let mockFormData: any = { dietaryRestrictions: [] };

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    get formData() {
      return mockFormData;
    },
    updateFormData: (updates: any) => {
      mockUpdateFormData(updates);
      mockFormData = { ...mockFormData, ...updates };
    },
    goToNextStep: mockGoToNextStep,
    goToPreviousStep: mockGoToPreviousStep,
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'onboarding.steps.allergies.title': 'Any food allergies?',
        'onboarding.steps.allergies.subtitle': 'Select all that apply',
        'onboarding.steps.allergies.options.none': 'No allergies',
        'onboarding.steps.allergies.options.nuts': 'Nuts',
        'onboarding.steps.allergies.options.dairy': 'Dairy',
        'onboarding.steps.allergies.options.eggs': 'Eggs',
        'onboarding.steps.allergies.options.seafood': 'Seafood',
        'onboarding.steps.allergies.options.gluten': 'Gluten',
        'onboarding.steps.allergies.options.other': 'Other',
        'onboarding.steps.allergies.otherPlaceholder': 'Enter other allergy',
        'onboarding.common.addAnother': 'Add another',
        'validation.otherAllergyRequired': 'Please enter your other allergy',
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
        testID={`allergy-option-${label.toLowerCase().replace(/\s/g, '-')}`}
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
  getDietaryRestrictionIcon: () => null,
  DIETARY_RESTRICTION_ICONS: {
    none: null,
    other: null,
  },
}));

describe('AllergiesStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormData = { dietaryRestrictions: [] };
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('displays title', () => {
      render(<AllergiesStep />);
      expect(screen.getByText('Any food allergies?')).toBeTruthy();
    });

    it('displays subtitle', () => {
      render(<AllergiesStep />);
      expect(screen.getByText('Select all that apply')).toBeTruthy();
    });

    it('displays allergy options', () => {
      render(<AllergiesStep />);
      expect(screen.getByText('Gluten')).toBeTruthy();
      expect(screen.getByText('Dairy')).toBeTruthy();
      expect(screen.getByText('Nuts')).toBeTruthy();
      expect(screen.getByText('No allergies')).toBeTruthy();
    });
  });

  // ============================================================
  // SELECTION TESTS
  // ============================================================

  describe('selection', () => {
    it('selects an allergy option', () => {
      render(<AllergiesStep />);

      const glutenOption = screen.getByTestId('allergy-option-gluten');
      fireEvent.press(glutenOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietaryRestrictions: ['gluten'],
      });
    });

    it('allows multiple selections', () => {
      mockFormData = { dietaryRestrictions: ['gluten'] };
      render(<AllergiesStep />);

      const dairyOption = screen.getByTestId('allergy-option-dairy');
      fireEvent.press(dairyOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietaryRestrictions: ['gluten', 'dairy'],
      });
    });

    it('deselects an allergy option', () => {
      mockFormData = { dietaryRestrictions: ['gluten', 'dairy'] };
      render(<AllergiesStep />);

      const glutenOption = screen.getByTestId('allergy-option-gluten');
      fireEvent.press(glutenOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietaryRestrictions: ['dairy'],
      });
    });
  });

  // ============================================================
  // "NONE" OPTION TESTS
  // ============================================================

  describe('"none" option', () => {
    it('clears other selections when "none" is selected', () => {
      mockFormData = { dietaryRestrictions: ['gluten', 'dairy'] };
      render(<AllergiesStep />);

      const noneOption = screen.getByTestId('allergy-option-no-allergies');
      fireEvent.press(noneOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietaryRestrictions: ['none'],
        otherAllergy: [],
      });
    });

    it('removes "none" when selecting another option', () => {
      mockFormData = { dietaryRestrictions: ['none'] };
      render(<AllergiesStep />);

      const glutenOption = screen.getByTestId('allergy-option-gluten');
      fireEvent.press(glutenOption);

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        dietaryRestrictions: ['gluten'],
      });
    });
  });

  // ============================================================
  // "OTHER" OPTION TESTS
  // ============================================================

  describe('"other" option', () => {
    it('shows input field when "other" is selected', () => {
      mockFormData = { dietaryRestrictions: ['other'] };
      render(<AllergiesStep />);
      expect(screen.getByTestId('other-input-container')).toBeTruthy();
    });

    it('does not show input field when "other" is not selected', () => {
      mockFormData = { dietaryRestrictions: ['gluten'] };
      render(<AllergiesStep />);
      expect(screen.queryByTestId('other-input-container')).toBeNull();
    });
  });

  // ============================================================
  // NAVIGATION TESTS
  // ============================================================

  describe('navigation', () => {
    it('does not navigate when no selection', () => {
      mockFormData = { dietaryRestrictions: [] };
      render(<AllergiesStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockGoToNextStep).not.toHaveBeenCalled();
    });

    it('navigates when selection made', () => {
      mockFormData = { dietaryRestrictions: ['gluten'] };
      render(<AllergiesStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockGoToNextStep).toHaveBeenCalled();
    });

    it('goes to previous step', () => {
      render(<AllergiesStep />);

      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockGoToPreviousStep).toHaveBeenCalled();
    });
  });
});
