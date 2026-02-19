/**
 * Action Builder Tests
 *
 * Tests for the action-builder module that converts tool results
 * into Action objects for the frontend.
 * Covers:
 * - Returns action with valid id when appActionResult is provided
 * - Returns empty array when no app action result
 * - Sets autoExecute: true for app_action results
 * - Generated id contains the action type
 * - Label is localized (en vs es)
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { buildActions } from "./action-builder.ts";

// ============================================================
// Positive-Path Tests
// ============================================================

Deno.test("buildActions - returns action with valid id when appActionResult is provided", () => {
  const actions = buildActions("en", {
    action: "share_recipe",
    params: { recipeId: "recipe-1" },
  });

  assertEquals(actions.length, 1);
  assertEquals(typeof actions[0].id, "string");
  assertEquals(actions[0].id.length > 0, true);
});

Deno.test("buildActions - returns empty array when no app action result", () => {
  const actions = buildActions("en");
  assertEquals(actions, []);
});

Deno.test("buildActions - returns empty array when appActionResult is undefined", () => {
  const actions = buildActions("es", undefined);
  assertEquals(actions, []);
});

Deno.test("buildActions - sets autoExecute true for app_action results", () => {
  const actions = buildActions("en", {
    action: "share_recipe",
    params: {},
  });

  assertEquals(actions[0].autoExecute, true);
});

Deno.test("buildActions - generated id contains the action type", () => {
  const actions = buildActions("en", {
    action: "share_recipe",
    params: {},
  });

  assertEquals(actions[0].id.includes("share_recipe"), true);
});

// ============================================================
// Localization Tests
// ============================================================

Deno.test("buildActions - label is localized to English", () => {
  const actions = buildActions("en", {
    action: "share_recipe",
    params: {},
  });

  assertEquals(actions[0].label, "Share Recipe");
});

Deno.test("buildActions - label is localized to Spanish", () => {
  const actions = buildActions("es", {
    action: "share_recipe",
    params: {},
  });

  assertEquals(actions[0].label, "Compartir Receta");
});
