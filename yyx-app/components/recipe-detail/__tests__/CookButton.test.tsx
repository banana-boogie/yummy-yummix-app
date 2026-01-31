/**
 * CookButton Tests
 *
 * Tests for cook button component covering:
 * - Button rendering with translated text
 * - Navigation to cooking guide
 * - Haptic feedback
 * - Size variants
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { CookButton } from '../CookButton';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock haptics
const mockImpactAsync = jest.fn();
jest.mock('expo-haptics', () => ({
  impactAsync: (style: string) => mockImpactAsync(style),
  ImpactFeedbackStyle: {
    Medium: 'medium',
    Light: 'light',
    Heavy: 'heavy',
  },
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recipes.cookingGuide.start': 'Start Cooking',
      };
      return translations[key] || key;
    },
  },
}));

// Mock Button
jest.mock('@/components/common/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: (props: any) => (
      <Pressable
        onPress={props.onPress}
        testID="cook-button"
        accessibilityLabel={props.label}
      >
        <Text>{props.label}</Text>
      </Pressable>
    ),
  };
});

describe('CookButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders with translated label', () => {
      render(<CookButton recipeId="recipe-1" />);

      expect(screen.getByText('Start Cooking')).toBeTruthy();
    });

    it('renders the button', () => {
      render(<CookButton recipeId="recipe-1" />);

      expect(screen.getByTestId('cook-button')).toBeTruthy();
    });
  });

  // ============================================================
  // NAVIGATION TESTS
  // ============================================================

  describe('navigation', () => {
    it('navigates to cooking guide when pressed', async () => {
      render(<CookButton recipeId="recipe-123" />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/recipes/recipe-123/cooking-guide');
      });
    });

    it('includes recipe ID in navigation path', async () => {
      render(<CookButton recipeId="my-special-recipe" />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/(tabs)/recipes/my-special-recipe/cooking-guide');
      });
    });

    it('does not navigate when recipeId is undefined', async () => {
      render(<CookButton />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // HAPTIC FEEDBACK TESTS
  // ============================================================

  describe('haptic feedback', () => {
    it('triggers haptic feedback on press', async () => {
      render(<CookButton recipeId="recipe-1" />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockImpactAsync).toHaveBeenCalledWith('medium');
      });
    });

    it('triggers haptic even when recipeId is undefined', async () => {
      render(<CookButton />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockImpactAsync).toHaveBeenCalledWith('medium');
      });
    });
  });

  // ============================================================
  // SIZE VARIANTS TESTS
  // ============================================================

  describe('size variants', () => {
    it('defaults to medium size', () => {
      const { toJSON } = render(<CookButton recipeId="recipe-1" />);

      expect(toJSON()).toBeTruthy();
    });

    it('accepts large size', () => {
      const { toJSON } = render(
        <CookButton recipeId="recipe-1" size="large" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('accepts medium size explicitly', () => {
      const { toJSON } = render(
        <CookButton recipeId="recipe-1" size="medium" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <CookButton recipeId="recipe-1" className="w-full" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <CookButton
          recipeId="recipe-1"
          style={{ marginTop: 16 }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty string recipeId', async () => {
      render(<CookButton recipeId="" />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      // Empty string is falsy, so navigation shouldn't happen
      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it('handles recipe ID with special characters', async () => {
      render(<CookButton recipeId="recipe-with-dashes-123" />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/(tabs)/recipes/recipe-with-dashes-123/cooking-guide'
        );
      });
    });

    it('handles UUID-style recipe IDs', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      render(<CookButton recipeId={uuid} />);

      const button = screen.getByTestId('cook-button');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          `/(tabs)/recipes/${uuid}/cooking-guide`
        );
      });
    });
  });
});
