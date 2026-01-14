import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

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

/**
 * Hook for displaying toast notifications with haptic feedback.
 *
 * @example
 * const toast = useToast();
 * toast.showSuccess(i18n.t('shoppingList.itemAdded'));
 *
 * @example
 * toast.showError(
 *   i18n.t('common.errors.title'),
 *   i18n.t('common.errors.default'),
 *   { duration: 5000 }
 * );
 */
export function useToast(): UseToastReturn {
  /**
   * Shows a success toast with green background and checkmark icon.
   * Triggers success haptic feedback by default.
   */
  const showSuccess = useCallback((message: string, description?: string, options?: ToastOptions) => {
    // Trigger haptic feedback
    if (options?.haptic !== false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Toast.show({
      type: 'success',
      text1: message,
      text2: description,
      position: options?.position || 'top',
      visibilityTime: options?.duration || 3000,
      topOffset: 60, // Clear the header
      bottomOffset: 100, // Clear the tab bar
    });
  }, []);

  /**
   * Shows an error toast with red background and alert icon.
   * Triggers error haptic feedback by default.
   */
  const showError = useCallback((message: string, description?: string, options?: ToastOptions) => {
    // Trigger haptic feedback
    if (options?.haptic !== false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    Toast.show({
      type: 'error',
      text1: message,
      text2: description,
      position: options?.position || 'top',
      visibilityTime: options?.duration || 4000, // Longer for errors
      topOffset: 60,
      bottomOffset: 100,
    });
  }, []);

  /**
   * Shows an info toast with peach background and info icon.
   * Triggers light impact haptic feedback by default.
   */
  const showInfo = useCallback((message: string, description?: string, options?: ToastOptions) => {
    // Trigger haptic feedback
    if (options?.haptic !== false) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Toast.show({
      type: 'info',
      text1: message,
      text2: description,
      position: options?.position || 'top',
      visibilityTime: options?.duration || 3000,
      topOffset: 60,
      bottomOffset: 100,
    });
  }, []);

  /**
   * Shows a warning toast with orange background and warning icon.
   * Triggers warning haptic feedback by default.
   */
  const showWarning = useCallback((message: string, description?: string, options?: ToastOptions) => {
    // Trigger haptic feedback
    if (options?.haptic !== false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Toast.show({
      type: 'warning',
      text1: message,
      text2: description,
      position: options?.position || 'top',
      visibilityTime: options?.duration || 4000,
      topOffset: 60,
      bottomOffset: 100,
    });
  }, []);

  /**
   * Hides the currently displayed toast.
   */
  const hide = useCallback(() => {
    Toast.hide();
  }, []);

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    hide,
  };
}
