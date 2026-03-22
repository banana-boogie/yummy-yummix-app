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

  it('shows "Irmixy" label', () => {
    render(<AskIrmixyButton onPress={jest.fn()} />);

    expect(screen.getByText('Irmixy')).toBeTruthy();
  });

  it('renders avatar image', () => {
    const { toJSON } = render(<AskIrmixyButton onPress={jest.fn()} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('Image');
  });
});
