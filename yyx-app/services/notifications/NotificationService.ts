/**
 * Native Notification Service (iOS/Android)
 *
 * Uses expo-notifications for local push notifications.
 */

import * as Notifications from 'expo-notifications';
import type { NotificationService } from './types';

const notificationService: NotificationService = {
  async fireTimerNotification(title: string): Promise<void> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          sound: 'default',
        },
        trigger: null,
      });
    } catch {
      // Fail silently — haptics still provide feedback
    }
  },
};

export default notificationService;
