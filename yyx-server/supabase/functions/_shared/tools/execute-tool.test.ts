/**
 * Execute Tool Tests
 *
 * Tests for the shared tool dispatcher used by both ai-orchestrator and voice-tool-execute.
 * Covers dispatch routing, JSON parse errors, and unknown tool handling.
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ToolValidationError } from "./tool-validators.ts";
import { executeTool } from "./execute-tool.ts";

// ============================================================
// Test Data Helpers
// ============================================================

function createMockUserContext() {
  return {
    language: "en" as const,
    measurementSystem: "imperial" as const,
    dietaryRestrictions: [],
    ingredientDislikes: [],
    skillLevel: null,
    householdSize: null,
    conversationHistory: [],
    dietTypes: [],
    customAllergies: [],
    kitchenEquipment: [],
    cuisinePreferences: [],
  };
}

// Minimal mock Supabase client — only needs to satisfy the type
function createMockSupabaseClient() {
  return {} as any;
}

// ============================================================
// Dispatch Tests
// ============================================================

Deno.test("executeTool - throws ToolValidationError for unknown tool", async () => {
  const supabase = createMockSupabaseClient();
  const userContext = createMockUserContext();

  const error = await assertRejects(
    () => executeTool(supabase, "nonexistent_tool", "{}", userContext, "fake-key"),
    ToolValidationError,
  );
  assertEquals(error.message, "Unknown tool: nonexistent_tool");
});

Deno.test("executeTool - throws ToolValidationError for invalid JSON args", async () => {
  const supabase = createMockSupabaseClient();
  const userContext = createMockUserContext();

  await assertRejects(
    () => executeTool(supabase, "search_recipes", "not valid json{{{", userContext, "fake-key"),
    ToolValidationError,
    "Invalid JSON in tool arguments",
  );
});

Deno.test("executeTool - throws ToolValidationError for empty tool name", async () => {
  const supabase = createMockSupabaseClient();
  const userContext = createMockUserContext();

  await assertRejects(
    () => executeTool(supabase, "", "{}", userContext, "fake-key"),
    ToolValidationError,
    "Unknown tool: ",
  );
});
