/**
 * useDebounce Tests
 *
 * Tests for debounce hook covering:
 * - Initial value
 * - Delayed value update
 * - Value change cancellation
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================
  // INITIAL VALUE TESTS
  // ============================================================

  describe('initial value', () => {
    it('returns initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 300));

      expect(result.current).toBe('initial');
    });

    it('returns initial value with default delay', () => {
      const { result } = renderHook(() => useDebounce('test'));

      expect(result.current).toBe('test');
    });
  });

  // ============================================================
  // DEBOUNCE BEHAVIOR TESTS
  // ============================================================

  describe('debounce behavior', () => {
    it('does not update value before delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      // Before delay, value should still be initial
      expect(result.current).toBe('initial');
    });

    it('updates value after delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current).toBe('updated');
    });

    it('cancels previous timer on value change', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: 'first' } }
      );

      // First update
      rerender({ value: 'second' });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Second update before first completes
      rerender({ value: 'third' });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should skip 'second' and go straight to 'third'
      expect(result.current).toBe('third');
    });
  });

  // ============================================================
  // CUSTOM DELAY TESTS
  // ============================================================

  describe('custom delay', () => {
    it('respects custom delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(result.current).toBe('initial');

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(result.current).toBe('updated');
    });

    it('handles zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 0),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(result.current).toBe('updated');
    });
  });

  // ============================================================
  // TYPE TESTS
  // ============================================================

  describe('different types', () => {
    it('handles number values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 100),
        { initialProps: { value: 0 } }
      );

      rerender({ value: 42 });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current).toBe(42);
    });

    it('handles object values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 100),
        { initialProps: { value: { name: 'initial' } } }
      );

      rerender({ value: { name: 'updated' } });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current).toEqual({ name: 'updated' });
    });

    it('handles array values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 100),
        { initialProps: { value: [1, 2, 3] } }
      );

      rerender({ value: [4, 5, 6] });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current).toEqual([4, 5, 6]);
    });
  });
});
