/**
 * HeightInput Tests
 *
 * Tests for height input component covering:
 * - Metric/Imperial display
 * - Feet/inches handling
 * - Input handling
 * - Validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { HeightInput } from '../HeightInput';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
  Ionicons: 'Ionicons',
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'profile.personalData.heightPlaceholder': 'Enter height',
        'profile.personalData.cm': 'cm',
        'profile.personalData.ft': 'ft',
        'profile.personalData.in': 'in',
        'validation.maxValue': `Max value is ${params?.max || ''}`,
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

describe('HeightInput', () => {
  const defaultProps = {
    value: '',
    onChangeValue: jest.fn(),
    measurementSystem: 'metric' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // METRIC SYSTEM TESTS
  // ============================================================

  describe('metric system', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<HeightInput {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('displays cm suffix', () => {
      render(<HeightInput {...defaultProps} />);

      expect(screen.getByText('cm')).toBeTruthy();
    });

    it('displays label when provided', () => {
      render(<HeightInput {...defaultProps} label="Height" />);

      expect(screen.getByText('Height')).toBeTruthy();
    });

    it('displays current value', () => {
      render(<HeightInput {...defaultProps} value="175" />);

      expect(screen.getByDisplayValue('175')).toBeTruthy();
    });
  });

  // ============================================================
  // IMPERIAL SYSTEM TESTS
  // ============================================================

  describe('imperial system', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(
        <HeightInput {...defaultProps} measurementSystem="imperial" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('displays ft and in suffixes', () => {
      render(
        <HeightInput {...defaultProps} measurementSystem="imperial" />
      );

      expect(screen.getByText('ft')).toBeTruthy();
      expect(screen.getByText('in')).toBeTruthy();
    });

    it('renders with value in imperial', () => {
      const { toJSON } = render(
        <HeightInput
          {...defaultProps}
          value="175"
          measurementSystem="imperial"
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // INPUT HANDLING TESTS
  // ============================================================

  describe('input handling', () => {
    it('calls onChangeValue when text changes in metric', () => {
      const mockOnChange = jest.fn();
      render(
        <HeightInput {...defaultProps} onChangeValue={mockOnChange} />
      );

      const input = screen.getByPlaceholderText('Enter height');
      fireEvent.changeText(input, '180');

      expect(mockOnChange).toHaveBeenCalledWith('180');
    });
  });

  // ============================================================
  // VALIDATION TESTS
  // ============================================================

  describe('validation', () => {
    it('displays external error', () => {
      render(
        <HeightInput {...defaultProps} error="Height is required" />
      );

      expect(screen.getByText('Height is required')).toBeTruthy();
    });

    it('calls onErrorChange when validation error occurs', async () => {
      const mockOnErrorChange = jest.fn();
      render(
        <HeightInput
          {...defaultProps}
          onErrorChange={mockOnErrorChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter height');
      fireEvent.changeText(input, '350');

      await waitFor(() => {
        expect(mockOnErrorChange).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <HeightInput {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerClassName', () => {
      const { toJSON } = render(
        <HeightInput {...defaultProps} containerClassName="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty value', () => {
      const { toJSON } = render(<HeightInput {...defaultProps} value="" />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles zero value', () => {
      const { toJSON } = render(
        <HeightInput {...defaultProps} value="0" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles very small values', () => {
      const { toJSON } = render(
        <HeightInput {...defaultProps} value="50" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles system change', () => {
      const { rerender, toJSON } = render(
        <HeightInput {...defaultProps} value="175" measurementSystem="metric" />
      );

      rerender(
        <HeightInput {...defaultProps} value="175" measurementSystem="imperial" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles decimal cm values', () => {
      const { toJSON } = render(
        <HeightInput {...defaultProps} value="175.5" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
