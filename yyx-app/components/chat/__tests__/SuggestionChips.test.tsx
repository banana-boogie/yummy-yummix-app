/**
 * SuggestionChips Component Tests
 *
 * Tests for the horizontal scrollable suggestion chips in chat.
 * Note: Chips now display the `message` field (what will be sent) instead of `label`.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SuggestionChips } from '../SuggestionChips';
import { createMockSuggestionChip } from '@/test/mocks/chat';

describe('SuggestionChips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('returns null when suggestions array is empty', () => {
      const onSelect = jest.fn();
      const { toJSON } = render(<SuggestionChips suggestions={[]} onSelect={onSelect} />);

      expect(toJSON()).toBeNull();
    });

    it('renders the message text (what will be sent)', () => {
      const suggestions = [
        createMockSuggestionChip({ label: 'Short label', message: 'Quick pasta recipe' }),
        createMockSuggestionChip({ label: 'Another label', message: 'Healthy salad ideas' }),
        createMockSuggestionChip({ label: 'Third label', message: 'Easy dessert options' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      // Should display the message, not the label
      expect(screen.getByText('Quick pasta recipe')).toBeTruthy();
      expect(screen.getByText('Healthy salad ideas')).toBeTruthy();
      expect(screen.getByText('Easy dessert options')).toBeTruthy();

      // Label should NOT be displayed
      expect(screen.queryByText('Short label')).toBeNull();
    });

    it('renders multiple suggestions correctly', () => {
      const suggestions = [
        createMockSuggestionChip({ message: 'Suggestion 1' }),
        createMockSuggestionChip({ message: 'Suggestion 2' }),
        createMockSuggestionChip({ message: 'Suggestion 3' }),
        createMockSuggestionChip({ message: 'Suggestion 4' }),
        createMockSuggestionChip({ message: 'Suggestion 5' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      suggestions.forEach((suggestion) => {
        expect(screen.getByText(suggestion.message)).toBeTruthy();
      });
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interactions', () => {
    it('calls onSelect with chip data when pressed', () => {
      const suggestions = [
        createMockSuggestionChip({ label: 'Soup', message: 'How do I make soup?' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      // Press the chip by finding the message text (what's displayed)
      fireEvent.press(screen.getByText('How do I make soup?'));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(suggestions[0]);
    });

    it('calls onSelect with correct chip when multiple chips exist', () => {
      const suggestions = [
        createMockSuggestionChip({ label: 'First', message: 'First message' }),
        createMockSuggestionChip({ label: 'Second', message: 'Second message' }),
        createMockSuggestionChip({ label: 'Third', message: 'Third message' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      // Press the second chip by its message text
      fireEvent.press(screen.getByText('Second message'));

      expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
    });
  });

  // ============================================================
  // DISABLED STATE TESTS
  // ============================================================

  describe('disabled state', () => {
    it('disables all chips when disabled prop is true', () => {
      const suggestions = [
        createMockSuggestionChip({ message: 'Chip 1' }),
        createMockSuggestionChip({ message: 'Chip 2' }),
        createMockSuggestionChip({ message: 'Chip 3' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} disabled />);

      // Try pressing each chip
      suggestions.forEach((suggestion) => {
        fireEvent.press(screen.getByText(suggestion.message));
      });

      // onSelect should not be called when disabled
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('allows pressing when disabled is false', () => {
      const suggestions = [createMockSuggestionChip({ message: 'Enabled chip' })];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} disabled={false} />);

      fireEvent.press(screen.getByText('Enabled chip'));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('defaults to enabled when disabled prop is not provided', () => {
      const suggestions = [createMockSuggestionChip({ message: 'Default chip' })];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      fireEvent.press(screen.getByText('Default chip'));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });
});
