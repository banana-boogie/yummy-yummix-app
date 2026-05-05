import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { COLORS } from '@/constants/design-tokens';

export interface ShowUndoToastOptions {
    message: string;
    onUndo: () => void;
    duration?: number;
    undoLabel?: string;
}

interface UndoToastHandle {
    show: (opts: ShowUndoToastOptions) => void;
    hide: () => void;
}

// Module-level singleton — the imperative API delegates to whichever host is mounted.
const hostRef: { current: UndoToastHandle | null } = { current: null };

export function showUndoToast(opts: ShowUndoToastOptions): void {
    hostRef.current?.show(opts);
}

export function hideUndoToast(): void {
    hostRef.current?.hide();
}

export function UndoToastHost() {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [state, setState] = useState<ShowUndoToastOptions | null>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const animateOut = useCallback((onDone?: () => void) => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 20, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setVisible(false);
            setState(null);
            onDone?.();
        });
    }, [opacity, translateY]);

    const hide = useCallback(() => {
        clearTimer();
        animateOut();
    }, [clearTimer, animateOut]);

    const show = useCallback((opts: ShowUndoToastOptions) => {
        clearTimer();
        setState(opts);
        setVisible(true);
        opacity.setValue(0);
        translateY.setValue(20);
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const duration = opts.duration ?? 5000;
        timerRef.current = setTimeout(() => animateOut(), duration);
    }, [clearTimer, opacity, translateY, animateOut]);

    // Register this host as the singleton on mount
    useEffect(() => {
        const handle: UndoToastHandle = { show, hide };
        hostRef.current = handle;
        return () => {
            if (hostRef.current === handle) {
                hostRef.current = null;
            }
        };
    }, [show, hide]);

    useEffect(() => clearTimer, [clearTimer]);

    if (!visible || !state) return null;

    const handleUndoPress = () => {
        clearTimer();
        const cb = state.onUndo;
        animateOut(() => {
            cb();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        });
    };

    return (
        <Animated.View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 80,
                opacity,
                transform: [{ translateY }],
            }}
            className="px-md"
        >
            <View
                className="flex-row items-center bg-text-default rounded-lg px-md py-sm"
                style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
            >
                <Text preset="body" className="text-white flex-1" numberOfLines={1}>
                    {state.message}
                </Text>
                <TouchableOpacity
                    onPress={handleUndoPress}
                    accessibilityRole="button"
                    accessibilityLabel={state.undoLabel ?? 'Undo'}
                    className="px-sm py-xs"
                >
                    <Text preset="body" className="text-primary-default font-bold">
                        {state.undoLabel ?? 'Undo'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={hide}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss"
                    className="pl-sm"
                >
                    <Ionicons name="close" size={20} color={COLORS.background.default} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}
