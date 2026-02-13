import React from 'react';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { StarRatingInput } from '@/components/rating/StarRatingInput';

jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'recipes.rating.rateStar': `${params?.count ?? ''} star`,
      'recipes.rating.rateStars': `${params?.count ?? ''} stars`,
    };
    return translations[key] || key;
  },
}));

describe('StarRatingInput', () => {
  const defaultProps = {
    value: 0,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 5 star buttons', () => {
    renderWithProviders(<StarRatingInput {...defaultProps} />);

    const starButtons = screen.getAllByRole('button');
    expect(starButtons).toHaveLength(5);
  });

  it('calls onChange with correct value when a star is pressed', async () => {
    renderWithProviders(<StarRatingInput {...defaultProps} />);

    const starButtons = screen.getAllByRole('button');
    fireEvent.press(starButtons[2]); // 3rd star

    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith(3);
    });
  });

  it('does not call onChange when disabled', () => {
    renderWithProviders(<StarRatingInput {...defaultProps} disabled />);

    const starButtons = screen.getAllByRole('button');
    fireEvent.press(starButtons[0]);

    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('has accessibility labels on each star', () => {
    renderWithProviders(<StarRatingInput {...defaultProps} />);

    expect(screen.getByLabelText('1 star')).toBeTruthy();
    expect(screen.getByLabelText('2 stars')).toBeTruthy();
    expect(screen.getByLabelText('3 stars')).toBeTruthy();
    expect(screen.getByLabelText('4 stars')).toBeTruthy();
    expect(screen.getByLabelText('5 stars')).toBeTruthy();
  });

  it('marks stars as selected based on value', () => {
    renderWithProviders(<StarRatingInput {...defaultProps} value={3} />);

    const starButtons = screen.getAllByRole('button');
    expect(starButtons[0].props.accessibilityState.selected).toBe(true);
    expect(starButtons[1].props.accessibilityState.selected).toBe(true);
    expect(starButtons[2].props.accessibilityState.selected).toBe(true);
    expect(starButtons[3].props.accessibilityState.selected).toBe(false);
    expect(starButtons[4].props.accessibilityState.selected).toBe(false);
  });
});
