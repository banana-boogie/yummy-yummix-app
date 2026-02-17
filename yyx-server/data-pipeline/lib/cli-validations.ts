/**
 * Shared validation helpers for pipeline CLIs.
 */

export function assertRequiredApiKey(keyName: string, keyValue: string): void {
  if (!keyValue || !keyValue.trim()) {
    throw new Error(`${keyName} not configured`);
  }
}
