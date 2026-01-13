import { RecipeIngredient, RecipeStepIngredient } from '@/types/recipe.types';

type IngredientWithName = Pick<RecipeIngredient | RecipeStepIngredient, 'name' | 'pluralName' | 'quantity'>;

/**
 * Returns the name of the ingredient, either singular or plural depending on the quantity
 * Works with both RecipeIngredient and RecipeStepIngredient types
 * @param ingredient 
 * @returns 
 */
export const getIngredientName = (ingredient: IngredientWithName): string => {
   if (!ingredient) {
      return '';
   }

   const qty = typeof ingredient.quantity === 'string' ? parseFloat(ingredient.quantity) : ingredient.quantity;
   // Return singular for qty===1, otherwise plural if available
   if (qty === 1) {
      return ingredient.name;
   }
   // Check for non-empty pluralName (avoid treating empty string as falsy with ||)
   return ingredient.pluralName && ingredient.pluralName.trim() !== ''
      ? ingredient.pluralName
      : ingredient.name;
};
