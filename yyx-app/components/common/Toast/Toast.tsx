import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, View, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';

export interface ToastConfig {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastProps {
  toast: ToastConfig | null;
  onDismiss: () => void;
}

const ICON_MAP = {
  success: 'checkmark-circle' as const,
  error: 'alert-circle' as const,
  info: 'information-circle' as const,
};

const BG_COLOR_MAP = {
  success: COLORS.status.success,
  error: COLORS.status.error,
  info: COLORS.primary.medium,
};

// Default safe area top inset fallback
const DEFAULT_TOP_INSET = Platform.OS === 'ios' ? 50 : 24;

export function Toast({ toast, onDismiss }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [translateY, opacity, onDismiss]);

  useEffect(() => {
    if (toast) {
      // Show
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss
      const duration = toast.duration ?? 2500;
      timerRef.current = setTimeout(dismiss, duration);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [toast, translateY, opacity, dismiss]);

  if (!toast) return null;

  const type = toast.type ?? 'success';
  const bgColor = BG_COLOR_MAP[type];
  const icon = ICON_MAP[type];

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: DEFAULT_TOP_INSET + 8,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY }],
        opacity,
      }}
      pointerEvents="box-none"
    >
      <Pressable onPress={dismiss}>
        <View
          className="flex-row items-center rounded-lg px-md py-sm"
          style={{
            backgroundColor: bgColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Ionicons name={icon} size={20} color="#FFFFFF" />
          <Text
            preset="bodySmall"
            className="ml-sm flex-1"
            style={{ color: '#FFFFFF' }}
            numberOfLines={2}
          >
            {toast.message}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
