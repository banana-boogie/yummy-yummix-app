/**
 * useSmartScroll Hook Tests
 *
 * Tests for the smart scrolling hook covering:
 * - Initial state
 * - Scroll position tracking and near-bottom detection
 * - Show/hide scroll button logic
 * - Auto-scroll on new content when near bottom
 * - Content size change handling
 * - Layout change handling
 * - Skip scroll behavior (recipe card rendering)
 * - Throttled scroll to end
 */

import { renderHook, act } from '@testing-library/react-native';
import { useSmartScroll } from '../useSmartScroll';

// ============================================================
// HELPERS
// ============================================================

function createDefaultParams() {
  return {
    hasRecipeInCurrentStreamRef: { current: false },
  };
}

/**
 * Creates a mock scroll event matching React Native's NativeEvent shape.
 */
function createScrollEvent(options: {
  contentOffsetY: number;
  contentHeight: number;
  layoutHeight: number;
}) {
  return {
    nativeEvent: {
      contentOffset: { y: options.contentOffsetY },
      contentSize: { height: options.contentHeight },
      layoutMeasurement: { height: options.layoutHeight },
    },
  };
}

// ============================================================
// TESTS
// ============================================================

describe('useSmartScroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================
  // INITIAL STATE
  // ============================================================

  describe('initial state', () => {
    it('returns correct initial values', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      expect(result.current.showScrollButton).toBe(false);
      expect(result.current.isNearBottomRef.current).toBe(true);
      expect(result.current.skipNextScrollToEndRef.current).toBe(false);
      expect(result.current.flatListRef.current).toBeNull();
    });
  });

  // ============================================================
  // SCROLL POSITION TRACKING
  // ============================================================

  describe('scroll position tracking', () => {
    it('detects when user is near the bottom (within threshold)', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      // Content is 1000px tall, viewport is 500px, scrolled to 450
      // Distance from bottom = 1000 - (450 + 500) = 50 <= 100 threshold
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 450, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      expect(result.current.isNearBottomRef.current).toBe(true);
      expect(result.current.showScrollButton).toBe(false);
    });

    it('detects when user is far from the bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      // Distance from bottom = 1000 - (200 + 500) = 300 > 100 threshold
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 200, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      expect(result.current.isNearBottomRef.current).toBe(false);
    });

    it('detects when user is exactly at the threshold boundary', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      // Distance from bottom = 1000 - (400 + 500) = 100 <= 100 threshold
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 400, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      expect(result.current.isNearBottomRef.current).toBe(true);
    });
  });

  // ============================================================
  // SCROLL BUTTON VISIBILITY
  // ============================================================

  describe('scroll button visibility', () => {
    it('shows scroll button when scrolled away from bottom and content is taller than viewport', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      // User scrolled far from bottom, content taller than viewport
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      expect(result.current.showScrollButton).toBe(true);
    });

    it('hides scroll button when near the bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      // First scroll away
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });
      expect(result.current.showScrollButton).toBe(true);

      // Then scroll back to bottom
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 450, contentHeight: 1000, layoutHeight: 500 }),
        );
      });
      expect(result.current.showScrollButton).toBe(false);
    });

    it('hides scroll button when content fits within viewport', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      // Content is shorter than viewport
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 0, contentHeight: 300, layoutHeight: 500 }),
        );
      });

      expect(result.current.showScrollButton).toBe(false);
    });
  });

  // ============================================================
  // HANDLE SCROLL TO END
  // ============================================================

  describe('handleScrollToEnd', () => {
    it('resets isNearBottom and hides scroll button', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      // First simulate scrolling away
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });
      expect(result.current.showScrollButton).toBe(true);
      expect(result.current.isNearBottomRef.current).toBe(false);

      // Press scroll-to-end button
      act(() => {
        result.current.handleScrollToEnd();
      });

      expect(result.current.isNearBottomRef.current).toBe(true);
      expect(result.current.showScrollButton).toBe(false);
    });

    it('calls flatListRef.scrollToEnd with animated true', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      act(() => {
        result.current.handleScrollToEnd();
      });

      expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
    });
  });

  // ============================================================
  // CONTENT SIZE CHANGE (AUTO-SCROLL)
  // ============================================================

  describe('handleContentSizeChange', () => {
    it('scrolls to end when content grows and user is near bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // Simulate content growing (first call sets baseline, second is growth)
      act(() => {
        result.current.handleContentSizeChange(375, 500);
      });
      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
    });

    it('does not scroll when content shrinks', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // Set baseline
      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });
      mockScrollToEnd.mockClear();

      // Content shrinks
      act(() => {
        result.current.handleContentSizeChange(375, 500);
      });

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });

    it('does not scroll when user has scrolled away from bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // User scrolls away from bottom
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      // Set baseline then grow content
      act(() => {
        result.current.handleContentSizeChange(375, 500);
      });
      mockScrollToEnd.mockClear();

      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });

    it('does not scroll when recipe is being streamed', () => {
      const params = createDefaultParams();
      params.hasRecipeInCurrentStreamRef.current = true;
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      act(() => {
        result.current.handleContentSizeChange(375, 500);
      });
      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });

    it('skips scroll when skipNextScrollToEndRef is true, then resets the flag', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // Set baseline height first
      act(() => {
        result.current.handleContentSizeChange(375, 500);
      });
      mockScrollToEnd.mockClear();

      // Now set the skip flag before the next growth
      result.current.skipNextScrollToEndRef.current = true;

      // Content grows but skip is set
      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToEnd).not.toHaveBeenCalled();
      expect(result.current.skipNextScrollToEndRef.current).toBe(false);
    });

    it('force-scrolls with scrollToOffset during restore mode', () => {
      jest.useFakeTimers();
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToOffset = jest.fn();
      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = {
        scrollToOffset: mockScrollToOffset,
        scrollToEnd: mockScrollToEnd,
      };

      act(() => {
        result.current.beginRestoreScroll();
        result.current.handleContentSizeChange(375, 500);
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 800, animated: false });
    });

    it('restore mode bypasses normal bailouts', () => {
      jest.useFakeTimers();
      const params = createDefaultParams();
      params.hasRecipeInCurrentStreamRef.current = true;
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToOffset = jest.fn();
      (result.current.flatListRef as any).current = { scrollToOffset: mockScrollToOffset };

      result.current.skipNextScrollToEndRef.current = true;
      result.current.isNearBottomRef.current = false;

      act(() => {
        result.current.beginRestoreScroll();
        result.current.handleContentSizeChange(375, 700);
      });

      expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 700, animated: false });
    });

    it('restore mode ends after content is stable for the debounce window', () => {
      jest.useFakeTimers();
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToOffset = jest.fn();
      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = {
        scrollToOffset: mockScrollToOffset,
        scrollToEnd: mockScrollToEnd,
      };

      act(() => {
        jest.setSystemTime(1000);
        result.current.beginRestoreScroll();
        result.current.handleContentSizeChange(375, 500);
        jest.advanceTimersByTime(151);
      });

      mockScrollToOffset.mockClear();

      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToOffset).not.toHaveBeenCalled();
    });

    it('restore mode ends after two stable passes', () => {
      jest.useFakeTimers();
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToOffset = jest.fn();
      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = {
        scrollToOffset: mockScrollToOffset,
        scrollToEnd: mockScrollToEnd,
      };

      act(() => {
        result.current.beginRestoreScroll();
        result.current.handleContentSizeChange(375, 500);
        result.current.handleContentSizeChange(375, 500);
        result.current.handleContentSizeChange(375, 500);
      });

      mockScrollToOffset.mockClear();

      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToOffset).not.toHaveBeenCalled();
    });

    it('restore mode ends after the hard cap timeout', () => {
      jest.useFakeTimers();
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToOffset = jest.fn();
      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = {
        scrollToOffset: mockScrollToOffset,
        scrollToEnd: mockScrollToEnd,
      };

      act(() => {
        result.current.beginRestoreScroll();
        result.current.handleContentSizeChange(375, 500);
      });

      mockScrollToOffset.mockClear();

      act(() => {
        jest.advanceTimersByTime(2001);
      });

      act(() => {
        result.current.handleContentSizeChange(375, 900);
      });

      expect(mockScrollToOffset).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // LAYOUT CHANGE
  // ============================================================

  describe('handleLayout', () => {
    it('scrolls to end on layout change when near bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      act(() => {
        result.current.handleLayout();
      });

      expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
    });

    it('does not scroll on layout change when not near bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // Simulate scrolling away
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      act(() => {
        result.current.handleLayout();
      });

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });

    it('does not scroll on layout change when recipe is streaming', () => {
      const params = createDefaultParams();
      params.hasRecipeInCurrentStreamRef.current = true;
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      act(() => {
        result.current.handleLayout();
      });

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // SCROLL TO END THROTTLED
  // ============================================================

  describe('scrollToEndThrottled', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not scroll when not near bottom and not animated', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // Scroll away from bottom
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      act(() => {
        result.current.scrollToEndThrottled(false);
      });

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });

    it('scrolls when animated is true even if not near bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // Scroll away from bottom
      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      act(() => {
        result.current.scrollToEndThrottled(true);
      });

      expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
    });

    it('scrolls when near bottom', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // isNearBottomRef is true by default
      act(() => {
        result.current.scrollToEndThrottled(false);
      });

      expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
    });

    it('throttles non-animated scrolls', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToEnd = jest.fn();
      (result.current.flatListRef as any).current = { scrollToEnd: mockScrollToEnd };

      // First call should go through
      act(() => {
        jest.setSystemTime(1000);
        result.current.scrollToEndThrottled(false);
      });
      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);

      // Second call within throttle window should be skipped
      act(() => {
        jest.setSystemTime(1050);
        result.current.scrollToEndThrottled(false);
      });
      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);

      // Call after throttle window should go through
      act(() => {
        jest.setSystemTime(1150);
        result.current.scrollToEndThrottled(false);
      });
      expect(mockScrollToEnd).toHaveBeenCalledTimes(2);
    });
  });

  describe('restore mode', () => {
    it('beginRestoreScroll resets isNearBottomRef and hides the scroll button', () => {
      jest.useFakeTimers();
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      act(() => {
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      expect(result.current.isNearBottomRef.current).toBe(false);
      expect(result.current.showScrollButton).toBe(true);

      act(() => {
        result.current.beginRestoreScroll();
      });

      expect(result.current.isNearBottomRef.current).toBe(true);
      expect(result.current.showScrollButton).toBe(false);
    });

    it('user scrolling away from bottom cancels restore mode', () => {
      jest.useFakeTimers();
      const params = createDefaultParams();
      const { result } = renderHook(() => useSmartScroll(params));

      const mockScrollToOffset = jest.fn();
      (result.current.flatListRef as any).current = { scrollToOffset: mockScrollToOffset };

      act(() => {
        result.current.beginRestoreScroll();
        result.current.handleContentSizeChange(375, 500);
        result.current.handleScroll(
          createScrollEvent({ contentOffsetY: 100, contentHeight: 1000, layoutHeight: 500 }),
        );
      });

      mockScrollToOffset.mockClear();

      act(() => {
        result.current.handleContentSizeChange(375, 800);
      });

      expect(mockScrollToOffset).not.toHaveBeenCalled();
    });
  });
});
