import { useState, useCallback, useMemo } from 'react';
import { Recipe } from '@/types/recipe.types';
import { useRecipesInfiniteQuery, flattenRecipePages } from './useRecipeQuery';

// Types to match existing API
type RecipeFilters = {
  isPublished: boolean;
};

type RecipesResult = {
  recipes: Recipe[];
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setSearch: (term: string) => void;
  updateFilters: (filters: Partial<RecipeFilters>) => void;
};

/**
 * Hook to fetch paginated recipes
 * 
 * This is the backward-compatible wrapper that maintains the same API
 * but now uses TanStack Query's useInfiniteQuery internally.
 */
export const useRecipes = (initialFilters: RecipeFilters = { isPublished: true }): RecipesResult => {
  const [filters, setFilters] = useState<RecipeFilters>(initialFilters);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useRecipesInfiniteQuery({
    isPublished: filters.isPublished,
    searchTerm,
  });

  // Flatten all pages into a single array
  const recipes = useMemo(() => flattenRecipePages(data), [data]);

  // Load more recipes (next page)
  const loadMore = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Refresh the list (refetch from beginning)
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Update search term
  const setSearch = useCallback((term: string) => {
    setSearchTerm(term ? term : null);
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<RecipeFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    recipes,
    loading: isFetchingNextPage,
    initialLoading: isLoading && !data,
    error: error instanceof Error ? error.message : null,
    hasMore: !!hasNextPage,
    loadMore,
    refresh,
    setSearch,
    updateFilters,
  };
};