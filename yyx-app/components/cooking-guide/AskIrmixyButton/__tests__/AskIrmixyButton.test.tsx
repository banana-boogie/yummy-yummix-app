import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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
    const { getByLabelText } = render(<AskIrmixyButton onPress={onPress} />);

    fireEvent.press(getByLabelText('Ask Irmixy'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
