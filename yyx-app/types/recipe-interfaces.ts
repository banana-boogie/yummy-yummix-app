import { RecipeIngredient } from './recipe.types';

export interface RecipeImageProps {
  pictureUrl?: string;
}

export interface RecipeIngredientCardProps {
  ingredient: RecipeIngredient;
}

export interface RecipeTagsProps {
  tags: { id: string; name: string }[];
} 