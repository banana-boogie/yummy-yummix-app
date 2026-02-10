/**
 * Execute Tool Tests
 *
 * Tests for the shared tool dispatcher used by both irmixy-chat-orchestrator and irmixy-voice-orchestrator.
 * Covers:
 * - Negative paths: unknown tool, invalid JSON, empty name
 * - Positive path: search_recipes dispatch with mocked Supabase
 * - Error type correctness: all validation errors are ToolValidationError (→ 400)
 */

import {
  assertEquals,
  assertExists,
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

/**
 * Creates a chainable mock Supabase client that returns the given data
 * from any query. Supports the full chain used by searchRecipes:
 *   .from().select().eq().order().or().limit()
 */
function createChainableMockSupabase(mockData: unknown[] = []) {
  const terminal = { data: mockData, error: null };
  const chain: Record<string, any> = {};
  // Every method returns the chain, so any order works
  for (const method of ["select", "eq", "order", "lte", "or", "in", "limit"]) {
    chain[method] = (..._args: any[]) => chain;
  }
  // Terminal: await the chain resolves to { data, error }
  chain.then = (resolve: (v: any) => void) => resolve(terminal);
  return {
    from: (_table: string) => chain,
  } as any;
}

// ============================================================
// Negative-Path Tests
// ============================================================

Deno.test("executeTool - throws ToolValidationError for unknown tool", async () => {
  const supabase = createChainableMockSupabase();
  const userContext = createMockUserContext();

  const error = await assertRejects(
    () =>
      executeTool(supabase, "nonexistent_tool", "{}", userContext),
    ToolValidationError,
  );
  assertEquals(error.message, "Unknown tool: nonexistent_tool");
});

Deno.test("executeTool - throws ToolValidationError for invalid JSON args", async () => {
  const supabase = createChainableMockSupabase();
  const userContext = createMockUserContext();

  await assertRejects(
    () =>
      executeTool(
        supabase,
        "search_recipes",
        "not valid json{{{",
        userContext,
      ),
    ToolValidationError,
    "Invalid JSON in tool arguments",
  );
});

Deno.test("executeTool - throws ToolValidationError for empty tool name", async () => {
  const supabase = createChainableMockSupabase();
  const userContext = createMockUserContext();

  await assertRejects(
    () => executeTool(supabase, "", "{}", userContext),
    ToolValidationError,
    "Unknown tool: ",
  );
});

// ============================================================
// Positive-Path Tests
// ============================================================

Deno.test("executeTool - dispatches search_recipes and returns RecipeCard[]", async () => {
  const mockRecipes = [
    {
      id: "recipe-1",
      name_en: "Chicken Pasta",
      name_es: "Pasta con Pollo",
      image_url: "https://example.com/pasta.jpg",
      total_time: 30,
      difficulty: "easy",
      portions: 4,
      recipe_to_tag: [],
    },
    {
      id: "recipe-2",
      name_en: "Rice Bowl",
      name_es: "Tazón de Arroz",
      image_url: null,
      total_time: 20,
      difficulty: "easy",
      portions: 2,
      recipe_to_tag: [],
    },
  ];

  const supabase = createChainableMockSupabase(mockRecipes);
  const userContext = createMockUserContext();

  const result = await executeTool(
    supabase,
    "search_recipes",
    JSON.stringify({ query: "chicken" }),
    userContext,
  );

  // Should return RecipeCard[] — array with recipe data
  assertExists(result);
  const cards = result as Array<{ recipeId: string; name: string }>;
  assertEquals(cards.length, 2);
  assertEquals(cards[0].recipeId, "recipe-1");
  assertEquals(cards[0].name, "Chicken Pasta");
  assertEquals(cards[1].recipeId, "recipe-2");
  assertEquals(cards[1].name, "Rice Bowl");
});

Deno.test("executeTool - search_recipes returns empty array when no matches", async () => {
  const supabase = createChainableMockSupabase([]);
  const userContext = createMockUserContext();

  const result = await executeTool(
    supabase,
    "search_recipes",
    JSON.stringify({ query: "nonexistent dish" }),
    userContext,
  );

  assertEquals(result, []);
});

Deno.test("executeTool - search_recipes rejects when no query or filters", async () => {
  const supabase = createChainableMockSupabase();
  const userContext = createMockUserContext();

  await assertRejects(
    () =>
      executeTool(supabase, "search_recipes", "{}", userContext),
    ToolValidationError,
    "requires a query or at least one filter",
  );
});
