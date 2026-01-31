/**
 * ErrorMessage Tests
 *
 * Tests for error message component covering:
 * - Message display
 * - Styling
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ErrorMessage } from '../ErrorMessage';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/constants/design-tokens', () => ({
  COLORS: {
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

jest.mock('../Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

describe('ErrorMessage', () => {
  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(
        <ErrorMessage message="An error occurred" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('displays error message text', () => {
      render(<ErrorMessage message="Something went wrong" />);

      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <ErrorMessage message="Error" className="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty message', () => {
      const { toJSON } = render(<ErrorMessage message="" />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles long error message', () => {
      const longMessage = 'Error: '.repeat(50);
      const { toJSON } = render(
        <ErrorMessage message={longMessage} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles message with special characters', () => {
      render(
        <ErrorMessage message="Error: File not found at /path/to/file" />
      );

      expect(screen.getByText('Error: File not found at /path/to/file')).toBeTruthy();
    });
  });
});
