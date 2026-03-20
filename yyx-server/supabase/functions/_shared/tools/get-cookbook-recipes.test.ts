/**
 * Get Cookbook Recipes Tool Tests
 *
 * Tests for the get_cookbook_recipes tool.
 * Covers:
 * - Tool definition structure
 * - Returns notFound when cookbook doesn't exist
 * - Throws on unauthenticated user
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  getCookbookRecipes,
  getCookbookRecipesTool,
} from "./get-cookbook-recipes.ts";
import type { UserContext } from "../irmixy-schemas.ts";

// ============================================================
// Tool Definition Tests
// ============================================================

Deno.test("getCookbookRecipesTool: has correct name", () => {
  assertEquals(getCookbookRecipesTool.function.name, "get_cookbook_recipes");
});

Deno.test("getCookbookRecipesTool: has no required parameters", () => {
  assertEquals(getCookbookRecipesTool.function.parameters.required, []);
});

Deno.test("getCookbookRecipesTool: has description", () => {
  assertEquals(typeof getCookbookRecipesTool.function.description, "string");
  assertEquals(getCookbookRecipesTool.function.description.length > 0, true);
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

Deno.test("getCookbookRecipes: throws on unauthenticated user", async () => {
  const supabase = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  } as any;

  await assertRejects(
    () => getCookbookRecipes(supabase, {}, mockUserContext),
    Error,
    "User not authenticated",
  );
});

Deno.test("getCookbookRecipes: returns notFound when cookbook ID not found", async () => {
  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: any) => ({
          eq: (_col2: string, _val2: any) => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { message: "Not found", code: "PGRST116" },
              }),
          }),
        }),
      }),
    }),
  } as any;

  const result = await getCookbookRecipes(
    supabase,
    { cookbookId: "11111111-1111-4111-8111-111111111111" },
    mockUserContext,
  );

  assertEquals((result as any).notFound, true);
});

Deno.test("getCookbookRecipes: returns notFound when no cookbooks exist for name search", async () => {
  const supabase = {
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

  const result = await getCookbookRecipes(
    supabase,
    { cookbookName: "Nonexistent" },
    mockUserContext,
  );

  assertEquals((result as any).notFound, true);
});
