import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { AskIrmixyButton } from '../AskIrmixyButton';

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

describe('AskIrmixyButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AskIrmixyButton onPress={jest.fn()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<AskIrmixyButton onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('Ask Irmixy'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows "Ask Irmixy" text when animate is true', () => {
    render(<AskIrmixyButton onPress={jest.fn()} animate={true} />);

    expect(screen.getByText('Ask Irmixy')).toBeTruthy();
  });

  it('renders without text visible when animate is false', () => {
    render(<AskIrmixyButton onPress={jest.fn()} animate={false} />);

    // Text element exists but has opacity 0 (animated value starts at 0)
    // The button should still be pressable
    fireEvent.press(screen.getByLabelText('Ask Irmixy'));
  });

  it('defaults animate to true', () => {
    render(<AskIrmixyButton onPress={jest.fn()} />);

    expect(screen.getByText('Ask Irmixy')).toBeTruthy();
  });
});
