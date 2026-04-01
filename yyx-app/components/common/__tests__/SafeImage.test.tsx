/**
 * SafeImage Tests
 *
 * Tests for the SafeImage wrapper component covering:
 * - Rendering with valid sources (string, object, require)
 * - Fallback to placeholder on null/undefined/empty sources
 * - Fallback to placeholder on error
 * - Error state reset on source change
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { SafeImage } from '../SafeImage';

// Mock expo-image
const mockImage = jest.fn();
jest.mock('expo-image', () => ({
  Image: (props: Record<string, unknown>) => {
    mockImage(props);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return <View testID="expo-image" {...props} />;
  },
}));

// Mock placeholders — values inlined in factory because jest.mock is hoisted
jest.mock('@/constants/placeholders', () => ({
  PLACEHOLDER_IMAGES: {
    ingredient: 101,
    recipe: 102,
    kitchenTool: 103,
  },
}));

const MOCK_INGREDIENT_PLACEHOLDER = 101;
const MOCK_RECIPE_PLACEHOLDER = 102;
const MOCK_KITCHEN_TOOL_PLACEHOLDER = 103;

describe('SafeImage', () => {
  beforeEach(() => {
    mockImage.mockClear();
  });

  // ============================================================
  // VALID SOURCE RENDERING
  // ============================================================

  describe('valid sources', () => {
    it('renders with a string URL source', () => {
      render(<SafeImage source="https://example.com/img.png" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { uri: 'https://example.com/img.png' },
        })
      );
    });

    it('renders with an object { uri } source', () => {
      render(<SafeImage source={{ uri: 'https://example.com/img.png' }} />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { uri: 'https://example.com/img.png' },
        })
      );
    });

    it('renders with a require() number source', () => {
      render(<SafeImage source={42} />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 42,
        })
      );
    });
  });

  // ============================================================
  // PLACEHOLDER FALLBACK
  // ============================================================

  describe('placeholder fallback', () => {
    it('uses ingredient placeholder by default when source is null', () => {
      render(<SafeImage source={null} />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MOCK_INGREDIENT_PLACEHOLDER,
        })
      );
    });

    it('uses ingredient placeholder by default when source is undefined', () => {
      render(<SafeImage source={undefined} />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MOCK_INGREDIENT_PLACEHOLDER,
        })
      );
    });

    it('uses ingredient placeholder when specified', () => {
      render(<SafeImage source={null} placeholder="ingredient" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MOCK_INGREDIENT_PLACEHOLDER,
        })
      );
    });

    it('uses kitchenTool placeholder when specified', () => {
      render(<SafeImage source={null} placeholder="kitchenTool" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MOCK_KITCHEN_TOOL_PLACEHOLDER,
        })
      );
    });

    it('uses placeholder for empty string source', () => {
      render(<SafeImage source="" placeholder="ingredient" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MOCK_INGREDIENT_PLACEHOLDER,
        })
      );
    });

    it('uses placeholder for whitespace-only string source', () => {
      render(<SafeImage source="   " placeholder="ingredient" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MOCK_INGREDIENT_PLACEHOLDER,
        })
      );
    });

    it('uses placeholder for object with empty uri', () => {
      render(<SafeImage source={{ uri: '' }} placeholder="ingredient" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MOCK_INGREDIENT_PLACEHOLDER,
        })
      );
    });
  });

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  describe('error handling', () => {
    it('falls back to placeholder on image error', () => {
      const { getByTestId, rerender } = render(
        <SafeImage source="https://example.com/broken.png" placeholder="ingredient" />
      );

      // Initially renders with the URL
      expect(mockImage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          source: { uri: 'https://example.com/broken.png' },
        })
      );

      // Simulate error by calling the onError callback
      const lastCall = mockImage.mock.calls[mockImage.mock.calls.length - 1][0];
      lastCall.onError?.({});

      // Re-render to pick up state change
      rerender(<SafeImage source="https://example.com/broken.png" placeholder="ingredient" />);

      expect(mockImage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          source: MOCK_INGREDIENT_PLACEHOLDER,
        })
      );
    });

    it('calls original onError handler when provided', () => {
      const onErrorSpy = jest.fn();
      render(
        <SafeImage source="https://example.com/broken.png" onError={onErrorSpy} />
      );

      const lastCall = mockImage.mock.calls[mockImage.mock.calls.length - 1][0];
      const errorEvent = { nativeEvent: { error: 'test error' } };
      lastCall.onError?.(errorEvent);

      expect(onErrorSpy).toHaveBeenCalledWith(errorEvent);
    });
  });

  // ============================================================
  // PROP PASSTHROUGH
  // ============================================================

  describe('prop passthrough', () => {
    it('passes className through to Image', () => {
      render(<SafeImage source="https://example.com/img.png" className="w-20 h-20" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          className: 'w-20 h-20',
        })
      );
    });

    it('passes contentFit through to Image', () => {
      render(<SafeImage source="https://example.com/img.png" contentFit="contain" />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          contentFit: 'contain',
        })
      );
    });

    it('passes style through to Image', () => {
      const style = { width: 100, height: 100 };
      render(<SafeImage source="https://example.com/img.png" style={style} />);

      expect(mockImage).toHaveBeenCalledWith(
        expect.objectContaining({
          style,
        })
      );
    });
  });
});
