import { useQuery, useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { recipeService } from '@/services/recipeService';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createRecipeTransformer } from '@/utils/transformers/recipeTransformer';
import { Recipe } from '@/types/recipe.types';
import { isValidUUID } from '@/utils/validation';

// Query keys for recipes
export const recipeKeys = {
    all: ['recipes'] as const,
    lists: () => [...recipeKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...recipeKeys.lists(), filters] as const,
    details: () => [...recipeKeys.all, 'detail'] as const,
    detail: (id: string, language: string) => [...recipeKeys.details(), id, language] as const,
};

type RecipeFilters = {
    isPublished?: boolean;
    searchTerm?: string | null;
};

/**
 * Hook to fetch a single recipe by ID using TanStack Query
 * 
 * Features:
 * - Automatic caching per recipe ID and language
 * - Transformation with measurement system
 * - Loading and error states built-in
 */
export function useRecipeQuery(id: string) {
    const { measurementSystem } = useMeasurement();
    const { language } = useLanguage();

    return useQuery({
        queryKey: recipeKeys.detail(id, language),
        queryFn: async () => {
            if (!id || !isValidUUID(id)) {
                throw new Error(`Invalid recipe ID format: ${id}`);
            }

            const rawData = await recipeService.getRecipeById(id);
            if (!rawData) return null;

            const transformer = createRecipeTransformer(measurementSystem);
            return transformer.transformRecipe(rawData);
        },
        enabled: !!id && isValidUUID(id),
        staleTime: 10 * 60 * 1000, // 10 minutes - recipes don't change often
    });
}

/**
 * Hook to fetch paginated recipes using TanStack Query's infinite query
 * 
 * Features:
 * - Cursor-based pagination
 * - Automatic caching per filter combination
 * - Search support
 * - Transformation with measurement system
 */
export function useRecipesInfiniteQuery(filters: RecipeFilters = { isPublished: true }) {
    const { measurementSystem } = useMeasurement();
    const { language } = useLanguage();

    const transformer = createRecipeTransformer(measurementSystem);

    return useInfiniteQuery({
        queryKey: recipeKeys.list({ ...filters, language }),
        queryFn: async ({ pageParam }) => {
            const result = await recipeService.getRecipes({
                limit: 20,
                cursor: pageParam as any,
                filters: { isPublished: filters.isPublished ?? true },
                searchTerm: filters.searchTerm as any,
            });

            return {
                data: transformer.transformRecipes(result.data),
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
            };
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        initialPageParam: null as string | null,
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Utility to get all recipes from infinite query pages
 */
export function flattenRecipePages(data: { pages: Array<{ data: Recipe[] }> } | undefined): Recipe[] {
    if (!data) return [];
    return data.pages.flatMap(page => page.data);
}

/**
 * Prefetch a recipe for faster navigation
 */
export function usePrefetchRecipe() {
    const queryClient = useQueryClient();
    const { measurementSystem } = useMeasurement();
    const { language } = useLanguage();

    return (id: string) => {
        if (!id || !isValidUUID(id)) return;

        queryClient.prefetchQuery({
            queryKey: recipeKeys.detail(id, language),
            queryFn: async () => {
                const rawData = await recipeService.getRecipeById(id);
                if (!rawData) return null;

                const transformer = createRecipeTransformer(measurementSystem);
                return transformer.transformRecipe(rawData);
            },
            staleTime: 10 * 60 * 1000,
        });
    };
}
