/**
 * Skeleton loader for recipe cards while searching.
 * Shows a placeholder with pulsing animation.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export function ChatRecipeCardSkeleton() {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();

        return () => animation.stop();
    }, [pulseAnim]);

    return (
        <View className="bg-white rounded-lg overflow-hidden shadow-sm border border-border-default mb-sm">
            <View className="flex-row">
                {/* Image skeleton */}
                <Animated.View
                    className="w-20 h-20 bg-grey-default"
                    style={{ opacity: pulseAnim }}
                />

                {/* Content skeleton */}
                <View className="flex-1 p-sm justify-center">
                    {/* Title skeleton */}
                    <Animated.View
                        className="h-4 bg-grey-default rounded mb-xs"
                        style={{ width: '80%', opacity: pulseAnim }}
                    />

                    {/* Metadata skeleton */}
                    <View className="flex-row items-center mt-xs gap-md">
                        <Animated.View
                            className="h-3 bg-grey-default rounded"
                            style={{ width: 60, opacity: pulseAnim }}
                        />
                        <Animated.View
                            className="h-3 bg-grey-default rounded"
                            style={{ width: 50, opacity: pulseAnim }}
                        />
                        <Animated.View
                            className="h-3 bg-grey-default rounded"
                            style={{ width: 30, opacity: pulseAnim }}
                        />
                    </View>
                </View>

                {/* Arrow skeleton */}
                <View className="justify-center pr-sm">
                    <Animated.View
                        className="w-6 h-6 bg-grey-default rounded"
                        style={{ opacity: pulseAnim }}
                    />
                </View>
            </View>
        </View>
    );
}
