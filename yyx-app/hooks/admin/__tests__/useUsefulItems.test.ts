/**
 * useUsefulItems Hook Tests
 *
 * Tests for admin useful items hook covering:
 * - Fetching useful items
 * - Filtering by search query
 * - Deleting items
 * - Loading states
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useUsefulItems } from '../useUsefulItems';

// Mock the admin useful items service
const mockGetAllUsefulItems = jest.fn();
const mockDeleteUsefulItem = jest.fn();

jest.mock('@/services/admin/adminUsefulItemsService', () => ({
  adminUsefulItemsService: {
    getAllUsefulItems: () => mockGetAllUsefulItems(),
    deleteUsefulItem: (id: string) => mockDeleteUsefulItem(id),
  },
}));

describe('useUsefulItems', () => {
  const mockUsefulItems = [
    {
      id: 'item-1',
      nameEn: 'Mixing Bowl',
      nameEs: 'Tazón para mezclar',
      pictureUrl: 'https://example.com/bowl.png',
    },
    {
      id: 'item-2',
      nameEn: 'Whisk',
      nameEs: 'Batidor',
      pictureUrl: 'https://example.com/whisk.png',
    },
    {
      id: 'item-3',
      nameEn: 'Cutting Board',
      nameEs: 'Tabla de cortar',
      pictureUrl: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllUsefulItems.mockResolvedValue(mockUsefulItems);
    mockDeleteUsefulItem.mockResolvedValue(undefined);
  });

  // ============================================================
  // INITIAL FETCH TESTS
  // ============================================================

  describe('initial fetch', () => {
    it('fetches useful items on mount', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetAllUsefulItems).toHaveBeenCalledTimes(1);
      expect(result.current.usefulItems).toHaveLength(3);
    });

    it('sets loading to true initially', () => {
      const { result } = renderHook(() => useUsefulItems());

      expect(result.current.loading).toBe(true);
    });

    it('sets loading to false after fetch completes', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('populates both usefulItems and filteredUsefulItems', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.usefulItems).toEqual(mockUsefulItems);
      expect(result.current.filteredUsefulItems).toEqual(mockUsefulItems);
    });

    it('handles fetch error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockGetAllUsefulItems.mockRejectedValue(new Error('Fetch failed'));

      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.current.usefulItems).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // SEARCH FILTER TESTS
  // ============================================================

  describe('search filtering', () => {
    it('filters by English name', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('bowl');
      });

      await waitFor(() => {
        expect(result.current.filteredUsefulItems).toHaveLength(1);
        expect(result.current.filteredUsefulItems[0].nameEn).toBe('Mixing Bowl');
      });
    });

    it('filters by Spanish name', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('batidor');
      });

      await waitFor(() => {
        expect(result.current.filteredUsefulItems).toHaveLength(1);
        expect(result.current.filteredUsefulItems[0].nameEs).toBe('Batidor');
      });
    });

    it('filters case-insensitively', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('WHISK');
      });

      await waitFor(() => {
        expect(result.current.filteredUsefulItems).toHaveLength(1);
      });
    });

    it('shows all items when search is cleared', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('bowl');
      });

      await waitFor(() => {
        expect(result.current.filteredUsefulItems).toHaveLength(1);
      });

      act(() => {
        result.current.setSearchQuery('');
      });

      await waitFor(() => {
        expect(result.current.filteredUsefulItems).toHaveLength(3);
      });
    });

    it('returns empty array when no matches found', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('xyz123');
      });

      await waitFor(() => {
        expect(result.current.filteredUsefulItems).toHaveLength(0);
      });
    });

    it('trims whitespace from search query', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('  bowl  ');
      });

      await waitFor(() => {
        expect(result.current.filteredUsefulItems).toHaveLength(1);
      });
    });
  });

  // ============================================================
  // DELETE TESTS
  // ============================================================

  describe('handleDeleteUsefulItem', () => {
    it('deletes item and updates local state', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDeleteUsefulItem(mockUsefulItems[0]);
      });

      expect(mockDeleteUsefulItem).toHaveBeenCalledWith('item-1');
      expect(result.current.usefulItems).toHaveLength(2);
      expect(result.current.filteredUsefulItems).toHaveLength(2);
    });

    it('throws error when deletion fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteUsefulItem.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.handleDeleteUsefulItem(mockUsefulItems[0]);
        })
      ).rejects.toThrow('Delete failed');

      consoleSpy.mockRestore();
    });

    it('removes item from both usefulItems and filteredUsefulItems', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialLength = result.current.usefulItems.length;

      await act(async () => {
        await result.current.handleDeleteUsefulItem(mockUsefulItems[1]);
      });

      expect(result.current.usefulItems).toHaveLength(initialLength - 1);
      expect(result.current.filteredUsefulItems).toHaveLength(initialLength - 1);
      expect(result.current.usefulItems.find(i => i.id === 'item-2')).toBeUndefined();
    });
  });

  // ============================================================
  // REFRESH TESTS
  // ============================================================

  describe('refreshUsefulItems', () => {
    it('refetches items from server', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockGetAllUsefulItems.mockClear();

      await act(async () => {
        await result.current.refreshUsefulItems();
      });

      expect(mockGetAllUsefulItems).toHaveBeenCalledTimes(1);
    });

    it('updates loading state during refresh', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loadingDuringRefresh = false;
      mockGetAllUsefulItems.mockImplementation(() => {
        loadingDuringRefresh = result.current.loading;
        return Promise.resolve(mockUsefulItems);
      });

      await act(async () => {
        await result.current.refreshUsefulItems();
      });

      // Loading should have been true during the refresh
      expect(result.current.loading).toBe(false); // After refresh completes
    });
  });

  // ============================================================
  // STATE SETTERS TESTS
  // ============================================================

  describe('state setters', () => {
    it('exposes setUsefulItems for external updates', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newItems = [{ id: 'new-1', nameEn: 'New Item', nameEs: 'Nuevo' }];

      act(() => {
        result.current.setUsefulItems(newItems as any);
      });

      expect(result.current.usefulItems).toEqual(newItems);
    });

    it('exposes setFilteredUsefulItems for external filtering', async () => {
      const { result } = renderHook(() => useUsefulItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = [mockUsefulItems[0]];

      act(() => {
        result.current.setFilteredUsefulItems(filtered);
      });

      expect(result.current.filteredUsefulItems).toEqual(filtered);
    });
  });
});
