/**
 * useRecipe Hook Tests
 *
 * Tests for single recipe fetching covering:
 * - Loading state
 * - Successful recipe fetching
 * - Error handling
 * - Invalid ID handling
 * - Recipe caching
 * - Language switching
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useRecipe } from '../useRecipe';
import { recipeFactory } from '@/test/factories';

// Mock the underlying useRecipeQuery hook
const mockUseRecipeQuery = jest.fn();
jest.mock('../useRecipeQuery', () => ({
  useRecipeQuery: (...args: any[]) => mockUseRecipeQuery(...args),
}));

describe('useRecipe', () => {
  const mockRecipe = recipeFactory.create();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation - loading state
    mockUseRecipeQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
  });

  // ============================================================
  // LOADING STATE TESTS
  // ============================================================

  describe('loading state', () => {
    it('starts with loading state', () => {
      const { result } = renderHook(() => useRecipe('recipe-id-123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.recipe).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('passes recipe ID to underlying query', () => {
      renderHook(() => useRecipe('recipe-id-456'));

      expect(mockUseRecipeQuery).toHaveBeenCalledWith('recipe-id-456');
    });
  });

  // ============================================================
  // SUCCESSFUL LOADING TESTS
  // ============================================================

  describe('successful loading', () => {
    it('returns recipe data when loaded', () => {
      mockUseRecipeQuery.mockReturnValue({
        data: mockRecipe,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useRecipe(mockRecipe.id));

      expect(result.current.loading).toBe(false);
      expect(result.current.recipe).toEqual(mockRecipe);
      expect(result.current.error).toBeNull();
    });

    it('handles null recipe data', () => {
      mockUseRecipeQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useRecipe('nonexistent-id'));

      expect(result.current.loading).toBe(false);
      expect(result.current.recipe).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('handles undefined recipe data', () => {
      mockUseRecipeQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useRecipe('some-id'));

      expect(result.current.loading).toBe(false);
      expect(result.current.recipe).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================

  describe('error handling', () => {
    it('handles loading errors', () => {
      const error = new Error('Failed to load recipe');

      mockUseRecipeQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error,
      });

      const { result } = renderHook(() => useRecipe('recipe-id-123'));

      expect(result.current.loading).toBe(false);
      expect(result.current.recipe).toBeNull();
      expect(result.current.error).toBe('Failed to load recipe');
    });

    it('handles network errors', () => {
      const error = new Error('Network request failed');

      mockUseRecipeQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error,
      });

      const { result } = renderHook(() => useRecipe('recipe-id-456'));

      expect(result.current.error).toBe('Network request failed');
    });

    it('handles non-Error error objects', () => {
      mockUseRecipeQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'String error', // Not an Error instance
      });

      const { result } = renderHook(() => useRecipe('recipe-id-789'));

      expect(result.current.error).toBeNull(); // Non-Error objects return null
    });
  });

  // ============================================================
  // RECIPE ID CHANGES
  // ============================================================

  describe('recipe ID changes', () => {
    it('refetches when recipe ID changes', () => {
      const { rerender } = renderHook(
        ({ id }) => useRecipe(id),
        { initialProps: { id: 'recipe-1' } }
      );

      expect(mockUseRecipeQuery).toHaveBeenCalledWith('recipe-1');

      rerender({ id: 'recipe-2' });

      expect(mockUseRecipeQuery).toHaveBeenCalledWith('recipe-2');
    });

    it('maintains loading state during ID change', () => {
      mockUseRecipeQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { result, rerender } = renderHook(
        ({ id }) => useRecipe(id),
        { initialProps: { id: 'recipe-1' } }
      );

      expect(result.current.loading).toBe(true);

      rerender({ id: 'recipe-2' });

      expect(result.current.loading).toBe(true);
    });
  });

  // ============================================================
  // CACHE BEHAVIOR
  // ============================================================

  describe('cache behavior', () => {
    it('uses cached data when available', () => {
      // First call - loading
      mockUseRecipeQuery.mockReturnValueOnce({
        data: null,
        isLoading: true,
        error: null,
      });

      const { result, rerender } = renderHook(() => useRecipe('cached-recipe-id'));

      expect(result.current.loading).toBe(true);

      // Second call - cached data available
      mockUseRecipeQuery.mockReturnValueOnce({
        data: mockRecipe,
        isLoading: false,
        error: null,
      });

      rerender();

      expect(result.current.loading).toBe(false);
      expect(result.current.recipe).toEqual(mockRecipe);
    });
  });
});
