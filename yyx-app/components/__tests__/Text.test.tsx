/**
 * Text Component Tests
 *
 * Tests for the Text component covering:
 * - Default rendering with body preset
 * - All preset variants
 * - Style overrides (color, fontSize, fontWeight)
 * - Layout props (align, marginBottom)
 * - Behavior props (onPress, numberOfLines)
 * - Italic styling
 * - NativeWind className handling
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from '@/components/common/Text';

// Mock useDevice hook
jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isPhone: true,
    isMedium: false,
    isLarge: false,
  }),
}));

describe('Text', () => {
  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders text content', () => {
      render(<Text>Hello World</Text>);
      expect(screen.getByText('Hello World')).toBeTruthy();
    });

    it('renders with default body preset when no preset specified', () => {
      const { toJSON } = render(<Text>Default text</Text>);
      expect(toJSON()).toBeTruthy();
    });

    it('renders children correctly', () => {
      render(<Text>Test content</Text>);
      expect(screen.getByText('Test content')).toBeTruthy();
    });
  });

  // ============================================================
  // PRESET TESTS
  // ============================================================

  describe('presets', () => {
    it('renders with h1 preset', () => {
      render(<Text preset="h1">Heading 1</Text>);
      expect(screen.getByText('Heading 1')).toBeTruthy();
    });

    it('renders with h2 preset', () => {
      render(<Text preset="h2">Heading 2</Text>);
      expect(screen.getByText('Heading 2')).toBeTruthy();
    });

    it('renders with h3 preset', () => {
      render(<Text preset="h3">Heading 3</Text>);
      expect(screen.getByText('Heading 3')).toBeTruthy();
    });

    it('renders with subheading preset', () => {
      render(<Text preset="subheading">Subheading</Text>);
      expect(screen.getByText('Subheading')).toBeTruthy();
    });

    it('renders with body preset', () => {
      render(<Text preset="body">Body text</Text>);
      expect(screen.getByText('Body text')).toBeTruthy();
    });

    it('renders with bodySmall preset', () => {
      render(<Text preset="bodySmall">Small body</Text>);
      expect(screen.getByText('Small body')).toBeTruthy();
    });

    it('renders with caption preset', () => {
      render(<Text preset="caption">Caption text</Text>);
      expect(screen.getByText('Caption text')).toBeTruthy();
    });

    it('renders with link preset', () => {
      render(<Text preset="link">Link text</Text>);
      expect(screen.getByText('Link text')).toBeTruthy();
    });

    it('renders with handwritten preset', () => {
      render(<Text preset="handwritten">Handwritten text</Text>);
      expect(screen.getByText('Handwritten text')).toBeTruthy();
    });
  });

  // ============================================================
  // STYLE OVERRIDE TESTS
  // ============================================================

  describe('style overrides', () => {
    it('applies custom color', () => {
      const { getByText } = render(<Text color="#ff0000">Red text</Text>);
      const text = getByText('Red text');
      expect(text.props.style).toEqual(
        expect.objectContaining({ color: '#ff0000' })
      );
    });

    it('applies custom fontSize', () => {
      const { getByText } = render(<Text fontSize={24}>Large text</Text>);
      const text = getByText('Large text');
      expect(text.props.style).toEqual(
        expect.objectContaining({ fontSize: 24 })
      );
    });

    it('applies italic style', () => {
      const { getByText } = render(<Text italic>Italic text</Text>);
      const text = getByText('Italic text');
      expect(text.props.style).toEqual(
        expect.objectContaining({ fontStyle: 'italic' })
      );
    });

    it('applies custom style prop', () => {
      const { getByText } = render(
        <Text style={{ letterSpacing: 2 }}>Spaced text</Text>
      );
      const text = getByText('Spaced text');
      expect(text.props.style).toEqual(
        expect.objectContaining({ letterSpacing: 2 })
      );
    });
  });

  // ============================================================
  // LAYOUT TESTS
  // ============================================================

  describe('layout', () => {
    it('applies left alignment', () => {
      const { getByText } = render(<Text align="left">Left aligned</Text>);
      const text = getByText('Left aligned');
      expect(text.props.style).toEqual(
        expect.objectContaining({ textAlign: 'left' })
      );
    });

    it('applies center alignment', () => {
      const { getByText } = render(<Text align="center">Centered</Text>);
      const text = getByText('Centered');
      expect(text.props.style).toEqual(
        expect.objectContaining({ textAlign: 'center' })
      );
    });

    it('applies right alignment', () => {
      const { getByText } = render(<Text align="right">Right aligned</Text>);
      const text = getByText('Right aligned');
      expect(text.props.style).toEqual(
        expect.objectContaining({ textAlign: 'right' })
      );
    });

    it('applies marginBottom', () => {
      const { getByText } = render(<Text marginBottom={16}>With margin</Text>);
      const text = getByText('With margin');
      expect(text.props.style).toEqual(
        expect.objectContaining({ marginBottom: 16 })
      );
    });
  });

  // ============================================================
  // BEHAVIOR TESTS
  // ============================================================

  describe('behavior', () => {
    it('handles onPress callback', () => {
      const mockOnPress = jest.fn();
      render(<Text onPress={mockOnPress}>Clickable</Text>);

      fireEvent.press(screen.getByText('Clickable'));

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('applies numberOfLines prop', () => {
      const { getByText } = render(
        <Text numberOfLines={2}>Truncated text that might be very long</Text>
      );
      const text = getByText('Truncated text that might be very long');
      expect(text.props.numberOfLines).toBe(2);
    });
  });

  // ============================================================
  // CLASSNAME TESTS
  // ============================================================

  describe('className handling', () => {
    it('passes className to underlying component', () => {
      const { getByText } = render(
        <Text className="text-lg font-bold">Styled text</Text>
      );
      const text = getByText('Styled text');
      expect(text.props.className).toBe('text-lg font-bold');
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty string children', () => {
      const { toJSON } = render(<Text>{''}</Text>);
      expect(toJSON()).toBeTruthy();
    });

    it('handles numeric children', () => {
      render(<Text>{42}</Text>);
      expect(screen.getByText('42')).toBeTruthy();
    });

    it('combines multiple style overrides', () => {
      const { getByText } = render(
        <Text
          color="#0000ff"
          fontSize={20}
          italic
          align="center"
          marginBottom={8}
        >
          Multi-styled
        </Text>
      );
      const text = getByText('Multi-styled');
      expect(text.props.style).toEqual(
        expect.objectContaining({
          color: '#0000ff',
          fontSize: 20,
          fontStyle: 'italic',
          textAlign: 'center',
          marginBottom: 8,
        })
      );
    });
  });
});
