/**
 * useActiveLocales Hook Tests
 *
 * Tests for admin active locales hook covering:
 * - Fetching locales on mount
 * - Sorting with 'es' first (Mexico-first)
 * - Loading states
 * - Error fallback to hardcoded locales
 * - Empty response handling
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useActiveLocales } from '../useActiveLocales';

// ---------- Supabase mock ----------
// Build a chainable + thenable mock that mimics Supabase's PostgREST builder.
// Every method returns the same object. When awaited, it resolves via `.then()`.

let mockResolvedValue = { data: null as any, error: null as any };

const mockQuery: any = {
  select: jest.fn(),
  not: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  then: (resolve: any) => resolve(mockResolvedValue),
};
// Each method returns the query object for chaining
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.not.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);
mockQuery.order.mockReturnValue(mockQuery);

const mockFrom = jest.fn(() => mockQuery);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// ---------- Test data ----------

const dbLocalesUnordered = [
  { code: 'en', display_name: 'English' },
  { code: 'fr', display_name: 'Français' },
  { code: 'es', display_name: 'Español' },
];

const dbLocalesAlphabetical = [
  { code: 'en', display_name: 'English' },
  { code: 'es', display_name: 'Español' },
  { code: 'fr', display_name: 'Français' },
];

const hardcodedFallback = [
  { code: 'es', displayName: 'Español' },
  { code: 'en', displayName: 'English' },
];

// ---------- Tests ----------

describe('useActiveLocales', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: successful fetch returning alphabetically-ordered locales
    mockResolvedValue =({ data: dbLocalesAlphabetical, error: null });
  });

  // ============================================================
  // INITIAL FETCH TESTS
  // ============================================================

  describe('initial fetch', () => {
    it('fetches locales on mount and returns them', async () => {
      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFrom).toHaveBeenCalledWith('locales');
      expect(mockQuery.select).toHaveBeenCalledWith('code, display_name');
      expect(mockQuery.not).toHaveBeenCalledWith('code', 'like', '%-%');
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockQuery.order).toHaveBeenCalledWith('code', { ascending: true });
      expect(result.current.locales).toHaveLength(3);
    });

    it('maps display_name to displayName', async () => {
      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      result.current.locales.forEach((locale) => {
        expect(locale).toHaveProperty('code');
        expect(locale).toHaveProperty('displayName');
        expect(locale).not.toHaveProperty('display_name');
      });
    });
  });

  // ============================================================
  // SORTING TESTS
  // ============================================================

  describe('sorting', () => {
    it('sorts es before other locales', async () => {
      mockResolvedValue =({ data: dbLocalesAlphabetical, error: null });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locales[0].code).toBe('es');
      expect(result.current.locales[1].code).toBe('en');
      expect(result.current.locales[2].code).toBe('fr');
    });

    it('sorts es first even when it comes last from DB', async () => {
      mockResolvedValue =({ data: dbLocalesUnordered, error: null });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locales[0].code).toBe('es');
    });

    it('sorts remaining locales alphabetically after es', async () => {
      mockResolvedValue =({
        data: [
          { code: 'pt', display_name: 'Português' },
          { code: 'es', display_name: 'Español' },
          { code: 'de', display_name: 'Deutsch' },
          { code: 'en', display_name: 'English' },
        ],
        error: null,
      });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const codes = result.current.locales.map((l) => l.code);
      expect(codes).toEqual(['es', 'de', 'en', 'pt']);
    });
  });

  // ============================================================
  // LOADING STATE TESTS
  // ============================================================

  describe('loading state', () => {
    it('sets loading to true initially', () => {
      const { result } = renderHook(() => useActiveLocales());

      expect(result.current.loading).toBe(true);
    });

    it('sets loading to false after fetch completes', async () => {
      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('sets loading to false even on error', async () => {
      mockResolvedValue =({
        data: null,
        error: { message: 'DB error', code: '500' },
      });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  // ============================================================
  // ERROR FALLBACK TESTS
  // ============================================================

  describe('error fallback', () => {
    it('falls back to hardcoded locales on fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockResolvedValue =({
        data: null,
        error: { message: 'Table not found', code: '42P01' },
      });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locales).toEqual(hardcodedFallback);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch locales:',
        expect.objectContaining({ message: 'Table not found' })
      );

      consoleSpy.mockRestore();
    });

    it('hardcoded fallback has es first', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockResolvedValue =({
        data: null,
        error: { message: 'Network error' },
      });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locales[0]).toEqual({ code: 'es', displayName: 'Español' });
      expect(result.current.locales[1]).toEqual({ code: 'en', displayName: 'English' });

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // EDGE CASE TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty response from DB', async () => {
      mockResolvedValue =({ data: [], error: null });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locales).toEqual([]);
    });

    it('handles null data with no error', async () => {
      mockResolvedValue =({ data: null, error: null });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // data is null and no error, so the if (!cancelled && data) branch is skipped
      expect(result.current.locales).toEqual([]);
    });

    it('handles single locale response', async () => {
      mockResolvedValue =({
        data: [{ code: 'es', display_name: 'Español' }],
        error: null,
      });

      const { result } = renderHook(() => useActiveLocales());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locales).toHaveLength(1);
      expect(result.current.locales[0]).toEqual({ code: 'es', displayName: 'Español' });
    });
  });
});
