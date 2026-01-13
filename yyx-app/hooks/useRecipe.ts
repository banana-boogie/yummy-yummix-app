import { Recipe } from '@/types/recipe.types';
import { useRecipeQuery } from './useRecipeQuery';

type RecipeResult = {
  recipe: Recipe | null;
  loading: boolean;
  error: string | null;
};

/**
 * Hook to fetch a single recipe by ID
 * 
 * This is the backward-compatible wrapper that maintains the same API
 * but now uses TanStack Query internally for better caching and state management.
 */
export const useRecipe = (id: string): RecipeResult => {
  const { data, isLoading, error } = useRecipeQuery(id);

  return {
    recipe: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
  };
};