/**
 * WelcomeStep Tests
 *
 * Tests for welcome step component covering:
 * - Title and subtitle display
 * - Start button functionality
 * - Navigation to next step
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { WelcomeStep } from '../steps/WelcomeStep';

// Mock OnboardingContext
const mockSetCurrentStep = jest.fn();
jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    setCurrentStep: mockSetCurrentStep,
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'onboarding.steps.welcome.title': 'Welcome to YummyYummix!',
        'onboarding.steps.welcome.subheading': 'Your personal cooking assistant',
        'onboarding.steps.welcome.start': "Let's Get Started",
      };
      return translations[key] || key;
    },
  },
}));

// Mock StepNavigationButtons
jest.mock('@/components/onboarding/StepNavigationButtons', () => ({
  StepNavigationButtons: ({ onNext, nextLabel }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID="next-button" onPress={onNext}>
        <Text>{nextLabel}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

describe('WelcomeStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('displays welcome title', () => {
      render(<WelcomeStep />);

      expect(screen.getByText('Welcome to YummyYummix!')).toBeTruthy();
    });

    it('displays welcome subtitle', () => {
      render(<WelcomeStep />);

      expect(screen.getByText('Your personal cooking assistant')).toBeTruthy();
    });

    it('displays start button', () => {
      render(<WelcomeStep />);

      expect(screen.getByText("Let's Get Started")).toBeTruthy();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interaction', () => {
    it('navigates to step 1 when start button is pressed', () => {
      render(<WelcomeStep />);

      const startButton = screen.getByTestId('next-button');
      fireEvent.press(startButton);

      expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('accepts custom className', () => {
      const { toJSON } = render(<WelcomeStep className="custom-class" />);

      expect(toJSON()).toBeTruthy();
    });

    it('accepts custom style', () => {
      const customStyle = { backgroundColor: 'red' };
      const { toJSON } = render(<WelcomeStep style={customStyle} />);

      expect(toJSON()).toBeTruthy();
    });
  });
});
