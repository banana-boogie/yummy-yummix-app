/**
 * Logger Tests
 *
 * Verifies structured error logs include stack traces for debugging.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createLogger } from "../logger.ts";

Deno.test("createLogger.error - includes error stack and merged metadata", () => {
  const originalConsoleError = console.error;
  const calls: unknown[][] = [];

  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const logger = createLogger("req_test");
    const error = new Error("stream exploded");
    logger.error("Streaming error", error, { phase: "streaming" });
  } finally {
    console.error = originalConsoleError;
  }

  assertEquals(calls.length, 1);
  assertEquals(calls[0][0], "[req_test]");
  assertEquals(calls[0][1], "Streaming error");

  const payload = JSON.parse(String(calls[0][2])) as {
    name: string;
    message: string;
    stack?: string;
    phase?: string;
  };

  assertEquals(payload.name, "Error");
  assertEquals(payload.message, "stream exploded");
  assertEquals(payload.phase, "streaming");
  assertStringIncludes(payload.stack ?? "", "stream exploded");
});
