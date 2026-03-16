import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Recipe } from '@/types/recipe.types';
import { useRecipesInfiniteQuery, flattenRecipePages } from './useRecipeQuery';
import { useDebounce } from './useDebounce';
import { semanticRecipeSearch } from '@/services/recipeService';
import { useLanguage } from '@/contexts/LanguageContext';

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

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Hook to fetch paginated recipes
 *
 * This is the backward-compatible wrapper that maintains the same API
 * but now uses TanStack Query's useInfiniteQuery internally.
 * When primary results are < 3 and query is > 3 chars, fires semantic
 * search as a fallback after a 500ms debounce.
 */
export const useRecipes = (initialFilters: RecipeFilters = { isPublished: true }): RecipesResult => {
  const [filters, setFilters] = useState<RecipeFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchInput.trim(), 300);
  const { language } = useLanguage();

  // Semantic search fallback state
  const [semanticResults, setSemanticResults] = useState<Recipe[]>([]);
  const semanticDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    searchTerm: debouncedSearchTerm || null,
  });

  // Flatten all pages and apply instant local filtering while debounced search catches up.
  const primaryRecipes = useMemo(() => {
    const flattened = flattenRecipePages(data);
    const term = searchInput.trim();
    if (!term) return flattened;

    const searchTerms = normalize(term).split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) return flattened;

    return flattened.filter((recipe) => {
      const normalizedName = normalize(recipe.name || '');
      const normalizedIngredients = (recipe.ingredients || [])
        .map(ing => normalize(ing.name || '')).join(' ');
      const normalizedTags = (recipe.tags || [])
        .map(tag => normalize(tag.name || '')).join(' ');
      const searchableText = `${normalizedName} ${normalizedIngredients} ${normalizedTags}`;
      return searchTerms.every((token) => searchableText.includes(token));
    });
  }, [data, searchInput]);

  // Fire semantic search fallback when primary results < 3 and query > 3 chars
  useEffect(() => {
    // Clear previous debounce
    if (semanticDebounceRef.current) {
      clearTimeout(semanticDebounceRef.current);
      semanticDebounceRef.current = null;
    }

    const term = debouncedSearchTerm;
    if (!term || term.length <= 3 || primaryRecipes.length >= 3 || isLoading) {
      setSemanticResults([]);
      return;
    }

    semanticDebounceRef.current = setTimeout(async () => {
      try {
        const results = await semanticRecipeSearch(term, language, 10);
        // Convert semantic results to Recipe-like objects for merging
        const asRecipes: Recipe[] = results.map((r) => ({
          id: r.recipeId,
          name: r.name,
          pictureUrl: r.imageUrl,
          totalTime: r.totalTime,
          difficulty: r.difficulty as Recipe['difficulty'],
          portions: r.portions,
          ingredients: [],
          tags: [],
          steps: [],
        }));
        setSemanticResults(asRecipes);
      } catch {
        setSemanticResults([]);
      }
    }, 500);

    return () => {
      if (semanticDebounceRef.current) {
        clearTimeout(semanticDebounceRef.current);
      }
    };
  }, [debouncedSearchTerm, primaryRecipes.length, isLoading, language]);

  // Merge primary + semantic, deduplicating by ID
  const recipes = useMemo(() => {
    if (semanticResults.length === 0) return primaryRecipes;
    const existingIds = new Set(primaryRecipes.map(r => r.id));
    const newFromSemantic = semanticResults.filter(r => !existingIds.has(r.id));
    return [...primaryRecipes, ...newFromSemantic];
  }, [primaryRecipes, semanticResults]);

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
    setSearchInput(term || '');
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
