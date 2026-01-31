/**
 * useDevice Tests
 *
 * Tests for device hook covering:
 * - Breakpoint detection
 * - Platform detection
 */

import { renderHook } from '@testing-library/react-native';
import { useDevice } from '../useDevice';

// Mock useWindowDimensions separately
const mockWidth = jest.fn();

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: mockWidth(), height: 812 }),
  Platform: {
    OS: 'ios',
  },
}));

describe('useDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWidth.mockReturnValue(375); // Default phone width
  });

  // ============================================================
  // PHONE BREAKPOINT TESTS
  // ============================================================

  describe('phone breakpoint (xs)', () => {
    beforeEach(() => {
      mockWidth.mockReturnValue(375);
    });

    it('identifies phone screen', () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isPhone).toBe(true);
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('sets correct breakpoint flags', () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isSmall).toBe(false);
      expect(result.current.isMedium).toBe(false);
      expect(result.current.isLarge).toBe(false);
    });
  });

  // ============================================================
  // SMALL BREAKPOINT TESTS
  // ============================================================

  describe('small breakpoint (sm)', () => {
    beforeEach(() => {
      mockWidth.mockReturnValue(600);
    });

    it('identifies small screen', () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isSmall).toBe(true);
      expect(result.current.isSmallUp).toBe(true);
      expect(result.current.isMobile).toBe(true);
    });
  });

  // ============================================================
  // MEDIUM BREAKPOINT TESTS
  // ============================================================

  describe('medium breakpoint (md)', () => {
    beforeEach(() => {
      mockWidth.mockReturnValue(800);
    });

    it('identifies medium screen', () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isMedium).toBe(true);
      expect(result.current.isMediumUp).toBe(true);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isMobile).toBe(false);
    });
  });

  // ============================================================
  // LARGE BREAKPOINT TESTS
  // ============================================================

  describe('large breakpoint (lg)', () => {
    beforeEach(() => {
      mockWidth.mockReturnValue(1200);
    });

    it('identifies large screen', () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isLarge).toBe(true);
      expect(result.current.isLargeUp).toBe(true);
      expect(result.current.isDesktop).toBe(true);
    });

    it('sets all up flags correctly', () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isSmallUp).toBe(true);
      expect(result.current.isMediumUp).toBe(true);
      expect(result.current.isLargeUp).toBe(true);
    });
  });

  // ============================================================
  // PLATFORM TESTS
  // ============================================================

  describe('platform detection', () => {
    it('detects iOS platform', () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isIOS).toBe(true);
      expect(result.current.isAndroid).toBe(false);
      expect(result.current.isNative).toBe(true);
      expect(result.current.isWeb).toBe(false);
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles exact breakpoint boundary (sm)', () => {
      mockWidth.mockReturnValue(576);

      const { result } = renderHook(() => useDevice());

      expect(result.current.isSmall).toBe(true);
      expect(result.current.isSmallUp).toBe(true);
    });

    it('handles exact breakpoint boundary (md)', () => {
      mockWidth.mockReturnValue(768);

      const { result } = renderHook(() => useDevice());

      expect(result.current.isMedium).toBe(true);
      expect(result.current.isMediumUp).toBe(true);
    });

    it('handles exact breakpoint boundary (lg)', () => {
      mockWidth.mockReturnValue(1100);

      const { result } = renderHook(() => useDevice());

      expect(result.current.isLarge).toBe(true);
      expect(result.current.isLargeUp).toBe(true);
    });

    it('handles very small width', () => {
      mockWidth.mockReturnValue(100);

      const { result } = renderHook(() => useDevice());

      expect(result.current.isPhone).toBe(true);
      expect(result.current.isMobile).toBe(true);
    });

    it('handles very large width', () => {
      mockWidth.mockReturnValue(2560);

      const { result } = renderHook(() => useDevice());

      expect(result.current.isLarge).toBe(true);
      expect(result.current.isDesktop).toBe(true);
    });
  });
});
