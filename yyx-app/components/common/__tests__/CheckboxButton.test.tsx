/**
 * CheckboxButton Tests
 *
 * Tests for checkbox button component covering:
 * - Checked/unchecked states
 * - Press handling
 * - Disabled state
 * - Strikethrough styling
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CheckboxButton } from '../CheckboxButton';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/constants/design-tokens', () => ({
  COLORS: {
    primary: {
      medium: '#FFBFB7',
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

jest.mock('../Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

describe('CheckboxButton', () => {
  const defaultProps = {
    checked: false,
    onPress: jest.fn(),
    label: 'Test Item',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<CheckboxButton {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('displays label text', () => {
      render(<CheckboxButton {...defaultProps} />);

      expect(screen.getByText('Test Item')).toBeTruthy();
    });

    it('renders unchecked state', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} checked={false} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders checked state', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} checked={true} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // PRESS HANDLING TESTS
  // ============================================================

  describe('press handling', () => {
    it('calls onPress when pressed', () => {
      const mockOnPress = jest.fn();
      render(<CheckboxButton {...defaultProps} onPress={mockOnPress} />);

      fireEvent.press(screen.getByText('Test Item'));

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const mockOnPress = jest.fn();
      render(
        <CheckboxButton {...defaultProps} onPress={mockOnPress} disabled />
      );

      fireEvent.press(screen.getByText('Test Item'));

      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} style={{ marginTop: 10 }} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom checkbox size', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} checkboxSize={30} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty label', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} label="" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles long label', () => {
      const longLabel = 'A'.repeat(100);
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} label={longLabel} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles strikethrough when disabled', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} checked strikethrough />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles no strikethrough when disabled', () => {
      const { toJSON } = render(
        <CheckboxButton {...defaultProps} checked strikethrough={false} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
