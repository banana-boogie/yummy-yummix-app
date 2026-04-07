import { useState, useCallback, useRef, useEffect } from 'react';
import { FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

const SCROLL_THROTTLE_MS = 100;
const SCROLL_THRESHOLD = 100;
const RESTORE_SCROLL_STABLE_DEBOUNCE_MS = 150;
const RESTORE_SCROLL_STABLE_PASSES = 2;
const RESTORE_SCROLL_HARD_CAP_MS = 2000;

interface UseSmartScrollParams {
    hasRecipeInCurrentStreamRef: React.MutableRefObject<boolean>;
}

type RestoreScrollState = {
    active: boolean;
    startedAt: number;
    lastHeight: number;
    stablePasses: number;
    stableTimer: ReturnType<typeof setTimeout> | null;
    hardCapTimer: ReturnType<typeof setTimeout> | null;
};

export function useSmartScroll({
    hasRecipeInCurrentStreamRef,
}: UseSmartScrollParams) {
    const flatListRef = useRef<FlatList>(null);
    const lastScrollRef = useRef(0);
    const isNearBottomRef = useRef(true);
    const skipNextScrollToEndRef = useRef(false);
    const prevContentHeightRef = useRef(0);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const restoreStateRef = useRef<RestoreScrollState>({
        active: false,
        startedAt: 0,
        lastHeight: 0,
        stablePasses: 0,
        stableTimer: null,
        hardCapTimer: null,
    });

    const cancelRestoreScroll = useCallback(() => {
        const restore = restoreStateRef.current;
        if (restore.stableTimer) {
            clearTimeout(restore.stableTimer);
        }
        if (restore.hardCapTimer) {
            clearTimeout(restore.hardCapTimer);
        }
        restoreStateRef.current = {
            active: false,
            startedAt: 0,
            lastHeight: 0,
            stablePasses: 0,
            stableTimer: null,
            hardCapTimer: null,
        };
    }, []);

    const beginRestoreScroll = useCallback(() => {
        cancelRestoreScroll();
        const now = Date.now();
        restoreStateRef.current = {
            active: true,
            startedAt: now,
            lastHeight: 0,
            stablePasses: 0,
            stableTimer: null,
            hardCapTimer: setTimeout(() => {
                cancelRestoreScroll();
            }, RESTORE_SCROLL_HARD_CAP_MS),
        };
        isNearBottomRef.current = true;
        setShowScrollButton(false);
    }, [cancelRestoreScroll]);

    useEffect(() => {
        return () => {
            cancelRestoreScroll();
        };
    }, [cancelRestoreScroll]);

    const scrollToEndThrottled = useCallback((animated: boolean) => {
        if (!isNearBottomRef.current && !animated) return;

        const now = Date.now();
        if (animated || now - lastScrollRef.current > SCROLL_THROTTLE_MS) {
            lastScrollRef.current = now;
            flatListRef.current?.scrollToEnd({ animated });
        }
    }, []);

    /**
     * Fires after FlatList content is laid out at its new size.
     * This is the reliable moment to scroll — content is already rendered.
     */
    const handleContentSizeChange = useCallback((_width: number, height: number) => {
        const restore = restoreStateRef.current;
        if (restore.active) {
            const grew = height > restore.lastHeight;
            const unchanged = height === restore.lastHeight;

            flatListRef.current?.scrollToOffset({ offset: height, animated: false });

            if (restore.stableTimer) {
                clearTimeout(restore.stableTimer);
            }
            restore.stableTimer = setTimeout(() => {
                cancelRestoreScroll();
            }, RESTORE_SCROLL_STABLE_DEBOUNCE_MS);

            if (grew) {
                restore.lastHeight = height;
                restore.stablePasses = 0;
            } else if (unchanged) {
                restore.stablePasses += 1;
                if (restore.stablePasses >= RESTORE_SCROLL_STABLE_PASSES) {
                    cancelRestoreScroll();
                }
            } else {
                // Content can shrink during virtualization/layout reconciliation.
                // Treat that as "still changing" but not stable.
                restore.lastHeight = height;
                restore.stablePasses = 0;
            }
            return;
        }

        const grew = height > prevContentHeightRef.current;
        prevContentHeightRef.current = height;

        if (!grew) return;
        if (skipNextScrollToEndRef.current) {
            skipNextScrollToEndRef.current = false;
            return;
        }
        if (hasRecipeInCurrentStreamRef.current) return;
        if (!isNearBottomRef.current) return;

        flatListRef.current?.scrollToEnd({ animated: false });
    }, [cancelRestoreScroll, hasRecipeInCurrentStreamRef]);

    /**
     * Fires when the FlatList layout changes (e.g. keyboard open/close).
     * Scroll to end so the latest message stays visible.
     */
    const handleLayout = useCallback(() => {
        if (isNearBottomRef.current && !hasRecipeInCurrentStreamRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
        }
    }, [hasRecipeInCurrentStreamRef]);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

        if (restoreStateRef.current.active && distanceFromBottom > SCROLL_THRESHOLD) {
            cancelRestoreScroll();
        }

        const isNearBottom = distanceFromBottom <= SCROLL_THRESHOLD;
        isNearBottomRef.current = isNearBottom;

        setShowScrollButton(!isNearBottom && contentSize.height > layoutMeasurement.height);
    }, [cancelRestoreScroll]);

    const handleScrollToEnd = useCallback(() => {
        isNearBottomRef.current = true;
        setShowScrollButton(false);
        flatListRef.current?.scrollToEnd({ animated: true });
    }, []);

    return {
        flatListRef,
        showScrollButton,
        scrollToEndThrottled,
        handleContentSizeChange,
        handleLayout,
        handleScroll,
        handleScrollToEnd,
        isNearBottomRef,
        skipNextScrollToEndRef,
        beginRestoreScroll,
        cancelRestoreScroll,
    };
}
