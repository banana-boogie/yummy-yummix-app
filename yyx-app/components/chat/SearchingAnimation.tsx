/**
 * Prominent centered animation shown when Irmixy is searching for recipes.
 * Uses a pulsing Irmixy avatar with search text.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Text } from '@/components/common/Text';
import { Image } from 'expo-image';
import { TypingDots } from '@/components/chat/TypingIndicator';
import i18n from '@/i18n';

export function SearchingAnimation() {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1.08,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0.6,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        );
        pulse.start();
        return () => pulse.stop();
    }, [scaleAnim, opacityAnim]);

    return (
        <View className="py-xl items-center justify-center">
            <Animated.View
                style={{
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                }}
            >
                <Image
                    source={require('@/assets/images/irmixy-avatar/irmixy-presenting.png')}
                    style={{ width: 80, height: 80 }}
                    contentFit="contain"
                />
            </Animated.View>
            <View className="flex-row items-center mt-md">
                <Text preset="body" className="text-text-secondary">
                    {i18n.t('chat.searching')}
                </Text>
                <TypingDots />
            </View>
        </View>
    );
}
