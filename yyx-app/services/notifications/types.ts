/**
 * Notification Service Interface
 *
 * Platform-specific implementations handle the actual notification delivery.
 * Native uses expo-notifications; web provides a no-op stub.
 */

export interface NotificationService {
  /** Fire an immediate local notification (e.g. foreground banner). */
  fireTimerNotification(title: string): Promise<void>;
  /** Schedule a notification to fire after `delaySeconds`. Returns an identifier for cancellation. */
  scheduleTimerNotification(title: string, delaySeconds: number): Promise<string | null>;
  /** Cancel a previously scheduled notification by identifier. */
  cancelNotification(id: string): Promise<void>;
}
