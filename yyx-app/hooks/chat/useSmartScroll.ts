import { useState, useCallback, useRef, useEffect } from 'react';
import { FlatList } from 'react-native';

const SCROLL_THROTTLE_MS = 100;
const SCROLL_DELAY_MS = 100;
const SCROLL_THRESHOLD = 100;

interface UseSmartScrollParams {
    messagesLength: number;
    hasRecipeInCurrentStreamRef: React.MutableRefObject<boolean>;
}

export function useSmartScroll({
    messagesLength,
    hasRecipeInCurrentStreamRef,
}: UseSmartScrollParams) {
    const flatListRef = useRef<FlatList>(null);
    const lastScrollRef = useRef(0);
    const isNearBottomRef = useRef(true);
    const skipNextScrollToEndRef = useRef(false);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const scrollToEndThrottled = useCallback((animated: boolean) => {
        if (!isNearBottomRef.current && !animated) return;

        const now = Date.now();
        if (animated || now - lastScrollRef.current > SCROLL_THROTTLE_MS) {
            lastScrollRef.current = now;
            flatListRef.current?.scrollToEnd({ animated });
        }
    }, []);

    // Scroll to bottom when new messages arrive or content updates
    // Skip when recipe card is showing (keeps recipe card pinned at top)
    useEffect(() => {
        if (messagesLength > 0) {
            if (skipNextScrollToEndRef.current) {
                skipNextScrollToEndRef.current = false;
                return;
            }
            if (hasRecipeInCurrentStreamRef.current) return;
            setTimeout(() => {
                scrollToEndThrottled(true);
            }, SCROLL_DELAY_MS);
        }
    }, [messagesLength, scrollToEndThrottled, hasRecipeInCurrentStreamRef]);

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
        handleScroll,
        handleScrollToEnd,
        isNearBottomRef,
        skipNextScrollToEndRef,
    };
}
