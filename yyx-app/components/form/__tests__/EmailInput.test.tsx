/**
 * EmailInput Tests
 *
 * Tests for email input component covering:
 * - Email validation
 * - Error display
 * - Validation callback
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { EmailInput, isValidEmail } from '../EmailInput';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  FontAwesome: 'FontAwesome',
  Feather: 'Feather',
  Ionicons: 'Ionicons',
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.errors.invalidEmail': 'Please enter a valid email address',
      };
      return translations[key] || key;
    },
  },
}));

jest.mock('@/constants/design-tokens', () => ({
  COLORS: {
    text: {
      secondary: '#828181',
    },
    status: {
      error: '#D83A3A',
    },
  },
}));

jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isPhone: true,
    isMedium: false,
    isLarge: false,
  }),
}));

jest.mock('@/components/common/Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

describe('EmailInput', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // EMAIL VALIDATION UTILITY TESTS
  // ============================================================

  describe('isValidEmail', () => {
    it('returns true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@email.co.uk')).toBe(true);
    });

    it('returns false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('user name@domain.com')).toBe(false);
    });
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<EmailInput {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders with default placeholder', () => {
      render(<EmailInput {...defaultProps} />);

      expect(screen.getByPlaceholderText('email@example.com')).toBeTruthy();
    });

    it('renders with custom placeholder', () => {
      render(
        <EmailInput {...defaultProps} placeholder="Your email" />
      );

      expect(screen.getByPlaceholderText('Your email')).toBeTruthy();
    });

    it('renders with label', () => {
      render(<EmailInput {...defaultProps} label="Email Address" />);

      expect(screen.getByText('Email Address')).toBeTruthy();
    });

    it('displays current value', () => {
      render(<EmailInput {...defaultProps} value="test@example.com" />);

      expect(screen.getByDisplayValue('test@example.com')).toBeTruthy();
    });
  });

  // ============================================================
  // INPUT HANDLING TESTS
  // ============================================================

  describe('input handling', () => {
    it('calls onChangeText when text changes', () => {
      const mockOnChange = jest.fn();
      render(<EmailInput {...defaultProps} onChangeText={mockOnChange} />);

      const input = screen.getByPlaceholderText('email@example.com');
      fireEvent.changeText(input, 'user@test.com');

      expect(mockOnChange).toHaveBeenCalledWith('user@test.com');
    });
  });

  // ============================================================
  // VALIDATION CALLBACK TESTS
  // ============================================================

  describe('validation callback', () => {
    it('calls onValidation with true for valid email', async () => {
      const mockOnValidation = jest.fn();
      render(
        <EmailInput
          {...defaultProps}
          value="test@example.com"
          onValidation={mockOnValidation}
        />
      );

      await waitFor(() => {
        expect(mockOnValidation).toHaveBeenCalledWith(true);
      });
    });

    it('calls onValidation with false for invalid email', async () => {
      const mockOnValidation = jest.fn();
      render(
        <EmailInput
          {...defaultProps}
          value="invalid-email"
          onValidation={mockOnValidation}
        />
      );

      await waitFor(() => {
        expect(mockOnValidation).toHaveBeenCalledWith(false);
      });
    });

    it('calls onValidation with false for short input', async () => {
      const mockOnValidation = jest.fn();
      render(
        <EmailInput
          {...defaultProps}
          value="ab"
          onValidation={mockOnValidation}
        />
      );

      await waitFor(() => {
        expect(mockOnValidation).toHaveBeenCalledWith(false);
      });
    });
  });

  // ============================================================
  // ERROR DISPLAY TESTS
  // ============================================================

  describe('error display', () => {
    it('displays external error when provided', () => {
      render(
        <EmailInput {...defaultProps} error="Email already in use" />
      );

      expect(screen.getByText('Email already in use')).toBeTruthy();
    });

    it('does not show error when showError is false', () => {
      render(
        <EmailInput
          {...defaultProps}
          error="Email already in use"
          showError={false}
        />
      );

      expect(screen.queryByText('Email already in use')).toBeNull();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <EmailInput {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerClassName', () => {
      const { toJSON } = render(
        <EmailInput {...defaultProps} containerClassName="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty value', () => {
      const { toJSON } = render(<EmailInput {...defaultProps} value="" />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles email with special characters', () => {
      const { toJSON } = render(
        <EmailInput {...defaultProps} value="user+tag@sub.domain.com" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
