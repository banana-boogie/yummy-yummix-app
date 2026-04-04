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

export function useSmartScroll({
    hasRecipeInCurrentStreamRef,
}: UseSmartScrollParams) {
    const flatListRef = useRef<FlatList>(null);
    const lastScrollRef = useRef(0);
    const isNearBottomRef = useRef(true);
    const skipNextScrollToEndRef = useRef(false);
    const prevContentHeightRef = useRef(0);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const restoreActiveRef = useRef(false);
    const restoreStartedAtRef = useRef(0);
    const restoreLastHeightRef = useRef(0);
    const restoreLastGrowthAtRef = useRef(0);
    const restoreStablePassesRef = useRef(0);
    const restoreStableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const restoreHardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelRestoreScroll = useCallback(() => {
        restoreActiveRef.current = false;
        restoreStartedAtRef.current = 0;
        restoreLastHeightRef.current = 0;
        restoreLastGrowthAtRef.current = 0;
        restoreStablePassesRef.current = 0;
        if (restoreStableTimerRef.current) {
            clearTimeout(restoreStableTimerRef.current);
            restoreStableTimerRef.current = null;
        }
        if (restoreHardCapTimerRef.current) {
            clearTimeout(restoreHardCapTimerRef.current);
            restoreHardCapTimerRef.current = null;
        }
    }, []);

    const beginRestoreScroll = useCallback(() => {
        cancelRestoreScroll();
        const now = Date.now();
        restoreActiveRef.current = true;
        restoreStartedAtRef.current = now;
        restoreLastGrowthAtRef.current = now;
        restoreStablePassesRef.current = 0;
        isNearBottomRef.current = true;
        setShowScrollButton(false);

        restoreHardCapTimerRef.current = setTimeout(() => {
            cancelRestoreScroll();
        }, RESTORE_SCROLL_HARD_CAP_MS);
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
        if (restoreActiveRef.current) {
            const now = Date.now();
            const grew = height > restoreLastHeightRef.current;
            const unchanged = height === restoreLastHeightRef.current;

            restoreLastHeightRef.current = height;

            flatListRef.current?.scrollToOffset({ offset: height, animated: false });

            if (restoreStableTimerRef.current) {
                clearTimeout(restoreStableTimerRef.current);
            }
            restoreStableTimerRef.current = setTimeout(() => {
                cancelRestoreScroll();
            }, RESTORE_SCROLL_STABLE_DEBOUNCE_MS);

            if (grew) {
                restoreLastGrowthAtRef.current = now;
                restoreStablePassesRef.current = 0;
            } else if (unchanged) {
                restoreStablePassesRef.current += 1;
                if (
                    restoreStablePassesRef.current >= RESTORE_SCROLL_STABLE_PASSES ||
                    now - restoreLastGrowthAtRef.current >= RESTORE_SCROLL_STABLE_DEBOUNCE_MS ||
                    now - restoreStartedAtRef.current >= RESTORE_SCROLL_HARD_CAP_MS
                ) {
                    cancelRestoreScroll();
                }
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
    }, [hasRecipeInCurrentStreamRef]);

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

        if (restoreActiveRef.current && distanceFromBottom > SCROLL_THRESHOLD) {
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
