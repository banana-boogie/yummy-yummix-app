import { useState, useCallback, useRef } from 'react';
import { FlatList } from 'react-native';

const SCROLL_THROTTLE_MS = 100;
const SCROLL_THRESHOLD = 100;

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

    const handleScroll = useCallback((event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

        const isNearBottom = distanceFromBottom <= SCROLL_THRESHOLD;
        isNearBottomRef.current = isNearBottom;

        setShowScrollButton(!isNearBottom && contentSize.height > layoutMeasurement.height);
    }, []);

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
    };
}
