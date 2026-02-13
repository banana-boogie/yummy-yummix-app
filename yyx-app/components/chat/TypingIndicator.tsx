import React, { useRef, useEffect } from 'react';
import { View, Animated } from 'react-native';

/**
 * Animated typing dots indicator.
 * Shows three dots bouncing in sequence to indicate the assistant is thinking.
 */
export const TypingDots = React.memo(function TypingDots() {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDot = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    // Bounce up 4px over 200ms, then back down
                    Animated.timing(dot, { toValue: -4, duration: 200, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 200, useNativeDriver: true }),
                ])
            );
        };

        const animations = [
            animateDot(dot1, 0),
            animateDot(dot2, 150),
            animateDot(dot3, 300),
        ];

        animations.forEach(anim => anim.start());
        return () => animations.forEach(anim => anim.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Animated.Value refs are stable, no need to include in deps

    return (
        <View className="flex-row items-center ml-sm gap-1">
            <Animated.View className="w-2 h-2 bg-grey-medium rounded-full" style={{ transform: [{ translateY: dot1 }] }} />
            <Animated.View className="w-2 h-2 bg-grey-medium rounded-full" style={{ transform: [{ translateY: dot2 }] }} />
            <Animated.View className="w-2 h-2 bg-grey-medium rounded-full" style={{ transform: [{ translateY: dot3 }] }} />
        </View>
    );
});
