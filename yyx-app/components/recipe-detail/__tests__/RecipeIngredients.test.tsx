/**
 * RecipeIngredients Tests
 *
 * Tests for recipe ingredients component covering:
 * - Ingredient list rendering
 * - Section grouping
 * - Empty state handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeIngredients, groupIngredientsBySection } from '../RecipeIngredients';
import { RecipeIngredient } from '@/types/recipe.types';

// Mock dependencies
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recipes.detail.ingredients.heading': 'Ingredients',
      };
      return translations[key] || key;
    },
  },
}));

jest.mock('@/components/recipe-detail/SectionHeading', () => ({
  SectionHeading: 'SectionHeading',
}));

jest.mock('@/components/recipe-detail/RecipeIngredientCard', () => ({
  RecipeIngredientCard: 'RecipeIngredientCard',
}));

jest.mock('@/utils/recipes', () => ({
  shouldDisplayRecipeSection: (section: string | undefined) => {
    return section && section !== 'main' && section !== 'default';
  },
}));

describe('RecipeIngredients', () => {
  const mockIngredients: RecipeIngredient[] = [
    {
      id: 'ing-1',
      nameEn: 'Flour',
      nameEs: 'Harina',
      formattedQuantity: '200',
      formattedUnit: 'g',
      quantity: 200,
    } as RecipeIngredient,
    {
      id: 'ing-2',
      nameEn: 'Sugar',
      nameEs: 'Azúcar',
      formattedQuantity: '100',
      formattedUnit: 'g',
      quantity: 100,
    } as RecipeIngredient,
  ];

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(
        <RecipeIngredients ingredients={mockIngredients} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders with empty ingredients array', () => {
      const { toJSON } = render(<RecipeIngredients ingredients={[]} />);

      // Should return null for empty ingredients
      expect(toJSON()).toBeNull();
    });

    it('renders null when ingredients is undefined', () => {
      const { toJSON } = render(
        <RecipeIngredients ingredients={undefined as unknown as RecipeIngredient[]} />
      );

      expect(toJSON()).toBeNull();
    });
  });

  // ============================================================
  // GROUPING TESTS
  // ============================================================

  describe('groupIngredientsBySection', () => {
    it('groups ingredients without sections into empty string key', () => {
      const ingredients: RecipeIngredient[] = [
        { id: '1', nameEn: 'Flour' } as RecipeIngredient,
        { id: '2', nameEn: 'Sugar' } as RecipeIngredient,
      ];

      const result = groupIngredientsBySection(ingredients);

      expect(result['']).toHaveLength(2);
    });

    it('groups ingredients by section', () => {
      const ingredients: RecipeIngredient[] = [
        { id: '1', nameEn: 'Flour', recipeSection: 'Dough' } as RecipeIngredient,
        { id: '2', nameEn: 'Sugar', recipeSection: 'Filling' } as RecipeIngredient,
        { id: '3', nameEn: 'Butter', recipeSection: 'Dough' } as RecipeIngredient,
      ];

      const result = groupIngredientsBySection(ingredients);

      expect(result['Dough']).toHaveLength(2);
      expect(result['Filling']).toHaveLength(1);
    });

    it('handles empty array', () => {
      const result = groupIngredientsBySection([]);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <RecipeIngredients
          ingredients={mockIngredients}
          className="mt-lg"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <RecipeIngredients
          ingredients={mockIngredients}
          style={{ marginTop: 20 }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles ingredients with missing properties', () => {
      const minimalIngredients: RecipeIngredient[] = [
        { id: 'ing-1' } as RecipeIngredient,
      ];

      const { toJSON } = render(
        <RecipeIngredients ingredients={minimalIngredients} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles single ingredient', () => {
      const { toJSON } = render(
        <RecipeIngredients ingredients={[mockIngredients[0]]} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles many ingredients', () => {
      const manyIngredients = Array.from({ length: 20 }, (_, i) => ({
        id: `ing-${i}`,
        nameEn: `Ingredient ${i}`,
        formattedQuantity: String(i * 10),
        formattedUnit: 'g',
        quantity: i * 10,
      })) as RecipeIngredient[];

      const { toJSON } = render(
        <RecipeIngredients ingredients={manyIngredients} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
