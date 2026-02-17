/**
 * useCustomRecipe Hook
 *
 * Loads a custom recipe from user_recipes and adapts it to the Recipe type.
 * Used by the custom recipe cooking guide routes.
 */

import { useQuery } from '@tanstack/react-query';
import { customRecipeService } from '@/services/customRecipeService';
import { adaptGeneratedRecipe } from '@/utils/recipes/recipeAdapter';
import type { Recipe } from '@/types/recipe.types';

// ============================================================
// Query Key Factory
// ============================================================

export const customRecipeKeys = {
    all: ['customRecipes'] as const,
    detail: (id: string) => [...customRecipeKeys.all, 'detail', id] as const,
    list: () => [...customRecipeKeys.all, 'list'] as const,
};

// ============================================================
// Result Type
// ============================================================

export interface CustomRecipeResult {
    recipe: Recipe | null;
    loading: boolean;
    error: string | null;
}

// ============================================================
// Query Hook
// ============================================================

/**
 * Load a custom recipe and adapt it for the cooking guide.
 *
 * @param userRecipeId - The ID from user_recipes table
 */
export function useCustomRecipeQuery(userRecipeId: string) {
    return useQuery({
        queryKey: customRecipeKeys.detail(userRecipeId),
        queryFn: async (): Promise<Recipe> => {
            const { id, name, recipe } = await customRecipeService.load(userRecipeId);
            return adaptGeneratedRecipe(recipe, id, name);
        },
        enabled: !!userRecipeId && userRecipeId.length > 0,
        staleTime: 0, // Always consider stale to ensure fresh data
        gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
        refetchOnMount: 'always', // Always refetch when component mounts
    });
}

// ============================================================
// Legacy Hook (for compatibility)
// ============================================================

/**
 * Load a custom recipe with backward-compatible return type.
 * Mirrors the useRecipe hook interface.
 */
export function useCustomRecipe(userRecipeId: string): CustomRecipeResult {
    const { data, isLoading, error } = useCustomRecipeQuery(userRecipeId);

    return {
        recipe: data ?? null,
        loading: isLoading,
        error: error instanceof Error ? error.message : null,
    };
}
