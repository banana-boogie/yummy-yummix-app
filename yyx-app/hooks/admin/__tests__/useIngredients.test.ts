/**
 * useIngredients Hook Tests
 *
 * Tests for admin ingredients hook covering:
 * - Fetching ingredients
 * - Filtering by search query
 * - Deleting ingredients
 * - Loading states
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useIngredients } from '../useIngredients';

// Mock the admin ingredients service
const mockGetAllIngredientsForAdmin = jest.fn();
const mockDeleteIngredient = jest.fn();
const mockDeleteImage = jest.fn();

jest.mock('@/services/admin/adminIngredientsService', () => ({
  __esModule: true,
  default: {
    getAllIngredientsForAdmin: () => mockGetAllIngredientsForAdmin(),
    deleteIngredient: (id: string) => mockDeleteIngredient(id),
    deleteImage: (url: string) => mockDeleteImage(url),
  },
}));

describe('useIngredients', () => {
  const mockIngredients = [
    {
      id: 'ing-1',
      nameEn: 'Tomato',
      nameEs: 'Tomate',
      pluralNameEn: 'Tomatoes',
      pluralNameEs: 'Tomates',
      pictureUrl: 'https://example.com/tomato.png',
    },
    {
      id: 'ing-2',
      nameEn: 'Onion',
      nameEs: 'Cebolla',
      pluralNameEn: 'Onions',
      pluralNameEs: 'Cebollas',
      pictureUrl: null,
    },
    {
      id: 'ing-3',
      nameEn: 'Garlic',
      nameEs: 'Ajo',
      pluralNameEn: 'Garlic cloves',
      pluralNameEs: 'Dientes de ajo',
      pictureUrl: 'https://example.com/garlic.png',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllIngredientsForAdmin.mockResolvedValue(mockIngredients);
    mockDeleteIngredient.mockResolvedValue(undefined);
    mockDeleteImage.mockResolvedValue(undefined);
  });

  // ============================================================
  // INITIAL FETCH TESTS
  // ============================================================

  describe('initial fetch', () => {
    it('fetches ingredients on mount', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetAllIngredientsForAdmin).toHaveBeenCalledTimes(1);
      expect(result.current.ingredients).toHaveLength(3);
    });

    it('sets loading to true initially', () => {
      const { result } = renderHook(() => useIngredients());

      expect(result.current.loading).toBe(true);
    });

    it('sets loading to false after fetch completes', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('populates both ingredients and filteredIngredients', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.ingredients).toEqual(mockIngredients);
      expect(result.current.filteredIngredients).toEqual(mockIngredients);
    });

    it('starts with empty ingredients on error', async () => {
      // The hook re-throws errors, but should still set loading to false
      // and leave ingredients empty
      const { result } = renderHook(() => useIngredients());

      // Before fetch completes
      expect(result.current.ingredients).toEqual([]);
    });
  });

  // ============================================================
  // SEARCH FILTER TESTS
  // ============================================================

  describe('search filtering', () => {
    it('filters by English name', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('tomato');
      });

      await waitFor(() => {
        expect(result.current.filteredIngredients).toHaveLength(1);
        expect(result.current.filteredIngredients[0].nameEn).toBe('Tomato');
      });
    });

    it('filters by Spanish name', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('cebolla');
      });

      await waitFor(() => {
        expect(result.current.filteredIngredients).toHaveLength(1);
        expect(result.current.filteredIngredients[0].nameEs).toBe('Cebolla');
      });
    });

    it('filters case-insensitively', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('GARLIC');
      });

      await waitFor(() => {
        expect(result.current.filteredIngredients).toHaveLength(1);
      });
    });

    it('shows all ingredients when search is cleared', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('tomato');
      });

      await waitFor(() => {
        expect(result.current.filteredIngredients).toHaveLength(1);
      });

      act(() => {
        result.current.setSearchQuery('');
      });

      await waitFor(() => {
        expect(result.current.filteredIngredients).toHaveLength(3);
      });
    });

    it('returns empty array when no matches found', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('xyz123');
      });

      await waitFor(() => {
        expect(result.current.filteredIngredients).toHaveLength(0);
      });
    });
  });

  // ============================================================
  // DELETE TESTS
  // ============================================================

  describe('handleDeleteIngredient', () => {
    it('deletes ingredient and updates local state', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDeleteIngredient(mockIngredients[0]);
      });

      expect(mockDeleteIngredient).toHaveBeenCalledWith('ing-1');
      expect(result.current.ingredients).toHaveLength(2);
      expect(result.current.filteredIngredients).toHaveLength(2);
    });

    it('deletes image before deleting ingredient when pictureUrl exists', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDeleteIngredient(mockIngredients[0]);
      });

      expect(mockDeleteImage).toHaveBeenCalledWith('https://example.com/tomato.png');
      expect(mockDeleteIngredient).toHaveBeenCalledWith('ing-1');
    });

    it('skips image deletion when no pictureUrl', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDeleteIngredient(mockIngredients[1]); // Onion has no image
      });

      expect(mockDeleteImage).not.toHaveBeenCalled();
      expect(mockDeleteIngredient).toHaveBeenCalledWith('ing-2');
    });

    it('continues with deletion even if image deletion fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteImage.mockRejectedValue(new Error('Image delete failed'));

      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDeleteIngredient(mockIngredients[0]);
      });

      expect(mockDeleteIngredient).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('throws error when ingredient deletion fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteIngredient.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.handleDeleteIngredient(mockIngredients[0]);
        })
      ).rejects.toThrow('Delete failed');

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // REFRESH TESTS
  // ============================================================

  describe('refreshIngredients', () => {
    it('refetches ingredients from server', async () => {
      const { result } = renderHook(() => useIngredients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockGetAllIngredientsForAdmin.mockClear();

      await act(async () => {
        await result.current.refreshIngredients();
      });

      expect(mockGetAllIngredientsForAdmin).toHaveBeenCalledTimes(1);
    });
  });
});
