/**
 * NameStep Tests
 *
 * Tests for name step component covering:
 * - Name input display
 * - Validation (empty, min length, max length)
 * - Navigation (next/back)
 * - Form data updates
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NameStep } from '../steps/NameStep';

// Create stable references for mocks - must be prefixed with 'mock' for Jest
const mockUpdateFormData = jest.fn();
const mockSetCurrentStep = jest.fn();

// Test state that gets read dynamically - prefixed with 'mock' for Jest scope rules
let mockFormData: any = { name: '' };
let mockCurrentStep = 1;

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    get formData() {
      return mockFormData;
    },
    get currentStep() {
      return mockCurrentStep;
    },
    updateFormData: (updates: any) => {
      mockUpdateFormData(updates);
      mockFormData = { ...mockFormData, ...updates };
    },
    setCurrentStep: mockSetCurrentStep,
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'onboarding.steps.name.title': "What's your name?",
        'onboarding.steps.name.subtitle': "We'd love to know what to call you",
        'onboarding.steps.name.placeholder': 'Enter your name',
        'validation.required': 'This field is required',
        'validation.nameMinLength': 'Name must be at least 2 characters',
        'validation.nameMaxLength': 'Name must be less than 50 characters',
      };
      return translations[key] || key;
    },
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

// Mock TextInput
jest.mock('@/components/form/TextInput', () => ({
  TextInput: ({ value, onChangeText, placeholder, error, onSubmitEditing }: any) => {
    const { TextInput: RNTextInput, Text, View } = require('react-native');
    return (
      <View>
        <RNTextInput
          testID="name-input"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          onSubmitEditing={onSubmitEditing}
        />
        {error && <Text testID="error-message">{error}</Text>}
      </View>
    );
  },
}));

// Mock constants
jest.mock('@/constants/userProfile', () => ({
  USER_PROFILE_MAX_LENGTH: 50,
}));

describe('NameStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormData = { name: '' };
    mockCurrentStep = 1;
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('displays title', () => {
      render(<NameStep />);

      expect(screen.getByText("What's your name?")).toBeTruthy();
    });

    it('displays subtitle', () => {
      render(<NameStep />);

      expect(screen.getByText("We'd love to know what to call you")).toBeTruthy();
    });

    it('displays name input with placeholder', () => {
      render(<NameStep />);

      const input = screen.getByTestId('name-input');
      expect(input.props.placeholder).toBe('Enter your name');
    });

    it('displays current name value in input', () => {
      mockFormData = { name: 'John' };
      render(<NameStep />);

      const input = screen.getByTestId('name-input');
      expect(input.props.value).toBe('John');
    });
  });

  // ============================================================
  // INPUT HANDLING TESTS
  // ============================================================

  describe('input handling', () => {
    it('updates form data when name changes', () => {
      render(<NameStep />);

      const input = screen.getByTestId('name-input');
      fireEvent.changeText(input, 'Jane');

      expect(mockUpdateFormData).toHaveBeenCalledWith({ name: 'Jane' });
    });
  });

  // ============================================================
  // VALIDATION TESTS
  // ============================================================

  describe('validation', () => {
    it('does not navigate when name is empty on next', () => {
      mockFormData = { name: '' };
      render(<NameStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      // Should not navigate since validation fails
      expect(mockSetCurrentStep).not.toHaveBeenCalled();
    });

    it('does not navigate when name is too short', () => {
      mockFormData = { name: 'A' };
      render(<NameStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      // Should not navigate since validation fails
      expect(mockSetCurrentStep).not.toHaveBeenCalled();
    });

    it('navigates when name is valid', () => {
      mockFormData = { name: 'John Doe' };
      render(<NameStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockSetCurrentStep).toHaveBeenCalledWith(mockCurrentStep + 1);
    });
  });

  // ============================================================
  // NAVIGATION TESTS
  // ============================================================

  describe('navigation', () => {
    it('goes to next step when name is valid', () => {
      mockFormData = { name: 'John Doe' };
      render(<NameStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockSetCurrentStep).toHaveBeenCalledWith(mockCurrentStep + 1);
    });

    it('does not go to next step when validation fails', () => {
      mockFormData = { name: '' };
      render(<NameStep />);

      const nextButton = screen.getByTestId('next-button');
      fireEvent.press(nextButton);

      expect(mockSetCurrentStep).not.toHaveBeenCalled();
    });

    it('goes to previous step when back is pressed', () => {
      render(<NameStep />);

      const backButton = screen.getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockSetCurrentStep).toHaveBeenCalledWith(mockCurrentStep - 1);
    });
  });
});
