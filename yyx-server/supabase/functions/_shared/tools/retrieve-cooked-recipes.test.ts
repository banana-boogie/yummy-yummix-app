import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { retrieveCookedRecipes } from "./retrieve-cooked-recipes.ts";

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

Deno.test("retrieveCookedRecipes maps RPC rows into RecipeCard[]", async () => {
  let calledRpc: string | null = null;
  let calledParams: Record<string, unknown> | null = null;

  const mockSupabase = {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      calledRpc = fn;
      calledParams = params;
      return {
        data: [
          {
            recipe_id: "11111111-1111-4111-8111-111111111111",
            recipe_table: "recipes",
            name: "Chipotle Dressing",
            image_url: "https://example.com/dressing.jpg",
            total_time: 8,
            difficulty: "easy",
            portions: 4,
            last_cooked_at: "2026-02-10T12:00:00.000Z",
          },
          {
            recipe_id: "22222222-2222-4222-8222-222222222222",
            recipe_table: "user_recipes",
            name: "Irmixy Green Sauce",
            image_url: null,
            total_time: 12,
            difficulty: "medium",
            portions: 2,
            last_cooked_at: "2026-02-09T12:00:00.000Z",
          },
        ],
        error: null,
      };
    },
  };

  const result = await retrieveCookedRecipes(
    mockSupabase as any,
    { query: "dressing" },
    BASE_USER_CONTEXT,
  );

  assertEquals(calledRpc, "get_cooked_recipes");
  assertEquals(calledParams?.["p_query"], "dressing");
  assertEquals(result.length, 2);
  assertEquals(result[0].recipeId, "11111111-1111-4111-8111-111111111111");
  assertEquals(result[0].recipeTable, "recipes");
  assertEquals(result[1].recipeTable, "user_recipes");
});

Deno.test("retrieveCookedRecipes sends null query when omitted", async () => {
  let calledParams: Record<string, unknown> | null = null;

  const mockSupabase = {
    rpc: async (_fn: string, params: Record<string, unknown>) => {
      calledParams = params;
      return { data: [], error: null };
    },
  };

  await retrieveCookedRecipes(
    mockSupabase as any,
    { timeframe: "last week" },
    BASE_USER_CONTEXT,
  );

  assertEquals(calledParams?.["p_query"], null);
  assertExists(calledParams?.["p_after"]);
  assertExists(calledParams?.["p_before"]);
});

Deno.test("retrieveCookedRecipes returns [] on RPC error", async () => {
  const mockSupabase = {
    rpc: async () => ({
      data: null,
      error: { message: "permission denied" },
    }),
  };

  const result = await retrieveCookedRecipes(
    mockSupabase as any,
    { query: "pasta" },
    BASE_USER_CONTEXT,
  );

  assertEquals(result, []);
});
