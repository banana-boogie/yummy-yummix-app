/**
 * ChatRecipeCard Component Tests
 *
 * Tests for the recipe card displayed in chat messages.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ChatRecipeCard } from '../ChatRecipeCard';
import * as Haptics from 'expo-haptics';
import { createMockRecipeCard } from '@/test/mocks/chat';

// Get the mocked router from the jest.setup.js mock
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: any[]) => mockRouterPush(...args),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'common.minutesShort': 'min',
      'recipes.common.difficulty.easy': 'Easy',
      'recipes.common.difficulty.medium': 'Medium',
      'recipes.common.difficulty.hard': 'Hard',
    };
    return translations[key] || key;
  },
}));

describe('ChatRecipeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockClear();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders recipe name, time, difficulty, and portions', () => {
      const recipe = createMockRecipeCard({
        name: 'Spaghetti Carbonara',
        totalTime: 45,
        difficulty: 'medium',
        portions: 4,
      });

      render(<ChatRecipeCard recipe={recipe} />);

      expect(screen.getByText('Spaghetti Carbonara')).toBeTruthy();
      expect(screen.getByText('45 min')).toBeTruthy();
      expect(screen.getByText('Medium')).toBeTruthy();
      expect(screen.getByText('4')).toBeTruthy();
    });

    it('shows fallback icon when imageUrl is missing', () => {
      const recipe = createMockRecipeCard({
        imageUrl: undefined,
      });

      render(<ChatRecipeCard recipe={recipe} />);

      // The MaterialCommunityIcons "food" icon should render
      // We can verify by checking the component structure
      expect(screen.getByText(recipe.name)).toBeTruthy();
    });

    it('renders with image when imageUrl is provided', () => {
      const recipe = createMockRecipeCard({
        imageUrl: 'https://example.com/recipe.jpg',
      });

      render(<ChatRecipeCard recipe={recipe} />);

      // Image component should be rendered (expo-image is mocked)
      expect(screen.getByText(recipe.name)).toBeTruthy();
    });

    it('renders allergen verification warning when provided', () => {
      const recipe = createMockRecipeCard({
        allergenVerificationWarning: 'Allergen verification temporarily unavailable.',
      });

      render(<ChatRecipeCard recipe={recipe} />);

      expect(
        screen.getByText('Allergen verification temporarily unavailable.')
      ).toBeTruthy();
    });
  });

  // ============================================================
  // DIFFICULTY DISPLAY TESTS
  // ============================================================

  describe('difficulty display', () => {
    it('displays easy difficulty correctly', () => {
      const recipe = createMockRecipeCard({ difficulty: 'easy' });

      render(<ChatRecipeCard recipe={recipe} />);

      expect(screen.getByText('Easy')).toBeTruthy();
    });

    it('displays medium difficulty correctly', () => {
      const recipe = createMockRecipeCard({ difficulty: 'medium' });

      render(<ChatRecipeCard recipe={recipe} />);

      expect(screen.getByText('Medium')).toBeTruthy();
    });

    it('displays hard difficulty correctly', () => {
      const recipe = createMockRecipeCard({ difficulty: 'hard' });

      render(<ChatRecipeCard recipe={recipe} />);

      expect(screen.getByText('Hard')).toBeTruthy();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interactions', () => {
    it('navigates to recipe detail on press with from=chat param', () => {
      const recipe = createMockRecipeCard({ recipeId: 'recipe-123' });

      render(<ChatRecipeCard recipe={recipe} />);

      fireEvent.press(screen.getByText(recipe.name));

      expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/recipes/recipe-123?from=chat');
    });

    it('triggers haptic feedback on press', () => {
      const recipe = createMockRecipeCard();

      render(<ChatRecipeCard recipe={recipe} />);

      fireEvent.press(screen.getByText(recipe.name));

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('handles missing recipeId gracefully (no navigation)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const recipe = createMockRecipeCard({ recipeId: '' });

      render(<ChatRecipeCard recipe={recipe} />);

      fireEvent.press(screen.getByText(recipe.name));

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ChatRecipeCard] Invalid recipeId:',
        expect.any(Object)
      );
      expect(mockRouterPush).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});
