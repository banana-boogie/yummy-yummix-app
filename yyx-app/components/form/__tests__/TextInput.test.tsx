/**
 * TextInput Tests
 *
 * Tests for text input component covering:
 * - Input rendering with label
 * - Error states
 * - Character counter
 * - Numeric validation
 * - Focus/blur states
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TextInput } from '../TextInput';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
  Ionicons: 'Ionicons',
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

describe('TextInput', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
    placeholder: 'Enter text',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<TextInput {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders with label', () => {
      render(<TextInput {...defaultProps} label="Username" />);

      expect(screen.getByText('Username')).toBeTruthy();
    });

    it('renders with required indicator', () => {
      render(<TextInput {...defaultProps} label="Email" required />);

      expect(screen.getByText('Email *')).toBeTruthy();
    });

    it('renders with placeholder', () => {
      render(<TextInput {...defaultProps} placeholder="Enter your name" />);

      expect(screen.getByPlaceholderText('Enter your name')).toBeTruthy();
    });

    it('displays current value', () => {
      render(<TextInput {...defaultProps} value="Hello" />);

      expect(screen.getByDisplayValue('Hello')).toBeTruthy();
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================

  describe('error handling', () => {
    it('displays error message', () => {
      render(<TextInput {...defaultProps} error="This field is required" />);

      expect(screen.getByText('This field is required')).toBeTruthy();
    });

    it('displays helper text', () => {
      render(<TextInput {...defaultProps} helperText="Max 50 characters" />);

      expect(screen.getByText('Max 50 characters')).toBeTruthy();
    });
  });

  // ============================================================
  // INPUT HANDLING TESTS
  // ============================================================

  describe('input handling', () => {
    it('calls onChangeText when text changes', () => {
      const mockOnChange = jest.fn();
      render(<TextInput {...defaultProps} onChangeText={mockOnChange} />);

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, 'Hello World');

      expect(mockOnChange).toHaveBeenCalledWith('Hello World');
    });

    it('filters non-numeric characters when numericOnly is true', () => {
      const mockOnChange = jest.fn();
      render(
        <TextInput
          {...defaultProps}
          onChangeText={mockOnChange}
          numericOnly
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, '123abc456');

      expect(mockOnChange).toHaveBeenCalledWith('123456');
    });

    it('allows decimals when allowDecimal is true', () => {
      const mockOnChange = jest.fn();
      render(
        <TextInput
          {...defaultProps}
          onChangeText={mockOnChange}
          numericOnly
          allowDecimal
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, '123.45');

      expect(mockOnChange).toHaveBeenCalledWith('123.45');
    });

    it('filters decimals when allowDecimal is false', () => {
      const mockOnChange = jest.fn();
      render(
        <TextInput
          {...defaultProps}
          onChangeText={mockOnChange}
          numericOnly
          allowDecimal={false}
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, '123.45');

      expect(mockOnChange).toHaveBeenCalledWith('12345');
    });
  });

  // ============================================================
  // CHARACTER COUNTER TESTS
  // ============================================================

  describe('character counter', () => {
    it('shows character count when showCounter is true', () => {
      render(
        <TextInput
          {...defaultProps}
          value="Hello"
          maxLength={100}
          showCounter
        />
      );

      expect(screen.getByText('5/100')).toBeTruthy();
    });

    it('updates character count as value changes', () => {
      const { rerender } = render(
        <TextInput
          {...defaultProps}
          value=""
          maxLength={50}
          showCounter
        />
      );

      expect(screen.getByText('0/50')).toBeTruthy();

      rerender(
        <TextInput
          {...defaultProps}
          value="Test"
          maxLength={50}
          showCounter
        />
      );

      expect(screen.getByText('4/50')).toBeTruthy();
    });
  });

  // ============================================================
  // SUFFIX TESTS
  // ============================================================

  describe('suffix', () => {
    it('displays suffix text', () => {
      render(<TextInput {...defaultProps} suffix="kg" />);

      expect(screen.getByText('kg')).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <TextInput {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerClassName', () => {
      const { toJSON } = render(
        <TextInput {...defaultProps} containerClassName="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <TextInput {...defaultProps} inputStyle={{ backgroundColor: 'red' }} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty value', () => {
      const { toJSON } = render(<TextInput {...defaultProps} value="" />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles very long text', () => {
      const longText = 'A'.repeat(500);
      const { toJSON } = render(
        <TextInput {...defaultProps} value={longText} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles multiple decimal points in numericOnly mode', () => {
      const mockOnChange = jest.fn();
      render(
        <TextInput
          {...defaultProps}
          onChangeText={mockOnChange}
          numericOnly
          allowDecimal
        />
      );

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, '1.2.3');

      // Should only allow one decimal point
      expect(mockOnChange).toHaveBeenCalledWith('1.23');
    });
  });
});
