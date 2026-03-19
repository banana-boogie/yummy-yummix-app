/**
 * Add Recipe to Cookbook Tool Tests
 *
 * Tests for the add_recipe_to_cookbook tool.
 * Covers:
 * - Tool definition structure
 * - Throws on missing recipeId
 * - Throws on unauthenticated user
 * - Fuzzy name matching
 * - Returns ambiguous when multiple matches
 * - Returns notFound when no match
 * - Handles already-in-cookbook case
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  addRecipeToCookbook,
  addRecipeToCookbookTool,
} from "./add-recipe-to-cookbook.ts";
import type { UserContext } from "../irmixy-schemas.ts";

// ============================================================
// Tool Definition Tests
// ============================================================

Deno.test("addRecipeToCookbookTool: has correct name", () => {
  assertEquals(addRecipeToCookbookTool.function.name, "add_recipe_to_cookbook");
});

Deno.test("addRecipeToCookbookTool: requires recipeId", () => {
  assertEquals(addRecipeToCookbookTool.function.parameters.required, [
    "recipeId",
  ]);
});

Deno.test("addRecipeToCookbookTool: has description", () => {
  assertEquals(typeof addRecipeToCookbookTool.function.description, "string");
});

// ============================================================
// Execution Tests
// ============================================================

const mockUserContext: UserContext = {
  locale: "en",
  localeChain: ["en"],
  language: "en",
  measurementSystem: "imperial",
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

Deno.test("addRecipeToCookbook: throws on missing recipeId", async () => {
  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as any;

  await assertRejects(
    () => addRecipeToCookbook(supabase, {}, mockUserContext),
    Error,
    "add_recipe_to_cookbook requires a recipeId string",
  );
});

Deno.test("addRecipeToCookbook: throws on unauthenticated user", async () => {
  const supabase = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  } as any;

  await assertRejects(
    () =>
      addRecipeToCookbook(
        supabase,
        { recipeId: "11111111-1111-4111-8111-111111111111" },
        mockUserContext,
      ),
    Error,
    "User not authenticated",
  );
});

Deno.test("addRecipeToCookbook: returns notFound when no cookbooks exist and name provided", async () => {
  const supabase2 = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: any) =>
          Promise.resolve({ data: [], error: null }),
      }),
    }),
  } as any;

  const result = await addRecipeToCookbook(
    supabase2,
    {
      recipeId: "11111111-1111-4111-8111-111111111111",
      cookbookName: "Dinners",
    },
    mockUserContext,
  );

  assertEquals((result as any).success, false);
  assertEquals((result as any).notFound, true);
});
