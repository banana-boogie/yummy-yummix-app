/**
 * RecipeCard Tests
 *
 * Tests for recipe card component covering:
 * - Recipe display (name, image, times, difficulty)
 * - Navigation on press
 * - Haptic feedback
 * - Missing data handling
 * - Featured vs normal variant
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RecipeCard } from '../RecipeCard';
import { recipeFactory } from '@/test/factories';
import * as Haptics from 'expo-haptics';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
}));

// Mock RecipeImage component
jest.mock('@/components/recipe/RecipeImage', () => ({
  RecipeImage: ({ pictureUrl }: any) => (
    <div testID="recipe-image" data-url={pictureUrl}>RecipeImage</div>
  ),
}));

// Mock RecipeInfo component
jest.mock('@/components/recipe-detail/RecipeInfo', () => ({
  RecipeInfo: ({ totalTime, prepTime, difficulty }: any) => (
    <div testID="recipe-info">
      {totalTime}min - {difficulty}
    </div>
  ),
}));

describe('RecipeCard', () => {
  const mockRecipe = recipeFactory.createListItem({
    name: 'Test Recipe',
    pictureUrl: 'https://example.com/image.jpg',
    totalTime: 30,
    prepTime: 10,
    difficulty: 'easy',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('displays recipe name', () => {
      render(<RecipeCard recipe={mockRecipe} />);

      expect(screen.getByText('Test Recipe')).toBeTruthy();
    });

    it('displays recipe image', () => {
      render(<RecipeCard recipe={mockRecipe} />);

      const image = screen.getByTestId('recipe-image');
      expect(image).toBeTruthy();
    });

    it('displays recipe info when times are provided', () => {
      render(<RecipeCard recipe={mockRecipe} />);

      expect(screen.getByTestId('recipe-info')).toBeTruthy();
    });

    it('does not display recipe info when times are missing', () => {
      const recipeWithoutTimes = recipeFactory.createListItem({
        name: 'No Times Recipe',
        totalTime: undefined,
        prepTime: undefined,
      });

      render(<RecipeCard recipe={recipeWithoutTimes} />);

      expect(screen.queryByTestId('recipe-info')).toBeNull();
    });

    it('does not render when recipe name is missing', () => {
      const recipeWithoutName = { ...mockRecipe, name: '' };

      const { toJSON } = render(<RecipeCard recipe={recipeWithoutName} />);

      // Component returns null when name is missing
      expect(toJSON()).toBeNull();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interaction', () => {
    it('navigates to recipe detail on press', async () => {
      render(<RecipeCard recipe={mockRecipe} />);

      const card = screen.getByText('Test Recipe').parent?.parent?.parent;
      fireEvent.press(card!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/(tabs)/recipes/${mockRecipe.id}`);
      });
    });

    it('triggers haptic feedback on press', async () => {
      render(<RecipeCard recipe={mockRecipe} />);

      const card = screen.getByText('Test Recipe').parent?.parent?.parent;
      fireEvent.press(card!);

      await waitFor(() => {
        expect(Haptics.selectionAsync).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // VARIANT TESTS
  // ============================================================

  describe('variants', () => {
    it('renders featured variant', () => {
      const { root } = render(<RecipeCard recipe={mockRecipe} featured={true} />);

      expect(root).toBeTruthy();
    });

    it('renders normal variant by default', () => {
      const { root } = render(<RecipeCard recipe={mockRecipe} />);

      expect(root).toBeTruthy();
    });
  });

  // ============================================================
  // ACCESSIBILITY TESTS
  // ============================================================

  describe('accessibility', () => {
    it('is pressable', async () => {
      render(<RecipeCard recipe={mockRecipe} />);

      // Find the Pressable by finding a child element and navigating up
      const recipeName = screen.getByText('Test Recipe');
      const pressable = recipeName.parent?.parent?.parent?.parent;

      expect(pressable).toBeTruthy();
      fireEvent.press(pressable!);

      // Use waitFor since the press handler is async
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/(tabs)/recipes/${mockRecipe.id}`);
      });
    });
  });
});
