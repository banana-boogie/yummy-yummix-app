import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { AskIrmixyButton } from '../AskIrmixyButton';

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
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

  it('does not show text label (avatar is self-explanatory)', () => {
    render(<AskIrmixyButton onPress={jest.fn()} />);

    expect(screen.queryByText('Irmixy')).toBeNull();
  });

  it('renders avatar image', () => {
    const { toJSON } = render(<AskIrmixyButton onPress={jest.fn()} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('Image');
  });
});
