/**
 * SuggestionChips Component Tests
 *
 * Tests for the horizontal scrollable suggestion chips in chat.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SuggestionChips } from '../SuggestionChips';
import { createMockSuggestionChipList, createMockSuggestionChip } from '@/test/mocks/chat';

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

    it('renders all suggestion labels', () => {
      const suggestions = [
        createMockSuggestionChip({ label: 'Quick pasta' }),
        createMockSuggestionChip({ label: 'Healthy salad' }),
        createMockSuggestionChip({ label: 'Dessert ideas' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      expect(screen.getByText('Quick pasta')).toBeTruthy();
      expect(screen.getByText('Healthy salad')).toBeTruthy();
      expect(screen.getByText('Dessert ideas')).toBeTruthy();
    });

    it('renders multiple suggestions correctly', () => {
      const suggestions = createMockSuggestionChipList(5);
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      suggestions.forEach((suggestion) => {
        expect(screen.getByText(suggestion.label)).toBeTruthy();
      });
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interactions', () => {
    it('calls onSelect with chip data when pressed', () => {
      const suggestions = [
        createMockSuggestionChip({ label: 'Make soup', message: 'How do I make soup?' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      fireEvent.press(screen.getByText('Make soup'));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(suggestions[0]);
    });

    it('calls onSelect with correct chip when multiple chips exist', () => {
      const suggestions = [
        createMockSuggestionChip({ label: 'First', message: 'first message' }),
        createMockSuggestionChip({ label: 'Second', message: 'second message' }),
        createMockSuggestionChip({ label: 'Third', message: 'third message' }),
      ];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      fireEvent.press(screen.getByText('Second'));

      expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
    });
  });

  // ============================================================
  // DISABLED STATE TESTS
  // ============================================================

  describe('disabled state', () => {
    it('disables all chips when disabled prop is true', () => {
      const suggestions = createMockSuggestionChipList(3);
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} disabled />);

      // Try pressing each chip
      suggestions.forEach((suggestion) => {
        fireEvent.press(screen.getByText(suggestion.label));
      });

      // onSelect should not be called when disabled
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('allows pressing when disabled is false', () => {
      const suggestions = [createMockSuggestionChip({ label: 'Enabled chip' })];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} disabled={false} />);

      fireEvent.press(screen.getByText('Enabled chip'));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('defaults to enabled when disabled prop is not provided', () => {
      const suggestions = [createMockSuggestionChip({ label: 'Default chip' })];
      const onSelect = jest.fn();

      render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />);

      fireEvent.press(screen.getByText('Default chip'));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });
});
