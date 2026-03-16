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
  private paused = false;
  private pausedCallback: (() => void) | null = null;
  private pausedRemainingMs: number = 0;
  private pausedAt: number = 0;

  constructor(timeoutMs: number = 10000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Reset timer with new callback
   * Clears existing timer if any
   */
  reset(callback: () => void): void {
    this.clear();
    this.paused = false;
    this.pausedCallback = null;
    this.timeoutId = setTimeout(callback, this.timeoutMs);
  }

  /**
   * Pause the timer (e.g., during tool execution).
   * Saves remaining time so resume() can restart with correct duration.
   */
  pause(): void {
    if (this.paused || !this.timeoutId) return;
    this.paused = true;
    this.pausedAt = Date.now();
    // We can't read remaining time from setTimeout, so store the callback
    // and restart with full duration on resume (tool execution >> remaining time anyway)
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }

  /**
   * Resume the timer after a pause (e.g., after tool result + AI audio done).
   * Restarts with full timeout duration since the user needs fresh time to respond.
   */
  resume(callback: () => void): void {
    if (!this.paused) return;
    this.paused = false;
    this.pausedCallback = null;
    this.timeoutId = setTimeout(callback, this.timeoutMs);
  }

  /** Whether the timer is currently paused */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Clear the timer without triggering callback
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.paused = false;
    this.pausedCallback = null;
  }
}
