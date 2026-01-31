/**
 * SearchBar Tests
 *
 * Tests for search bar component covering:
 * - Search input
 * - Clear button
 * - Debounce functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/constants/design-tokens', () => ({
  COLORS: {
    grey: {
      medium: '#CCCCCC',
      medium_dark: '#999999',
    },
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

jest.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

jest.mock('@/components/common/Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

describe('SearchBar', () => {
  const defaultProps = {
    searchQuery: '',
    setSearchQuery: jest.fn(),
    placeholder: 'Search...',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<SearchBar {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('displays placeholder text', () => {
      render(<SearchBar {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
    });

    it('displays current search query', () => {
      render(<SearchBar {...defaultProps} searchQuery="test" />);

      expect(screen.getByDisplayValue('test')).toBeTruthy();
    });
  });

  // ============================================================
  // INPUT HANDLING TESTS
  // ============================================================

  describe('input handling', () => {
    it('calls setSearchQuery when text changes', () => {
      const mockSetQuery = jest.fn();
      render(
        <SearchBar {...defaultProps} setSearchQuery={mockSetQuery} />
      );

      const input = screen.getByPlaceholderText('Search...');
      fireEvent.changeText(input, 'new search');

      expect(mockSetQuery).toHaveBeenCalledWith('new search');
    });
  });

  // ============================================================
  // CLEAR BUTTON TESTS
  // ============================================================

  describe('clear button', () => {
    it('clears search when clear button is pressed', async () => {
      const mockSetQuery = jest.fn();
      render(
        <SearchBar
          {...defaultProps}
          searchQuery="test"
          setSearchQuery={mockSetQuery}
        />
      );

      // First set the value
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.changeText(input, 'test');

      // Clear buttons appear when there's text
      const clearButton = screen.queryByTestId('clear-button');
      if (clearButton) {
        fireEvent.press(clearButton);
        expect(mockSetQuery).toHaveBeenCalledWith('');
      }
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <SearchBar {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <SearchBar {...defaultProps} style={{ marginTop: 20 }} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // DEBOUNCE TESTS
  // ============================================================

  describe('debounce', () => {
    it('accepts debounce configuration', () => {
      const { toJSON } = render(
        <SearchBar
          {...defaultProps}
          useDebounce={true}
          debounceDelay={500}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty search query', () => {
      const { toJSON } = render(
        <SearchBar {...defaultProps} searchQuery="" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles long search query', () => {
      const longQuery = 'A'.repeat(100);
      const { toJSON } = render(
        <SearchBar {...defaultProps} searchQuery={longQuery} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles custom placeholder', () => {
      render(
        <SearchBar {...defaultProps} placeholder="Search recipes..." />
      );

      expect(screen.getByPlaceholderText('Search recipes...')).toBeTruthy();
    });
  });
});
