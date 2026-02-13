/**
 * IrmixyAvatar Component
 * 
 * Animated chef avatar with states for:
 * - idle: Default breathing animation
 * - listening: Pulsing glow while user speaks
 * - thinking: Gentle bounce
 * - speaking: Animated ring while AI speaks
 * 
 * Uses pure NativeWind for styling.
 */

import React, { useEffect, useRef } from 'react';
import { View, Image, Animated } from 'react-native';

// Avatar images for different states
const AVATAR_IMAGES = {
    idle: require('@/assets/images/irmixy-avatar/2.png'),
    listening: require('@/assets/images/irmixy-avatar/5.png'),
    thinking: require('@/assets/images/irmixy-avatar/4.png'),
    searching: require('@/assets/images/irmixy-avatar/4.png'),
    generating: require('@/assets/images/irmixy-avatar/4.png'),
    enriching: require('@/assets/images/irmixy-avatar/4.png'),
    speaking: require('@/assets/images/irmixy-avatar/3.png'),
};

export type AvatarState =
    | 'idle'
    | 'listening'
    | 'thinking'
    | 'searching'
    | 'generating'
    | 'enriching'
    | 'speaking';

interface Props {
    state: AvatarState;
    size?: number;
}

export function IrmixyAvatar({ state, size = 200 }: Props) {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const bounceAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Reset animations
        pulseAnim.setValue(1);
        glowAnim.setValue(0);
        bounceAnim.setValue(0);

        let animation: Animated.CompositeAnimation;

        switch (state) {
            case 'idle':
                animation = Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.02,
                            duration: 2000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 2000,
                            useNativeDriver: true,
                        }),
                    ])
                );
                break;

            case 'listening':
                animation = Animated.loop(
                    Animated.sequence([
                        Animated.timing(glowAnim, {
                            toValue: 1,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(glowAnim, {
                            toValue: 0.3,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                    ])
                );
                break;

            case 'thinking':
            case 'searching':
            case 'generating':
            case 'enriching':
                animation = Animated.loop(
                    Animated.sequence([
                        Animated.timing(bounceAnim, {
                            toValue: -5,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(bounceAnim, {
                            toValue: 0,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                    ])
                );
                break;

            case 'speaking':
                animation = Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.05,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                    ])
                );
                break;

            default:
                // Fallback to idle animation for unknown states
                animation = Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.02,
                            duration: 2000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 2000,
                            useNativeDriver: true,
                        }),
                    ])
                );
                break;
        }

        animation.start();

        return () => {
            animation.stop();
        };
    }, [state, pulseAnim, glowAnim, bounceAnim]);

    const avatarImage = AVATAR_IMAGES[state] || AVATAR_IMAGES.idle;

    return (
        <View
            className="items-center justify-center"
            style={{ width: size, height: size }}
        >
            {/* Glow ring for listening state */}
            {state === 'listening' && (
                <Animated.View
                    className="absolute bg-primary-light rounded-full"
                    style={{
                        width: size + 20,
                        height: size + 20,
                        opacity: glowAnim,
                    }}
                />
            )}

            {/* Speaking ring animation */}
            {state === 'speaking' && (
                <Animated.View
                    className="absolute border-[3px] border-primary-medium rounded-full"
                    style={{
                        width: size + 16,
                        height: size + 16,
                        transform: [{ scale: pulseAnim }],
                    }}
                />
            )}

            {/* Avatar image */}
            <Animated.View
                style={{
                    transform: [
                        { scale: pulseAnim },
                        { translateY: bounceAnim },
                    ],
                }}
            >
                <Image
                    source={avatarImage}
                    className="rounded-full"
                    style={{ width: size, height: size }}
                    resizeMode="contain"
                />
            </Animated.View>
        </View>
    );
}
