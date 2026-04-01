/**
 * Native Notification Service (iOS/Android)
 *
 * Uses expo-notifications for local push notifications.
 */

import * as Notifications from 'expo-notifications';
import type { NotificationService } from './types';

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

const notificationService: NotificationService = {
  async fireTimerNotification(title: string): Promise<void> {
    try {
      if (!(await ensurePermission())) return;
      await Notifications.scheduleNotificationAsync({
        content: { title, sound: 'default' },
        trigger: null,
      });
    } catch {
      // Fail silently — haptics still provide feedback
    }
  },

  async scheduleTimerNotification(title: string, delaySeconds: number): Promise<string | null> {
    try {
      if (!(await ensurePermission())) return null;
      return await Notifications.scheduleNotificationAsync({
        content: { title, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds },
      });
    } catch {
      return null;
    }
  },

  async cancelNotification(id: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Fail silently
    }
  },
};

export default notificationService;
