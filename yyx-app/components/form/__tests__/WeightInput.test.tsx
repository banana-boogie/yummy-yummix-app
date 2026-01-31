/**
 * WeightInput Tests
 *
 * Tests for weight input component covering:
 * - Metric/Imperial display
 * - Unit suffix display
 * - Input handling
 * - Validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { WeightInput } from '../WeightInput';

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
        'profile.personalData.weightPlaceholder': 'Enter weight',
        'profile.personalData.kg': 'kg',
        'profile.personalData.lb': 'lb',
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

describe('WeightInput', () => {
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
      const { toJSON } = render(<WeightInput {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('displays kg suffix', () => {
      render(<WeightInput {...defaultProps} />);

      expect(screen.getByText('kg')).toBeTruthy();
    });

    it('displays label when provided', () => {
      render(<WeightInput {...defaultProps} label="Weight" />);

      expect(screen.getByText('Weight')).toBeTruthy();
    });

    it('renders with value', () => {
      const { toJSON } = render(<WeightInput {...defaultProps} value="70" />);

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // IMPERIAL SYSTEM TESTS
  // ============================================================

  describe('imperial system', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(
        <WeightInput {...defaultProps} measurementSystem="imperial" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('displays lb suffix', () => {
      render(
        <WeightInput {...defaultProps} measurementSystem="imperial" />
      );

      expect(screen.getByText('lb')).toBeTruthy();
    });

    it('renders with value in imperial', () => {
      const { toJSON } = render(
        <WeightInput
          {...defaultProps}
          value="70"
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
        <WeightInput {...defaultProps} onChangeValue={mockOnChange} />
      );

      const input = screen.getByPlaceholderText('Enter weight');
      fireEvent.changeText(input, '75');

      expect(mockOnChange).toHaveBeenCalledWith('75');
    });

    it('converts lb to kg when saving in imperial', () => {
      const mockOnChange = jest.fn();
      render(
        <WeightInput
          {...defaultProps}
          onChangeValue={mockOnChange}
          measurementSystem="imperial"
        />
      );

      const input = screen.getByPlaceholderText('Enter weight');
      fireEvent.changeText(input, '154');

      // Should convert 154 lb to kg (approximately 69.85 kg)
      expect(mockOnChange).toHaveBeenCalled();
      const calledValue = parseFloat(mockOnChange.mock.calls[0][0]);
      expect(calledValue).toBeCloseTo(69.85, 1);
    });
  });

  // ============================================================
  // VALIDATION TESTS
  // ============================================================

  describe('validation', () => {
    it('displays external error', () => {
      render(
        <WeightInput {...defaultProps} error="Weight is required" />
      );

      expect(screen.getByText('Weight is required')).toBeTruthy();
    });

    it('calls onErrorChange when validation error occurs', async () => {
      const mockOnErrorChange = jest.fn();
      render(
        <WeightInput
          {...defaultProps}
          onErrorChange={mockOnErrorChange}
        />
      );

      const input = screen.getByPlaceholderText('Enter weight');
      fireEvent.changeText(input, '600');

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
        <WeightInput {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerClassName', () => {
      const { toJSON } = render(
        <WeightInput {...defaultProps} containerClassName="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty value', () => {
      const { toJSON } = render(<WeightInput {...defaultProps} value="" />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles zero value', () => {
      const { toJSON } = render(
        <WeightInput {...defaultProps} value="0" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles very small values', () => {
      const { toJSON } = render(
        <WeightInput {...defaultProps} value="0.5" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles system change', () => {
      const { rerender, toJSON } = render(
        <WeightInput {...defaultProps} value="70" measurementSystem="metric" />
      );

      rerender(
        <WeightInput {...defaultProps} value="70" measurementSystem="imperial" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
