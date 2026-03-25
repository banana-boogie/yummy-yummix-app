/**
 * Web Notification Service (no-op stub)
 *
 * expo-notifications is not compatible with web/SSR.
 * This stub prevents build crashes from module-level browser API access.
 */

import type { NotificationService } from './types';

const notificationService: NotificationService = {
  async fireTimerNotification(_title: string): Promise<void> {
    // No-op on web — notifications not supported
  },
  async scheduleTimerNotification(_title: string, _delaySeconds: number): Promise<string | null> {
    return null;
  },
  async cancelNotification(_id: string): Promise<void> {
    // No-op on web
  },
};

export default notificationService;
