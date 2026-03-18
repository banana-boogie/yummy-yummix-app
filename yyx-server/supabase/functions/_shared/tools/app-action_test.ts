/**
 * App Action Tool Tests
 *
 * Tests for the app-action pass-through tool that validates
 * frontend action types against an allow-list.
 * Covers:
 * - Known action types pass through
 * - Unknown action types are rejected
 * - Returned structure has correct shape
 * - Non-object arguments are rejected
 * - Missing params default to empty object
 */

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { executeAppAction } from "./app-action.ts";

// ============================================================
// Positive-Path Tests
// ============================================================

Deno.test("executeAppAction - validates known action type share_recipe", () => {
  const result = executeAppAction({ action: "share_recipe" });
  assertEquals(result.action, "share_recipe");
});

Deno.test("executeAppAction - returns validated structure with correct shape", () => {
  const result = executeAppAction({
    action: "share_recipe",
    params: { recipeId: "abc-123" },
  });

  assertEquals(result.action, "share_recipe");
  assertEquals(typeof result.params, "object");
  assertEquals(result.params.recipeId, "abc-123");
  // Ensure no extra keys leak into the result
  assertEquals(Object.keys(result).sort(), ["action", "params"]);
});

Deno.test("executeAppAction - handles missing params gracefully by defaulting to empty object", () => {
  const result = executeAppAction({ action: "share_recipe" });
  assertEquals(result.params, {});
});

// ============================================================
// Negative-Path Tests
// ============================================================

Deno.test("executeAppAction - rejects unknown action types", () => {
  assertThrows(
    () => executeAppAction({ action: "delete_everything" }),
    Error,
    "Unknown action type: delete_everything",
  );
});

Deno.test("executeAppAction - requires object argument, throws on null", () => {
  assertThrows(
    () => executeAppAction(null),
    Error,
    "app_action requires an object argument",
  );
});

Deno.test("executeAppAction - requires object argument, throws on string", () => {
  assertThrows(
    () => executeAppAction("share_recipe"),
    Error,
    "app_action requires an object argument",
  );
});
