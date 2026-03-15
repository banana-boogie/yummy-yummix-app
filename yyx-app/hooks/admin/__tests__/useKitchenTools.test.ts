/**
 * useKitchenTools Hook Tests
 *
 * Tests for admin kitchen tools hook covering:
 * - Fetching kitchen tools
 * - Filtering by search query
 * - Deleting items
 * - Loading states
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useKitchenTools } from '../useKitchenTools';

// Mock the admin kitchen tools service
const mockGetAllKitchenTools = jest.fn();
const mockDeleteKitchenTool = jest.fn();

jest.mock('@/services/admin/adminKitchenToolsService', () => ({
  adminKitchenToolsService: {
    getAllKitchenTools: () => mockGetAllKitchenTools(),
    deleteKitchenTool: (id: string) => mockDeleteKitchenTool(id),
  },
}));

describe('useKitchenTools', () => {
  const mockKitchenTools = [
    {
      id: 'item-1',
      translations: [
        { locale: 'en', name: 'Mixing Bowl' },
        { locale: 'es', name: 'Tazón para mezclar' },
      ],
      pictureUrl: 'https://example.com/bowl.png',
    },
    {
      id: 'item-2',
      translations: [
        { locale: 'en', name: 'Whisk' },
        { locale: 'es', name: 'Batidor' },
      ],
      pictureUrl: 'https://example.com/whisk.png',
    },
    {
      id: 'item-3',
      translations: [
        { locale: 'en', name: 'Cutting Board' },
        { locale: 'es', name: 'Tabla de cortar' },
      ],
      pictureUrl: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllKitchenTools.mockResolvedValue(mockKitchenTools);
    mockDeleteKitchenTool.mockResolvedValue(undefined);
  });

  // ============================================================
  // INITIAL FETCH TESTS
  // ============================================================

  describe('initial fetch', () => {
    it('fetches kitchen tools on mount', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetAllKitchenTools).toHaveBeenCalledTimes(1);
      expect(result.current.kitchenTools).toHaveLength(3);
    });

    it('sets loading to true initially', () => {
      const { result } = renderHook(() => useKitchenTools());

      expect(result.current.loading).toBe(true);
    });

    it('sets loading to false after fetch completes', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('populates both kitchenTools and filteredKitchenTools', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.kitchenTools).toEqual(mockKitchenTools);
      expect(result.current.filteredKitchenTools).toEqual(mockKitchenTools);
    });

    it('handles fetch error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockGetAllKitchenTools.mockRejectedValue(new Error('Fetch failed'));

      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.current.kitchenTools).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // SEARCH FILTER TESTS
  // ============================================================

  describe('search filtering', () => {
    it('filters by English name', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('bowl');
      });

      await waitFor(() => {
        expect(result.current.filteredKitchenTools).toHaveLength(1);
        expect(result.current.filteredKitchenTools[0].id).toBe('item-1');
      });
    });

    it('filters by Spanish name', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('batidor');
      });

      await waitFor(() => {
        expect(result.current.filteredKitchenTools).toHaveLength(1);
        expect(result.current.filteredKitchenTools[0].id).toBe('item-2');
      });
    });

    it('filters case-insensitively', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('WHISK');
      });

      await waitFor(() => {
        expect(result.current.filteredKitchenTools).toHaveLength(1);
      });
    });

    it('shows all items when search is cleared', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('bowl');
      });

      await waitFor(() => {
        expect(result.current.filteredKitchenTools).toHaveLength(1);
      });

      act(() => {
        result.current.setSearchQuery('');
      });

      await waitFor(() => {
        expect(result.current.filteredKitchenTools).toHaveLength(3);
      });
    });

    it('returns empty array when no matches found', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('xyz123');
      });

      await waitFor(() => {
        expect(result.current.filteredKitchenTools).toHaveLength(0);
      });
    });

    it('trims whitespace from search query', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearchQuery('  bowl  ');
      });

      await waitFor(() => {
        expect(result.current.filteredKitchenTools).toHaveLength(1);
      });
    });
  });

  // ============================================================
  // DELETE TESTS
  // ============================================================

  describe('handleDeleteKitchenTool', () => {
    it('deletes item and updates local state', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.handleDeleteKitchenTool(mockKitchenTools[0]);
      });

      expect(mockDeleteKitchenTool).toHaveBeenCalledWith('item-1');
      expect(result.current.kitchenTools).toHaveLength(2);
      expect(result.current.filteredKitchenTools).toHaveLength(2);
    });

    it('throws error when deletion fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteKitchenTool.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.handleDeleteKitchenTool(mockKitchenTools[0]);
        })
      ).rejects.toThrow('Delete failed');

      consoleSpy.mockRestore();
    });

    it('removes item from both kitchenTools and filteredKitchenTools', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialLength = result.current.kitchenTools.length;

      await act(async () => {
        await result.current.handleDeleteKitchenTool(mockKitchenTools[1]);
      });

      expect(result.current.kitchenTools).toHaveLength(initialLength - 1);
      expect(result.current.filteredKitchenTools).toHaveLength(initialLength - 1);
      expect(result.current.kitchenTools.find(i => i.id === 'item-2')).toBeUndefined();
    });
  });

  // ============================================================
  // REFRESH TESTS
  // ============================================================

  describe('refreshKitchenTools', () => {
    it('refetches items from server', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockGetAllKitchenTools.mockClear();

      await act(async () => {
        await result.current.refreshKitchenTools();
      });

      expect(mockGetAllKitchenTools).toHaveBeenCalledTimes(1);
    });

    it('updates loading state during refresh', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let loadingDuringRefresh = false;
      mockGetAllKitchenTools.mockImplementation(() => {
        loadingDuringRefresh = result.current.loading;
        return Promise.resolve(mockKitchenTools);
      });

      await act(async () => {
        await result.current.refreshKitchenTools();
      });

      // Loading should have been true during the refresh
      expect(result.current.loading).toBe(false); // After refresh completes
    });
  });

  // ============================================================
  // STATE SETTERS TESTS
  // ============================================================

  describe('state setters', () => {
    it('exposes setKitchenTools for external updates', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newItems = [{
        id: 'new-1',
        translations: [{ locale: 'en', name: 'New Item' }, { locale: 'es', name: 'Nuevo' }],
        pictureUrl: '',
      }];

      act(() => {
        result.current.setKitchenTools(newItems as any);
      });

      expect(result.current.kitchenTools).toEqual(newItems);
    });

    it('exposes setFilteredKitchenTools for external filtering', async () => {
      const { result } = renderHook(() => useKitchenTools());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = [mockKitchenTools[0]];

      act(() => {
        result.current.setFilteredKitchenTools(filtered);
      });

      expect(result.current.filteredKitchenTools).toEqual(filtered);
    });
  });
});
