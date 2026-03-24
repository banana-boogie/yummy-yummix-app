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
};

export default notificationService;
