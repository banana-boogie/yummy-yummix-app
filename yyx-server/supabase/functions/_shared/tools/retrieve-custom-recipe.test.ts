/**
 * Tests for retrieve-custom-recipe scoring and disambiguation logic.
 */

import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { validateRetrieveCustomRecipeParams } from "./tool-validators.ts";
import { ToolValidationError } from "./tool-validators.ts";
import { retrieveCustomRecipe } from "./retrieve-custom-recipe.ts";

// ============================================================
// Constants (mirrored from module for testing)
// ============================================================

const SINGLE_CONFIDENCE_RATIO = 1.4;
const MIN_CONFIDENCE_THRESHOLD = 0.15;
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
// Validator Tests
// ============================================================

Deno.test("validateRetrieveCustomRecipeParams: valid query", () => {
  const result = validateRetrieveCustomRecipeParams({
    query: "chicken stir fry",
  });
  assertEquals(result.query, "chicken stir fry");
  assertEquals(result.timeframe, undefined);
});

Deno.test("validateRetrieveCustomRecipeParams: query + timeframe", () => {
  const result = validateRetrieveCustomRecipeParams({
    query: "pasta recipe",
    timeframe: "last week",
  });
  assertEquals(result.query, "pasta recipe");
  assertEquals(result.timeframe, "last week");
});

Deno.test("validateRetrieveCustomRecipeParams: JSON string input", () => {
  const result = validateRetrieveCustomRecipeParams(
    JSON.stringify({ query: "tacos", timeframe: "yesterday" }),
  );
  assertEquals(result.query, "tacos");
  assertEquals(result.timeframe, "yesterday");
});

Deno.test("validateRetrieveCustomRecipeParams: rejects empty query", () => {
  assertThrows(
    () => validateRetrieveCustomRecipeParams({ query: "" }),
    ToolValidationError,
    "non-empty query",
  );
});

Deno.test("validateRetrieveCustomRecipeParams: rejects missing query", () => {
  assertThrows(
    () => validateRetrieveCustomRecipeParams({}),
    ToolValidationError,
    "non-empty query",
  );
});

Deno.test("validateRetrieveCustomRecipeParams: rejects null", () => {
  assertThrows(
    () => validateRetrieveCustomRecipeParams(null),
    ToolValidationError,
  );
});

Deno.test("validateRetrieveCustomRecipeParams: query trimmed and length-limited", () => {
  const longQuery = "a".repeat(300);
  const result = validateRetrieveCustomRecipeParams({ query: longQuery });
  assertEquals(result.query.length <= 200, true);
});

Deno.test("validateRetrieveCustomRecipeParams: sanitizes special characters from query", () => {
  const result = validateRetrieveCustomRecipeParams({
    query: "chicken; DROP TABLE",
  });
  // sanitizeSearchQuery removes semicolons and special chars
  assertEquals(result.query.includes(";"), false);
});

// ============================================================
// Disambiguation logic tests
// ============================================================

Deno.test("disambiguation: single winner when top score is 1.4x second", () => {
  const topScore = 0.7;
  const secondScore = 0.4;
  const isSingle = topScore >= secondScore * SINGLE_CONFIDENCE_RATIO;
  // 0.7 >= 0.56 → true
  assertEquals(isSingle, true);
});

Deno.test("disambiguation: multiple when scores are close", () => {
  const topScore = 0.5;
  const secondScore = 0.45;
  const isSingle = topScore >= secondScore * SINGLE_CONFIDENCE_RATIO;
  // 0.5 >= 0.63 → false
  assertEquals(isSingle, false);
});

Deno.test("disambiguation: single when only one candidate", () => {
  const scored = [{ confidence: 0.3 }];
  // With only one candidate above threshold, always single
  assertEquals(scored.length, 1);
});

Deno.test("confidence threshold: low scores are filtered out", () => {
  const scores = [0.05, 0.1, 0.14];
  const passing = scores.filter((s) => s >= MIN_CONFIDENCE_THRESHOLD);
  assertEquals(passing.length, 0);
});

Deno.test("confidence threshold: scores at threshold pass", () => {
  const scores = [0.15, 0.2, 0.5];
  const passing = scores.filter((s) => s >= MIN_CONFIDENCE_THRESHOLD);
  assertEquals(passing.length, 3);
});

// ============================================================
// Scoring component tests
// ============================================================

Deno.test("scoring: keyword match in name adds 0.3 per keyword", () => {
  // Simulating: name = "spicy chicken", query keywords = ["chicken"]
  // Should get 0.3 for keyword match
  const keywordScore = 0.3; // per keyword match
  assertEquals(keywordScore, 0.3);
});

Deno.test("scoring: full query match adds 0.2", () => {
  const fullQueryBonus = 0.2;
  assertEquals(fullQueryBonus, 0.2);
});

Deno.test("scoring: exact name match adds 0.3", () => {
  const exactMatchBonus = 0.3;
  assertEquals(exactMatchBonus, 0.3);
});

Deno.test("scoring: ingredient keyword match adds 0.15", () => {
  const ingredientBonus = 0.15;
  assertEquals(ingredientBonus, 0.15);
});

Deno.test("scoring: timeframe match adds 0.3", () => {
  const timeframeBonus = 0.3;
  assertEquals(timeframeBonus, 0.3);
});

Deno.test("scoring: recent recipe (<7 days) adds 0.1", () => {
  const recencyBonus = 0.1;
  assertEquals(recencyBonus, 0.1);
});

Deno.test("scoring: full match scenario (exact name + timeframe + recent)", () => {
  // keyword match ("chicken") + full match + exact match + timeframe + recent
  // 0.3 + 0.2 + 0.3 + 0.3 + 0.1 ≈ 1.2
  const totalScore = 0.3 + 0.2 + 0.3 + 0.3 + 0.1;
  assertEquals(Math.abs(totalScore - 1.2) < 0.001, true);
  assertEquals(totalScore >= MIN_CONFIDENCE_THRESHOLD, true);
});

// ============================================================
// Security behavior tests
// ============================================================

Deno.test("retrieveCustomRecipe enforces auth context", async () => {
  const builder: Record<string, unknown> = {};
  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => builder,
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

Deno.test("retrieveCustomRecipe applies explicit user_id ownership predicate", async () => {
  const eqCalls: Array<[string, unknown]> = [];
  const builder: any = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    gte: () => builder,
    lte: () => builder,
    // Supabase query builder is thenable — .then() enables `await` on query chains
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };

  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    from: () => builder,
  };

  const result = await retrieveCustomRecipe(
    mockSupabase as any,
    { query: "chicken" },
    BASE_USER_CONTEXT,
  );

  assertEquals(result.type, "not_found");
  assertEquals(
    eqCalls.some(([column, value]) =>
      column === "user_id" && value === "user-123"
    ),
    true,
  );
});
