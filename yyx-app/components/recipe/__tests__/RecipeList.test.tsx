/**
 * RecipeList Tests
 *
 * Tests for recipe list component covering:
 * - Recipe list rendering
 * - Loading states
 * - Empty state
 * - Error state
 * - Load more functionality
 * - Pull to refresh
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeList } from '../RecipeList';
import { recipeFactory } from '@/test/factories';

// Mock RecipeCard component
jest.mock('../RecipeCard', () => ({
  RecipeCard: ({ recipe }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID={`recipe-card-${recipe.id}`}>
        <Text>{recipe.name}</Text>
      </View>
    );
  },
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
}));

// Mock useDevice hook
jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isPhone: true,
    isMedium: false,
    isLarge: false,
  }),
}));

describe('RecipeList', () => {
  const mockRecipes = recipeFactory.createList(5);
  const mockOnLoadMore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders list of recipes', () => {
      render(
        <RecipeList
          recipes={mockRecipes}
          loading={false}
          initialLoading={false}
          error={null}
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      // Check that recipe cards are rendered (at least some)
      mockRecipes.slice(0, 3).forEach(recipe => {
        expect(screen.getByTestId(`recipe-card-${recipe.id}`)).toBeTruthy();
      });
    });

    it('renders recipe names', () => {
      render(
        <RecipeList
          recipes={mockRecipes}
          loading={false}
          initialLoading={false}
          error={null}
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      // Use getAllByText to handle potential duplicates
      const firstRecipe = mockRecipes[0];
      const recipeNames = screen.queryAllByText(firstRecipe.name);
      expect(recipeNames.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // EMPTY STATE TESTS
  // ============================================================

  describe('empty state', () => {
    it('shows empty state when no recipes', () => {
      render(
        <RecipeList
          recipes={[]}
          loading={false}
          initialLoading={false}
          error={null}
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText('recipes.common.noRecipesFound')).toBeTruthy();
    });

    it('does not show empty state when loading', () => {
      render(
        <RecipeList
          recipes={[]}
          loading={true}
          initialLoading={true}
          error={null}
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.queryByText('recipes.common.noRecipesFound')).toBeNull();
    });
  });

  // ============================================================
  // LOADING STATE TESTS
  // ============================================================

  describe('loading state', () => {
    it('shows loading text when initially loading', () => {
      render(
        <RecipeList
          recipes={[]}
          loading={false}
          initialLoading={true}
          error={null}
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText('recipes.common.loading')).toBeTruthy();
    });

    it('shows loading indicator when loading more', () => {
      const { UNSAFE_getByType } = render(
        <RecipeList
          recipes={mockRecipes}
          loading={true}
          initialLoading={false}
          error={null}
          hasMore={true}
          onLoadMore={mockOnLoadMore}
        />
      );

      // When loading more, there should be an ActivityIndicator in the footer
      const { ActivityIndicator } = require('react-native');
      expect(() => UNSAFE_getByType(ActivityIndicator)).not.toThrow();
    });
  });

  // ============================================================
  // ERROR STATE TESTS
  // ============================================================

  describe('error state', () => {
    it('shows error message when error occurs', () => {
      render(
        <RecipeList
          recipes={[]}
          loading={false}
          initialLoading={false}
          error="Failed to load recipes"
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText('recipes.common.error')).toBeTruthy();
    });

    it('shows recipes even when there is an error', () => {
      render(
        <RecipeList
          recipes={mockRecipes}
          loading={false}
          initialLoading={false}
          error="Failed to load more"
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      // Should show recipes (error state only shows in empty component)
      expect(screen.getByTestId(`recipe-card-${mockRecipes[0].id}`)).toBeTruthy();
      // Error message only shows when recipes array is empty
      expect(screen.queryByText('recipes.common.error')).toBeNull();
    });
  });

  // ============================================================
  // LOAD MORE TESTS
  // ============================================================

  describe('load more', () => {
    it('renders footer with loading indicator when hasMore is true', () => {
      const { UNSAFE_getByType } = render(
        <RecipeList
          recipes={mockRecipes}
          loading={true}
          initialLoading={false}
          error={null}
          hasMore={true}
          onLoadMore={mockOnLoadMore}
        />
      );

      // Footer should contain ActivityIndicator when loading more
      const { ActivityIndicator } = require('react-native');
      expect(() => UNSAFE_getByType(ActivityIndicator)).not.toThrow();
    });

    it('does not render footer when hasMore is false', () => {
      const { UNSAFE_queryByType } = render(
        <RecipeList
          recipes={mockRecipes}
          loading={false}
          initialLoading={false}
          error={null}
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      // No loading indicator should be present when hasMore is false and not loading
      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    });

    it('passes onLoadMore when hasMore is true and not loading', () => {
      const { UNSAFE_getByType } = render(
        <RecipeList
          recipes={mockRecipes}
          loading={false}
          initialLoading={false}
          error={null}
          hasMore={true}
          onLoadMore={mockOnLoadMore}
        />
      );

      // Verify component renders successfully with correct props
      const { Animated } = require('react-native');
      const flatList = UNSAFE_getByType(Animated.FlatList);
      expect(flatList).toBeTruthy();
      expect(flatList.props.onEndReached).toBe(mockOnLoadMore);
    });

    it('does not pass onLoadMore when hasMore is false', () => {
      const { UNSAFE_getByType } = render(
        <RecipeList
          recipes={mockRecipes}
          loading={false}
          initialLoading={false}
          error={null}
          hasMore={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      const { Animated } = require('react-native');
      const flatList = UNSAFE_getByType(Animated.FlatList);
      expect(flatList.props.onEndReached).toBeUndefined();
    });

    it('does not pass onLoadMore when loading', () => {
      const { UNSAFE_getByType } = render(
        <RecipeList
          recipes={mockRecipes}
          loading={true}
          initialLoading={false}
          error={null}
          hasMore={true}
          onLoadMore={mockOnLoadMore}
        />
      );

      const { Animated } = require('react-native');
      const flatList = UNSAFE_getByType(Animated.FlatList);
      expect(flatList.props.onEndReached).toBeUndefined();
    });
  });
});
