/**
 * Rate Limiter Tests
 *
 * Tests for in-memory sliding window rate limiter.
 */

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { _clearRateLimits, checkRateLimit } from "../rate-limiter.ts";

Deno.test("checkRateLimit - allows first request", () => {
  _clearRateLimits();
  const result = checkRateLimit("user-1");
  assertEquals(result.allowed, true);
  assertEquals(result.retryAfterMs, undefined);
});

Deno.test("checkRateLimit - allows up to 60 requests per minute", () => {
  _clearRateLimits();
  for (let i = 0; i < 60; i++) {
    const result = checkRateLimit("user-2");
    assertEquals(result.allowed, true);
  }
});

Deno.test("checkRateLimit - blocks request 61", () => {
  _clearRateLimits();
  for (let i = 0; i < 60; i++) {
    checkRateLimit("user-3");
  }
  const result = checkRateLimit("user-3");
  assertEquals(result.allowed, false);
  assertEquals(typeof result.retryAfterMs, "number");
  assertEquals(result.retryAfterMs! > 0, true);
});

Deno.test("checkRateLimit - different users have separate limits", () => {
  _clearRateLimits();
  for (let i = 0; i < 60; i++) {
    checkRateLimit("user-4");
  }
  // user-4 is blocked
  assertEquals(checkRateLimit("user-4").allowed, false);
  // user-5 is not blocked
  assertEquals(checkRateLimit("user-5").allowed, true);
});
