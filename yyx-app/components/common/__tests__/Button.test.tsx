/**
 * Button Component Tests
 *
 * Tests for the reusable Button component.
 *
 * FOR AI AGENTS:
 * - This is an example of how to write component tests
 * - Follow this pattern for testing other components
 * - Use renderWithProviders for components that need context
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Button } from '../Button';
import { View, Text as RNText } from 'react-native';

// Mock the useDevice hook
jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isPhone: true,
    isTablet: false,
    isSmall: false,
    isMedium: true,
    isLarge: false,
  }),
}));

describe('Button', () => {
  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders with label text', () => {
      render(<Button onPress={jest.fn()} label="Click me" />);

      expect(screen.getByText('Click me')).toBeTruthy();
    });

    it('renders with children instead of label', () => {
      render(
        <Button onPress={jest.fn()}>
          <RNText>Child content</RNText>
        </Button>
      );

      expect(screen.getByText('Child content')).toBeTruthy();
    });

    it('renders with accessibility label', () => {
      render(
        <Button
          onPress={jest.fn()}
          label="Submit"
          accessibilityLabel="Submit form"
        />
      );

      expect(screen.getByLabelText('Submit form')).toBeTruthy();
    });

    it('uses label as accessibility label when not provided', () => {
      render(<Button onPress={jest.fn()} label="Save" />);

      expect(screen.getByLabelText('Save')).toBeTruthy();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interactions', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<Button onPress={onPress} label="Click me" />);

      fireEvent.press(screen.getByText('Click me'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(<Button onPress={onPress} label="Click me" disabled />);

      fireEvent.press(screen.getByText('Click me'));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('does not call onPress when loading', () => {
      const onPress = jest.fn();
      render(<Button onPress={onPress} label="Click me" loading />);

      // When loading, the button should still be pressable element but disabled
      const button = screen.getByRole('button');
      fireEvent.press(button);

      expect(onPress).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // VARIANT TESTS
  // ============================================================

  describe('variants', () => {
    it('renders primary variant by default', () => {
      const { getByRole } = render(<Button onPress={jest.fn()} label="Primary" />);

      const button = getByRole('button');
      // Primary variant should have specific styling
      expect(button).toBeTruthy();
    });

    it('renders secondary variant', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Secondary" variant="secondary" />
      );

      const button = getByRole('button');
      expect(button).toBeTruthy();
    });

    it('renders outline variant', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Outline" variant="outline" />
      );

      const button = getByRole('button');
      expect(button).toBeTruthy();
    });

    it('renders flat variant', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Flat" variant="flat" />
      );

      const button = getByRole('button');
      expect(button).toBeTruthy();
    });
  });

  // ============================================================
  // SIZE TESTS
  // ============================================================

  describe('sizes', () => {
    it('renders medium size by default', () => {
      const { getByRole } = render(<Button onPress={jest.fn()} label="Medium" />);

      expect(getByRole('button')).toBeTruthy();
    });

    it('renders small size', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Small" size="small" />
      );

      expect(getByRole('button')).toBeTruthy();
    });

    it('renders large size', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Large" size="large" />
      );

      expect(getByRole('button')).toBeTruthy();
    });
  });

  // ============================================================
  // STATE TESTS
  // ============================================================

  describe('states', () => {
    it('shows loading indicator when loading', () => {
      render(<Button onPress={jest.fn()} label="Loading" loading />);

      // The ActivityIndicator should be present
      // Note: The label text should NOT be visible when loading
      expect(screen.queryByText('Loading')).toBeNull();
    });

    it('has correct accessibility state when disabled', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Disabled" disabled />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true })
      );
    });

    it('has correct accessibility state when loading', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Loading" loading />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true, busy: true })
      );
    });
  });

  // ============================================================
  // ICON TESTS
  // ============================================================

  describe('icons', () => {
    it('renders with left icon as React element', () => {
      const icon = <View testID="left-icon" />;
      render(<Button onPress={jest.fn()} label="With Icon" icon={icon} />);

      expect(screen.getByTestId('left-icon')).toBeTruthy();
      expect(screen.getByText('With Icon')).toBeTruthy();
    });

    it('renders with right icon as React element', () => {
      const rightIcon = <View testID="right-icon" />;
      render(<Button onPress={jest.fn()} label="With Right Icon" rightIcon={rightIcon} />);

      expect(screen.getByTestId('right-icon')).toBeTruthy();
      expect(screen.getByText('With Right Icon')).toBeTruthy();
    });

    it('renders with both left and right icons', () => {
      const leftIcon = <View testID="left-icon" />;
      const rightIcon = <View testID="right-icon" />;
      render(
        <Button
          onPress={jest.fn()}
          label="Both Icons"
          icon={leftIcon}
          rightIcon={rightIcon}
        />
      );

      expect(screen.getByTestId('left-icon')).toBeTruthy();
      expect(screen.getByTestId('right-icon')).toBeTruthy();
      expect(screen.getByText('Both Icons')).toBeTruthy();
    });
  });

  // ============================================================
  // CUSTOM STYLING TESTS
  // ============================================================

  describe('custom styling', () => {
    it('accepts custom backgroundColor', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Custom BG" backgroundColor="#ff0000" />
      );

      const button = getByRole('button');
      expect(button.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#ff0000' }),
        ])
      );
    });

    it('renders with fullWidth prop', () => {
      const { getByRole } = render(
        <Button onPress={jest.fn()} label="Full Width" fullWidth />
      );

      const button = getByRole('button');
      expect(button).toBeTruthy();
    });
  });
});
