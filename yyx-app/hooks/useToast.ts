import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { logger } from '@/services/logger';

export interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom';
  haptic?: boolean;
}

export interface UseToastReturn {
  showSuccess: (message: string, description?: string, options?: ToastOptions) => void;
  showError: (message: string, description?: string, options?: ToastOptions) => void;
  showInfo: (message: string, description?: string, options?: ToastOptions) => void;
  showWarning: (message: string, description?: string, options?: ToastOptions) => void;
  hide: () => void;
}

// Lightweight toast stub — uses haptics + silent console log; errors fall back to Alert.
// Full toast UI is tracked separately; kept as a no-op shim so call sites stay stable.
export function useToast(): UseToastReturn {
  const showSuccess = useCallback((message: string, description?: string, options?: ToastOptions) => {
    if (options?.haptic !== false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    logger.info('[toast:success]', message, description ?? '');
  }, []);

  const showError = useCallback((message: string, description?: string, options?: ToastOptions) => {
    if (options?.haptic !== false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    Alert.alert(message, description);
  }, []);

  const showInfo = useCallback((message: string, description?: string, _options?: ToastOptions) => {
    logger.info('[toast:info]', message, description ?? '');
  }, []);

  const showWarning = useCallback((message: string, description?: string, options?: ToastOptions) => {
    if (options?.haptic !== false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    logger.warn('[toast:warning]', message, description ?? '');
  }, []);

  const hide = useCallback(() => {}, []);

  return { showSuccess, showError, showInfo, showWarning, hide };
}
