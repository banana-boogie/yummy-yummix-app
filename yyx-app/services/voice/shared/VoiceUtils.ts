/**
 * Shared utilities for voice providers
 *
 * Voice instructions (personality, rules, tool usage) are built server-side in
 * system-prompt-builder.ts and returned in the start_session response.
 * This file contains client-only utilities: goodbye detection and inactivity timer.
 */

/**
 * Keywords that indicate user wants to end conversation
 * Supports both English and Spanish
 */
export const GOODBYE_KEYWORDS = [
  'bye', 'goodbye', 'good bye', 'see you',
  "that's all", 'thats all', 'that is all',
  "i'm done", 'im done', "we're done", 'were done',
  'adiós', 'adios', 'hasta luego',
  'eso es todo', 'ya terminé', 'ya termine', 'terminamos'
];

/**
 * Detect if transcript contains goodbye intent
 */
export function detectGoodbye(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  return GOODBYE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Inactivity timer helper
 * Automatically ends conversation after period of silence
 */
export class InactivityTimer {
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = 10000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Reset timer with new callback
   * Clears existing timer if any
   */
  reset(callback: () => void): void {
    this.clear();
    this.timeoutId = setTimeout(callback, this.timeoutMs);
  }

  /**
   * Clear the timer without triggering callback
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
