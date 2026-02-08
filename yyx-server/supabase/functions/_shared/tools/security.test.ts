/**
 * Security / Adversarial Input Tests
 *
 * Covers Section 9.6 requirements: auth enforcement, oversized input rejection,
 * SQL injection sanitization, and missing auth context handling.
 */

import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { retrieveCustomRecipe } from "./retrieve-custom-recipe.ts";
import {
  ToolValidationError,
  validateRetrieveCustomRecipeParams,
  validateSearchRecipesParams,
} from "./tool-validators.ts";
import { executeTool } from "./execute-tool.ts";

// ============================================================
// Shared test fixtures
// ============================================================

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

// ============================================================
// 1. retrieve_custom_recipe rejects when no authenticated user
// ============================================================

Deno.test("security: retrieve_custom_recipe rejects unauthenticated user", async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => ({}),
  };

  await assertRejects(
    () =>
      retrieveCustomRecipe(
        mockSupabase as any,
        { query: "chicken" },
        BASE_USER_CONTEXT,
      ),
    Error,
    "Authenticated user required",
  );
});

Deno.test("security: retrieve_custom_recipe rejects on auth error", async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: new Error("Token expired"),
      }),
    },
    from: () => ({}),
  };

  await assertRejects(
    () =>
      retrieveCustomRecipe(
        mockSupabase as any,
        { query: "pasta" },
        BASE_USER_CONTEXT,
      ),
    Error,
    "Authenticated user required",
  );
});

// ============================================================
// 2. validateSearchRecipesParams rejects query > 200 chars
// ============================================================

Deno.test("security: search query > 200 chars is truncated to 200", () => {
  const longQuery = "a".repeat(300);
  const params = validateSearchRecipesParams({ query: longQuery });
  assertEquals(params.query!.length, 200);
});

// ============================================================
// 3. validateRetrieveCustomRecipeParams rejects query > 200 chars
// ============================================================

Deno.test("security: retrieve query > 200 chars is truncated to 200", () => {
  const longQuery = "b".repeat(300);
  const params = validateRetrieveCustomRecipeParams({ query: longQuery });
  assertEquals(params.query.length <= 200, true);
});

// ============================================================
// 4. validateRetrieveCustomRecipeParams sanitizes SQL injection
// ============================================================

Deno.test("security: retrieve query sanitizes SQL injection characters", () => {
  const params = validateRetrieveCustomRecipeParams({
    query: "'; DROP TABLE user_recipes; --",
  });
  // sanitizeSearchQuery strips semicolons, quotes, and other non-alphanumeric chars
  // (hyphens are allowed by the sanitizer, which is safe for PostgREST filters)
  assertEquals(params.query.includes(";"), false);
  assertEquals(params.query.includes("'"), false);
});

Deno.test("security: retrieve query sanitizes nested injection patterns", () => {
  const params = validateRetrieveCustomRecipeParams({
    query: "test OR 1=1 UNION SELECT * FROM users",
  });
  // Special chars (=, *) are stripped; letters/numbers/spaces preserved
  assertEquals(params.query.includes("="), false);
  assertEquals(params.query.includes("*"), false);
});

// ============================================================
// 5. Tool execution with missing auth context returns error
// ============================================================

Deno.test("security: executeTool with unknown tool name throws ToolValidationError", async () => {
  const mockSupabase = {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: () => ({}),
  };

  await assertRejects(
    () =>
      executeTool(
        mockSupabase as any,
        "nonexistent_tool",
        "{}",
        BASE_USER_CONTEXT,
        "fake-key",
      ),
    ToolValidationError,
    "Unknown tool",
  );
});

Deno.test("security: executeTool with invalid JSON args throws ToolValidationError", async () => {
  const mockSupabase = {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: () => ({}),
  };

  await assertRejects(
    () =>
      executeTool(
        mockSupabase as any,
        "search_recipes",
        "not-valid-json",
        BASE_USER_CONTEXT,
        "fake-key",
      ),
    ToolValidationError,
    "Invalid JSON",
  );
});

Deno.test("security: retrieve_custom_recipe via executeTool rejects without auth", async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => ({}),
  };

  await assertRejects(
    () =>
      executeTool(
        mockSupabase as any,
        "retrieve_custom_recipe",
        JSON.stringify({ query: "chicken" }),
        BASE_USER_CONTEXT,
        "fake-key",
      ),
    Error,
    "Authenticated user required",
  );
});
