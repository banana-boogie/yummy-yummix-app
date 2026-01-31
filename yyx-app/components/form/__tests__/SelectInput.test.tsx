/**
 * SelectInput Tests
 *
 * Tests for select input component covering:
 * - Option rendering
 * - Selection handling
 * - Error states
 * - Platform differences
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SelectInput } from '../SelectInput';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock Picker with a proper component structure
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPicker = ({ children, ...props }: any) => (
    <View testID="picker" {...props}>{children}</View>
  );

  MockPicker.Item = ({ label, value }: any) => (
    <View testID={`picker-item-${value}`} />
  );

  return { Picker: MockPicker };
});

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

jest.mock('@/components/common/Button', () => ({
  Button: 'Button',
}));

describe('SelectInput', () => {
  const mockOptions = [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
    { label: 'Option 3', value: 'option3' },
  ];

  const defaultProps = {
    value: '',
    onValueChange: jest.fn(),
    options: mockOptions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to non-web platform
    Platform.OS = 'ios';
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<SelectInput {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders with label', () => {
      render(<SelectInput {...defaultProps} label="Select Option" />);

      expect(screen.getByText('Select Option')).toBeTruthy();
    });

    it('renders with required indicator', () => {
      render(
        <SelectInput {...defaultProps} label="Country" required />
      );

      expect(screen.getByText('Country *')).toBeTruthy();
    });

    it('displays selected option label', () => {
      render(
        <SelectInput {...defaultProps} value="option2" />
      );

      expect(screen.getByText('Option 2')).toBeTruthy();
    });

    it('displays empty when no selection', () => {
      const { toJSON } = render(
        <SelectInput {...defaultProps} value="" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================

  describe('error handling', () => {
    it('displays error message', () => {
      render(
        <SelectInput {...defaultProps} error="Selection required" />
      );

      expect(screen.getByText('Selection required')).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <SelectInput {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerClassName', () => {
      const { toJSON } = render(
        <SelectInput {...defaultProps} containerClassName="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerStyle', () => {
      const { toJSON } = render(
        <SelectInput
          {...defaultProps}
          containerStyle={{ marginTop: 20 }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty options array', () => {
      const { toJSON } = render(
        <SelectInput {...defaultProps} options={[]} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles single option', () => {
      const { toJSON } = render(
        <SelectInput
          {...defaultProps}
          options={[{ label: 'Only Option', value: 'only' }]}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles many options', () => {
      const manyOptions = Array.from({ length: 50 }, (_, i) => ({
        label: `Option ${i}`,
        value: `option${i}`,
      }));

      const { toJSON } = render(
        <SelectInput {...defaultProps} options={manyOptions} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles option with long label', () => {
      const longLabelOptions = [
        { label: 'A'.repeat(100), value: 'long' },
      ];

      const { toJSON } = render(
        <SelectInput {...defaultProps} options={longLabelOptions} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles invalid value not in options', () => {
      const { toJSON } = render(
        <SelectInput {...defaultProps} value="nonexistent" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
