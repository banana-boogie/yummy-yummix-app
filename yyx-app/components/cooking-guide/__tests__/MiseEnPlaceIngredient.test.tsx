/**
 * MiseEnPlaceIngredient Tests
 *
 * Tests for mise en place ingredient component covering:
 * - Ingredient display (name, quantity, unit)
 * - Checkbox state
 * - Width handling
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MiseEnPlaceIngredient } from '../MiseEnPlaceIngredient';
import { RecipeIngredient } from '@/types/recipe.types';

jest.mock('@/utils/recipes/ingredients', () => ({
  getIngredientName: (ingredient: any) => ingredient.nameEn || 'Unknown',
}));

type CheckableIngredient = RecipeIngredient & { checked: boolean };

describe('MiseEnPlaceIngredient', () => {
  const mockIngredient: CheckableIngredient = {
    id: 'ing-1',
    nameEn: 'Flour',
    nameEs: 'Harina',
    pictureUrl: 'https://example.com/flour.jpg',
    formattedQuantity: '200',
    formattedUnit: 'g',
    quantity: 200,
    checked: false,
  } as CheckableIngredient;

  const defaultProps = {
    ingredient: mockIngredient,
    onPress: jest.fn(),
    width: 100 as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders ingredient name', () => {
      render(<MiseEnPlaceIngredient {...defaultProps} />);

      expect(screen.getByText('Flour')).toBeTruthy();
    });

    it('renders quantity and unit', () => {
      render(<MiseEnPlaceIngredient {...defaultProps} />);

      expect(screen.getByText('200 g')).toBeTruthy();
    });

    it('renders without crashing with minimal props', () => {
      const minimalIngredient: CheckableIngredient = {
        id: 'ing-2',
        nameEn: 'Salt',
        formattedQuantity: '1',
        formattedUnit: 'pinch',
        quantity: 1,
        checked: false,
      } as CheckableIngredient;

      const { toJSON } = render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          ingredient={minimalIngredient}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // CHECKBOX STATE TESTS
  // ============================================================

  describe('checkbox state', () => {
    it('renders unchecked state', () => {
      const { toJSON } = render(<MiseEnPlaceIngredient {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('shows checkmark when checked', () => {
      const checkedIngredient = { ...mockIngredient, checked: true };
      render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          ingredient={checkedIngredient}
        />
      );

      expect(screen.getByText('✓')).toBeTruthy();
    });

    it('does not show checkmark when unchecked', () => {
      render(<MiseEnPlaceIngredient {...defaultProps} />);

      expect(screen.queryByText('✓')).toBeNull();
    });
  });

  // ============================================================
  // PRESS HANDLING TESTS
  // ============================================================

  describe('press handling', () => {
    it('calls onPress when pressed', () => {
      const mockOnPress = jest.fn();
      render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          onPress={mockOnPress}
        />
      );

      const ingredient = screen.getByText('Flour');
      fireEvent.press(ingredient);

      expect(mockOnPress).toHaveBeenCalled();
    });
  });

  // ============================================================
  // WIDTH PROP TESTS
  // ============================================================

  describe('width prop', () => {
    it('accepts number width', () => {
      const { toJSON } = render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          width={120}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('accepts percentage width', () => {
      const { toJSON } = render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          width="50%"
        />
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
        <MiseEnPlaceIngredient
          {...defaultProps}
          className="custom-class"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          style={{ marginTop: 10 }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty quantity', () => {
      const ingredientWithoutQuantity = {
        ...mockIngredient,
        formattedQuantity: '',
        formattedUnit: '',
      };

      render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          ingredient={ingredientWithoutQuantity}
        />
      );

      expect(screen.getByText('Flour')).toBeTruthy();
    });

    it('handles missing picture URL', () => {
      const ingredientWithoutPicture = {
        ...mockIngredient,
        pictureUrl: undefined,
      };

      const { toJSON } = render(
        <MiseEnPlaceIngredient
          {...defaultProps}
          ingredient={ingredientWithoutPicture}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
