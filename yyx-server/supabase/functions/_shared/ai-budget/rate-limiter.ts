/**
 * In-Memory Rate Limiter
 *
 * Sliding window rate limiter (60 req/min per user).
 * No database — resets on cold start. Safety net only.
 */

const MAX_REQUESTS_PER_MINUTE = 60;
const WINDOW_MS = 60_000; // 1 minute

// Map<userId, timestamp[]> — stores request timestamps
const requestWindows = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks in long-running instances
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - WINDOW_MS;
  for (const [userId, timestamps] of requestWindows) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      requestWindows.delete(userId);
    } else {
      requestWindows.set(userId, valid);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

/**
 * Check if a user is within rate limits. If allowed, records the request.
 */
export function checkRateLimit(userId: string): RateLimitResult {
  cleanup();

  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let timestamps = requestWindows.get(userId);
  if (!timestamps) {
    timestamps = [];
    requestWindows.set(userId, timestamps);
  }

  // Remove expired timestamps
  const validStart = timestamps.findIndex((t) => t > cutoff);
  if (validStart > 0) {
    timestamps.splice(0, validStart);
  } else if (validStart === -1) {
    timestamps.length = 0;
  }

  if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    // Over limit — calculate retry-after from oldest valid timestamp
    const oldestValid = timestamps[0];
    const retryAfterMs = Math.max(1, (oldestValid + WINDOW_MS) - now);
    return { allowed: false, retryAfterMs };
  }

  // Record this request
  timestamps.push(now);
  return { allowed: true };
}

/** Exported for testing */
export function _clearRateLimits(): void {
  requestWindows.clear();
}
