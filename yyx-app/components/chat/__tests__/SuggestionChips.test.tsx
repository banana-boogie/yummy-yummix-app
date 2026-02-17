import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SuggestionChips } from '../SuggestionChips';

describe('SuggestionChips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when suggestions are empty', () => {
    const onSelect = jest.fn();
    const { toJSON } = render(<SuggestionChips suggestions={[]} onSelect={onSelect} />);

    expect(toJSON()).toBeNull();
  });

  it('renders label when present', () => {
    const suggestions = [
      { label: 'Quick dinner', message: 'Suggest a quick dinner idea' },
    ];

    render(<SuggestionChips suggestions={suggestions} onSelect={jest.fn()} />);

    expect(screen.getByText('Quick dinner')).toBeTruthy();
    expect(screen.queryByText('Suggest a quick dinner idea')).toBeNull();
  });

  it('falls back to message when label is missing', () => {
    const suggestions = [
      { message: 'Use what I have in my fridge' },
    ];

    render(<SuggestionChips suggestions={suggestions} onSelect={jest.fn()} />);

    expect(screen.getByText('Use what I have in my fridge')).toBeTruthy();
  });

  it('calls onSelect with full suggestion object', () => {
    const onSelect = jest.fn();
    const suggestion = { label: 'Soup', message: 'How do I make soup?' };

    render(<SuggestionChips suggestions={[suggestion]} onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Soup'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(suggestion);
  });

  it('uses single-line text for chips', () => {
    const suggestion = {
      label: 'A very long suggestion label that should still be single line',
      message: 'fallback',
    };

    render(<SuggestionChips suggestions={[suggestion]} onSelect={jest.fn()} />);

    expect(screen.getByText(suggestion.label).props.numberOfLines).toBe(1);
  });
});
