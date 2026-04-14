import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface OfflineBannerProps {
    isOffline: boolean;
    pendingCount?: number;
    isSyncing?: boolean;
}

export function OfflineBanner({ isOffline, pendingCount = 0, isSyncing = false }: OfflineBannerProps) {
    const slideAnim = useRef(new Animated.Value(-60)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isOffline || isSyncing) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 12,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -60,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isOffline, isSyncing]);

    // Pulse animation for syncing indicator
    useEffect(() => {
        let animation: Animated.CompositeAnimation | null = null;

        if (isSyncing) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.6,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }

        return () => {
            animation?.stop();
        };
    }, [isSyncing]);

    if (!isOffline && !isSyncing) {
        return null;
    }

    const backgroundColor = isSyncing ? COLORS.primary.medium : COLORS.grey.dark;
    const iconName = isSyncing ? 'sync' : 'cloud-offline';
    const message = isSyncing
        ? i18n.t('shoppingList.syncing')
        : i18n.t('shoppingList.offline');

    return (
        <Animated.View
            style={{
                transform: [{ translateY: slideAnim }],
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
            }}
        >
            <View
                className="flex-row items-center justify-center px-md py-xs"
                style={{ backgroundColor }}
            >
                <Animated.View style={{ opacity: pulseAnim }}>
                    <Ionicons name={iconName} size={16} color={COLORS.neutral.white} />
                </Animated.View>
                <Text preset="caption" className="text-white ml-xs font-medium">
                    {message}
                </Text>
                {pendingCount > 0 && !isSyncing && (
                    <View className="ml-sm bg-white/20 px-xs py-xxs rounded-full">
                        <Text preset="caption" className="text-white font-semibold">
                            {i18n.t('shoppingList.pendingChanges', { count: pendingCount })}
                        </Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
}

export default OfflineBanner;
