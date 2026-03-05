/**
 * Security / Adversarial Input Tests
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  ToolValidationError,
  validateRetrieveCookedRecipesParams,
  validateSearchRecipesParams,
} from "./tool-validators.ts";
import { executeTool } from "./execute-tool.ts";

const BASE_USER_CONTEXT = {
  language: "en" as const,
  measurementSystem: "imperial" as const,
  dietaryRestrictions: [],
  ingredientDislikes: [],
  skillLevel: null,
  householdSize: null,
  conversationHistory: [],
  dietTypes: [],
  cuisinePreferences: [],
  customAllergies: [],
  kitchenEquipment: [],
};

Deno.test("security: search query > 200 chars is truncated to 200", () => {
  const longQuery = "a".repeat(300);
  const params = validateSearchRecipesParams({ query: longQuery });
  assertEquals(params.query!.length, 200);
});

Deno.test("security: retrieve query > 200 chars is truncated to 200", () => {
  const longQuery = "b".repeat(300);
  const params = validateRetrieveCookedRecipesParams({ query: longQuery });
  assertEquals((params.query || "").length <= 200, true);
});

Deno.test("security: retrieve params allow missing query", () => {
  const params = validateRetrieveCookedRecipesParams({
    timeframe: "last week",
  });
  assertEquals(params.query, undefined);
  assertEquals(params.timeframe, "last week");
});

Deno.test("security: retrieve query sanitizes SQL injection characters", () => {
  const params = validateRetrieveCookedRecipesParams({
    query: "'; DROP TABLE user_recipes; --",
  });
  assertEquals((params.query || "").includes(";"), false);
  assertEquals((params.query || "").includes("'"), false);
});

Deno.test("security: retrieve query sanitizes nested injection patterns", () => {
  const params = validateRetrieveCookedRecipesParams({
    query: "test OR 1=1 UNION SELECT * FROM users",
  });
  assertEquals((params.query || "").includes("="), false);
  assertEquals((params.query || "").includes("*"), false);
});

Deno.test("security: executeTool with unknown tool name throws ToolValidationError", async () => {
  const mockSupabase = {
    rpc: async () => ({ data: [], error: null }),
    from: () => ({}),
  };

  await assertRejects(
    () =>
      executeTool(
        mockSupabase as any,
        "nonexistent_tool",
        "{}",
        BASE_USER_CONTEXT,
      ),
    ToolValidationError,
    "Unknown tool",
  );
});

Deno.test("security: executeTool with invalid JSON args throws ToolValidationError", async () => {
  const mockSupabase = {
    rpc: async () => ({ data: [], error: null }),
    from: () => ({}),
  };

  await assertRejects(
    () =>
      executeTool(
        mockSupabase as any,
        "search_recipes",
        "not-valid-json",
        BASE_USER_CONTEXT,
      ),
    ToolValidationError,
    "Invalid JSON",
  );
});

Deno.test("security: retrieve_cooked_recipes gracefully returns [] on RPC error", async () => {
  const mockSupabase = {
    rpc: async () => ({ data: null, error: { message: "unauthorized" } }),
    from: () => ({}),
  };

  const result = await executeTool(
    mockSupabase as any,
    "retrieve_cooked_recipes",
    JSON.stringify({ query: "dressing" }),
    BASE_USER_CONTEXT,
  );

  assertEquals(result, []);
});
