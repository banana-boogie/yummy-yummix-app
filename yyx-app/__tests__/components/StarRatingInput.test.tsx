import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StarRatingInput } from '@/components/rating/StarRatingInput';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn((initial) => ({ value: initial })),
  useAnimatedStyle: jest.fn((callback) => callback()),
  withSpring: jest.fn((value) => value),
}));

describe('StarRatingInput', () => {
  it('should render 5 stars', () => {
    const { getAllByLabelText } = render(
      <StarRatingInput rating={0} onRatingChange={jest.fn()} />
    );

    const stars = getAllByLabelText(/star/i);
    expect(stars).toHaveLength(5);
  });

  it('should display the current rating correctly', () => {
    const { getAllByLabelText } = render(
      <StarRatingInput rating={3} onRatingChange={jest.fn()} />
    );

    const filledStars = getAllByLabelText(/filled star/i);
    expect(filledStars).toHaveLength(3);
  });

  it('should call onRatingChange when a star is pressed', () => {
    const mockOnRatingChange = jest.fn();
    const { getAllByLabelText } = render(
      <StarRatingInput rating={0} onRatingChange={mockOnRatingChange} />
    );

    const stars = getAllByLabelText(/star/i);
    fireEvent.press(stars[3]); // Press 4th star (index 3)

    expect(mockOnRatingChange).toHaveBeenCalledWith(4);
  });

  it('should allow changing rating multiple times', () => {
    const mockOnRatingChange = jest.fn();
    const { getAllByLabelText, rerender } = render(
      <StarRatingInput rating={0} onRatingChange={mockOnRatingChange} />
    );

    let stars = getAllByLabelText(/star/i);
    fireEvent.press(stars[2]); // Press 3rd star

    expect(mockOnRatingChange).toHaveBeenCalledWith(3);

    // Rerender with new rating
    rerender(<StarRatingInput rating={3} onRatingChange={mockOnRatingChange} />);

    stars = getAllByLabelText(/star/i);
    fireEvent.press(stars[4]); // Press 5th star

    expect(mockOnRatingChange).toHaveBeenCalledWith(5);
  });

  it('should not call onRatingChange when disabled', () => {
    const mockOnRatingChange = jest.fn();
    const { getAllByLabelText } = render(
      <StarRatingInput rating={0} onRatingChange={mockOnRatingChange} disabled />
    );

    const stars = getAllByLabelText(/star/i);
    fireEvent.press(stars[2]);

    expect(mockOnRatingChange).not.toHaveBeenCalled();
  });

  it('should render with medium size by default', () => {
    const { getAllByLabelText } = render(
      <StarRatingInput rating={3} onRatingChange={jest.fn()} />
    );

    const stars = getAllByLabelText(/star/i);
    expect(stars[0].props.style).toMatchObject(
      expect.objectContaining({ fontSize: 28 })
    );
  });

  it('should render with large size when specified', () => {
    const { getAllByLabelText } = render(
      <StarRatingInput rating={3} onRatingChange={jest.fn()} size="lg" />
    );

    const stars = getAllByLabelText(/star/i);
    expect(stars[0].props.style).toMatchObject(
      expect.objectContaining({ fontSize: 40 })
    );
  });

  it('should have proper accessibility labels', () => {
    const { getAllByLabelText } = render(
      <StarRatingInput rating={0} onRatingChange={jest.fn()} />
    );

    // Check that stars have accessibility labels
    expect(getAllByLabelText(/star 1/i)).toBeTruthy();
    expect(getAllByLabelText(/star 2/i)).toBeTruthy();
    expect(getAllByLabelText(/star 3/i)).toBeTruthy();
    expect(getAllByLabelText(/star 4/i)).toBeTruthy();
    expect(getAllByLabelText(/star 5/i)).toBeTruthy();
  });

  it('should set rating to 5 when last star is pressed', () => {
    const mockOnRatingChange = jest.fn();
    const { getAllByLabelText } = render(
      <StarRatingInput rating={0} onRatingChange={mockOnRatingChange} />
    );

    const stars = getAllByLabelText(/star/i);
    fireEvent.press(stars[4]); // Press 5th star

    expect(mockOnRatingChange).toHaveBeenCalledWith(5);
  });

  it('should set rating to 1 when first star is pressed', () => {
    const mockOnRatingChange = jest.fn();
    const { getAllByLabelText } = render(
      <StarRatingInput rating={0} onRatingChange={mockOnRatingChange} />
    );

    const stars = getAllByLabelText(/star/i);
    fireEvent.press(stars[0]); // Press 1st star

    expect(mockOnRatingChange).toHaveBeenCalledWith(1);
  });
});
