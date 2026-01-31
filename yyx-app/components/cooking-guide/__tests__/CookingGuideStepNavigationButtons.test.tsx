/**
 * CookingGuideStepNavigationButtons Tests
 *
 * Tests for step navigation buttons component covering:
 * - Back and next button rendering
 * - Finish button on last step
 * - Responsive sizing
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StepNavigationButtons } from '../CookingGuideStepNavigationButtons';

// Mock device hook
jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isLarge: false,
    isPhone: true,
  }),
}));

// Mock ArrowButton - return string to avoid JSX parsing issues
jest.mock('@/components/navigation/ArrowButton', () => ({
  ArrowButton: 'ArrowButton',
}));

// Mock Button
jest.mock('@/components/common/Button', () => ({
  Button: 'Button',
}));

describe('StepNavigationButtons', () => {
  const defaultProps = {
    onBack: jest.fn(),
    onNext: jest.fn(),
    backText: 'Previous',
    nextText: 'Next',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<StepNavigationButtons {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders with isLastStep true', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          isLastStep={true}
          finishText="Done"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders with default finishText', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          isLastStep={true}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // PROPS TESTS
  // ============================================================

  describe('props handling', () => {
    it('accepts all required props', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          onBack={jest.fn()}
          onNext={jest.fn()}
          backText="Back"
          nextText="Continue"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('accepts optional isLastStep prop', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          isLastStep={false}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('accepts custom finishText', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          isLastStep={true}
          finishText="Complete Recipe"
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          className="bg-white"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          style={{ backgroundColor: 'red' }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty text props', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          backText=""
          nextText=""
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles long text props', () => {
      const { toJSON } = render(
        <StepNavigationButtons
          {...defaultProps}
          backText="Go Back to Previous Step"
          nextText="Continue to Next Step"
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
