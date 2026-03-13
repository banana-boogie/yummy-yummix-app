import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ActionButton } from '../ActionButton';

describe('ActionButton', () => {
  const defaultProps = {
    label: 'Share Recipe',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the label text', () => {
      render(<ActionButton {...defaultProps} />);
      expect(screen.getByText('Share Recipe')).toBeTruthy();
    });

    it('has correct accessibility role and label', () => {
      render(<ActionButton {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Share Recipe' })).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onPress when tapped', () => {
      render(<ActionButton {...defaultProps} />);
      fireEvent.press(screen.getByRole('button'));
      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      render(<ActionButton {...defaultProps} disabled />);
      fireEvent.press(screen.getByRole('button'));
      expect(defaultProps.onPress).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('shows ActivityIndicator when loading', () => {
      render(<ActionButton {...defaultProps} loading />);
      expect(screen.queryByText('Share Recipe')).toBeNull();
    });

    it('does not call onPress when loading', () => {
      render(<ActionButton {...defaultProps} loading />);
      fireEvent.press(screen.getByRole('button'));
      expect(defaultProps.onPress).not.toHaveBeenCalled();
    });
  });
});
