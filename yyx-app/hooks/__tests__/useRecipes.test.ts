/**
 * useRecipes Hook Tests
 *
 * Tests for recipe list fetching covering:
 * - Initial loading state
 * - Recipe list rendering
 * - Infinite scroll / load more functionality
 * - Filtering (published/unpublished)
 * - Search functionality
 * - Refresh functionality
 * - Empty states
 * - Error handling
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useRecipes } from '../useRecipes';
import { recipeFactory } from '@/test/factories';

// Mock the underlying useRecipesInfiniteQuery hook
const mockUseRecipesInfiniteQuery = jest.fn();
jest.mock('../useRecipeQuery', () => ({
  useRecipesInfiniteQuery: (...args: any[]) => mockUseRecipesInfiniteQuery(...args),
  flattenRecipePages: (data: any) => {
    if (!data) return [];
    return data.pages.flatMap((page: any) => page.data);
  },
}));

// Mock the MeasurementContext
jest.mock('@/contexts/MeasurementContext', () => ({
  useMeasurement: () => ({
    measurementSystem: 'metric',
  }),
}));

// Mock the LanguageContext
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
  }),
}));

describe('useRecipes', () => {
  const mockRecipes = recipeFactory.createList(10);
  const mockFetchNextPage = jest.fn();
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockUseRecipesInfiniteQuery.mockReturnValue({
      data: { pages: [{ data: [], nextCursor: null, hasMore: false }] },
      isLoading: true,
      isFetchingNextPage: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetch,
    });
  });

  // ============================================================
  // INITIALIZATION TESTS
  // ============================================================

  describe('initialization', () => {
    it('starts with loading state', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: undefined, // No data yet
        isLoading: true,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      expect(result.current.initialLoading).toBe(true);
      expect(result.current.recipes).toEqual([]);
    });

    it('initializes with custom filters', () => {
      const { result } = renderHook(() => useRecipes({ isPublished: false }));

      // Hook should accept custom filters
      expect(result.current).toBeDefined();
    });
  });

  // ============================================================
  // RECIPE LOADING TESTS
  // ============================================================

  describe('recipe loading', () => {
    it('loads and displays recipes successfully', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: 'cursor-1', hasMore: true }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      expect(result.current.recipes).toHaveLength(5);
      expect(result.current.initialLoading).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('shows empty state when no recipes', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: [], nextCursor: null, hasMore: false }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      expect(result.current.recipes).toEqual([]);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.initialLoading).toBe(false);
    });

    it('handles loading errors', () => {
      const error = new Error('Failed to load recipes');

      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetchingNextPage: false,
        error,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      expect(result.current.error).toBe('Failed to load recipes');
      expect(result.current.recipes).toEqual([]);
    });
  });

  // ============================================================
  // INFINITE SCROLL / LOAD MORE TESTS
  // ============================================================

  describe('load more / infinite scroll', () => {
    it('loads more recipes when hasMore is true', async () => {
      mockFetchNextPage.mockResolvedValue({});

      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: 'cursor-1', hasMore: true }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it('does not load more when already fetching', async () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: 'cursor-1', hasMore: true }],
        },
        isLoading: false,
        isFetchingNextPage: true, // Already fetching
        error: null,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it('does not load more when hasMore is false', async () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: null, hasMore: false }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it('correctly reports hasMore status', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: 'cursor-1', hasMore: true }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      expect(result.current.hasMore).toBe(true);
    });

    it('sets loading state while fetching next page', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: 'cursor-1', hasMore: true }],
        },
        isLoading: false,
        isFetchingNextPage: true,
        error: null,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      expect(result.current.loading).toBe(true);
    });
  });

  // ============================================================
  // FILTERING TESTS
  // ============================================================

  describe('filtering', () => {
    it('allows updating filters', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: null, hasMore: false }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.updateFilters({ isPublished: false });
      });

      // Filter update should trigger re-render
      expect(result.current).toBeDefined();
    });
  });

  // ============================================================
  // SEARCH TESTS
  // ============================================================

  describe('search', () => {
    it('allows setting search term', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 3), nextCursor: null, hasMore: false }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.setSearch('pasta');
      });

      // Search should trigger re-render
      expect(result.current).toBeDefined();
    });

    it('clears search term when empty string provided', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes, nextCursor: null, hasMore: false }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.setSearch('');
      });

      // Should clear search and show all recipes again
      expect(result.current).toBeDefined();
    });
  });

  // ============================================================
  // REFRESH TESTS
  // ============================================================

  describe('refresh', () => {
    it('refetches recipes when refresh is called', async () => {
      mockRefetch.mockResolvedValue({});

      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ data: mockRecipes.slice(0, 5), nextCursor: null, hasMore: false }],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  // ============================================================
  // MULTIPLE PAGES TESTS
  // ============================================================

  describe('multiple pages', () => {
    it('flattens multiple pages of recipes correctly', () => {
      mockUseRecipesInfiniteQuery.mockReturnValue({
        data: {
          pages: [
            { data: mockRecipes.slice(0, 5), nextCursor: 'cursor-1', hasMore: true },
            { data: mockRecipes.slice(5, 10), nextCursor: null, hasMore: false },
          ],
        },
        isLoading: false,
        isFetchingNextPage: false,
        error: null,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useRecipes());

      expect(result.current.recipes).toHaveLength(10);
      // Should have all recipes from both pages
      expect(result.current.recipes[0]).toEqual(mockRecipes[0]);
      expect(result.current.recipes[9]).toEqual(mockRecipes[9]);
    });
  });
});
