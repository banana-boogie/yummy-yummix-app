import React from 'react';
import { render, screen } from '@/test/utils/render';
import { AddToShoppingListModal } from '../AddToShoppingListModal';
import { shoppingListService } from '@/services/shoppingListService';
import { createRecipeTransformer } from '@/utils/transformers/recipeTransformer';
import type { RawRecipe } from '@/types/recipe.api.types';
import { RecipeDifficulty } from '@/types/recipe.types';

describe('AddToShoppingListModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders duplicate canonical ingredients as separate recipe rows', async () => {
    jest.spyOn(shoppingListService, 'getShoppingLists').mockResolvedValue([]);
    const rawRecipe: RawRecipe = {
      id: 'recipe-1',
      difficulty: RecipeDifficulty.EASY,
      prep_time: 5,
      total_time: 10,
      portions: 2,
      is_published: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      translations: [{
        recipe_id: 'recipe-1',
        locale: 'en',
        name: 'Pasta',
        description: null,
        tips_and_tricks: null,
      }],
      ingredients: [
        {
          id: 'recipe-ingredient-row-1',
          quantity: 1,
          display_order: 1,
          optional: false,
          translations: [],
          ingredient: {
            id: 'ingredient-olive-oil',
            translations: [{
              ingredient_id: 'ingredient-olive-oil',
              locale: 'en',
              name: 'Olive oil',
              plural_name: null,
            }],
          },
          measurement_unit: {
            id: 'cup',
            type: 'volume',
            system: 'universal',
            translations: [{
              measurement_unit_id: 'cup',
              locale: 'en',
              name: 'cup',
              name_plural: 'cups',
              symbol: 'cup',
              symbol_plural: 'cups',
            }],
          },
        },
        {
          id: 'recipe-ingredient-row-2',
          quantity: 1,
          display_order: 2,
          optional: false,
          translations: [],
          ingredient: {
            id: 'ingredient-olive-oil',
            translations: [{
              ingredient_id: 'ingredient-olive-oil',
              locale: 'en',
              name: 'Olive oil',
              plural_name: null,
            }],
          },
          measurement_unit: {
            id: 'tbsp',
            type: 'volume',
            system: 'universal',
            translations: [{
              measurement_unit_id: 'tbsp',
              locale: 'en',
              name: 'tablespoon',
              name_plural: 'tablespoons',
              symbol: 'tbsp',
              symbol_plural: 'tbsp',
            }],
          },
        },
      ],
    };
    const recipe = createRecipeTransformer('metric').transformRecipe(rawRecipe);
    const ingredients = (recipe?.ingredients ?? []).map((ing) => ({
      key: ing.rowId,
      ingredientId: ing.id,
      name: ing.name,
      quantity: Number.parseFloat(ing.quantity) || 1,
      unitId: ing.measurementUnit.id,
      unitLabel: ing.formattedUnit,
    }));

    render(
      <AddToShoppingListModal
        visible
        onClose={jest.fn()}
        recipeName="Pasta"
        recipeId="recipe-1"
        ingredients={ingredients}
      />
    );

    expect(await screen.findAllByText('Olive oil')).toHaveLength(2);
  });
});
