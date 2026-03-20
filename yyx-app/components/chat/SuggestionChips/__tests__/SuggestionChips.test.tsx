/**
 * SuggestionChips Component Tests
 *
 * Tests for the suggestion chips displayed after the last assistant message.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SuggestionChips } from '../SuggestionChips';
import type { Suggestion } from '@/types/irmixy';

describe('SuggestionChips', () => {
    const mockOnPress = jest.fn();

    beforeEach(() => {
        mockOnPress.mockClear();
    });

    it('renders nothing when suggestions array is empty', () => {
        const { toJSON } = render(
            <SuggestionChips suggestions={[]} onPress={mockOnPress} />,
        );
        expect(toJSON()).toBeNull();
    });

    it('renders default suggestion chips', () => {
        const suggestions: Suggestion[] = [
            { label: 'Tell me more', message: 'Tell me more about this recipe', type: 'default' },
            { label: 'Something else', message: 'Suggest something else' },
        ];

        render(<SuggestionChips suggestions={suggestions} onPress={mockOnPress} />);

        expect(screen.getByText('Tell me more')).toBeTruthy();
        expect(screen.getByText('Something else')).toBeTruthy();
    });

    it('renders recipe_generation chips with chef icon styling', () => {
        const suggestions: Suggestion[] = [
            { label: 'Create Tacos', message: 'Create a custom tacos recipe', type: 'recipe_generation' },
        ];

        render(<SuggestionChips suggestions={suggestions} onPress={mockOnPress} />);

        expect(screen.getByText('Create Tacos')).toBeTruthy();
    });

    it('calls onPress with the correct suggestion when tapped', () => {
        const suggestions: Suggestion[] = [
            { label: 'Option A', message: 'Message for A', type: 'default' },
            { label: 'Option B', message: 'Message for B', type: 'recipe_generation' },
        ];

        render(<SuggestionChips suggestions={suggestions} onPress={mockOnPress} />);

        fireEvent.press(screen.getByText('Option A'));
        expect(mockOnPress).toHaveBeenCalledWith(suggestions[0]);

        fireEvent.press(screen.getByText('Option B'));
        expect(mockOnPress).toHaveBeenCalledWith(suggestions[1]);
    });

    it('renders mixed suggestion types correctly', () => {
        const suggestions: Suggestion[] = [
            { label: 'Quick question', message: 'Ask a question', type: 'default' },
            { label: 'Make pasta', message: 'Create a custom pasta recipe', type: 'recipe_generation' },
            { label: 'Another option', message: 'Another message' },
        ];

        render(<SuggestionChips suggestions={suggestions} onPress={mockOnPress} />);

        expect(screen.getByText('Quick question')).toBeTruthy();
        expect(screen.getByText('Make pasta')).toBeTruthy();
        expect(screen.getByText('Another option')).toBeTruthy();
    });
});
