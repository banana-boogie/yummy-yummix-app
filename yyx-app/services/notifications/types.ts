/**
 * Notification Service Interface
 *
 * Platform-specific implementations handle the actual notification delivery.
 * Native uses expo-notifications; web provides a no-op stub.
 */

export interface NotificationService {
  /** Schedule an immediate local notification (e.g. timer done). */
  fireTimerNotification(title: string): Promise<void>;
}
