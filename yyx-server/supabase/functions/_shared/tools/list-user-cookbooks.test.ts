/**
 * List User Cookbooks Tool Tests
 *
 * Tests for the list_user_cookbooks tool.
 * Covers:
 * - Tool definition has correct structure
 * - Returns empty array when no cookbooks
 * - Returns cookbooks with recipe counts
 * - Resolves translated names using locale chain
 * - Throws on unauthenticated user
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  listUserCookbooks,
  listUserCookbooksTool,
} from "./list-user-cookbooks.ts";
import type { UserContext } from "../irmixy-schemas.ts";

// ============================================================
// Tool Definition Tests
// ============================================================

Deno.test("listUserCookbooksTool: has correct name", () => {
  assertEquals(listUserCookbooksTool.function.name, "list_user_cookbooks");
});

Deno.test("listUserCookbooksTool: has description", () => {
  assertEquals(typeof listUserCookbooksTool.function.description, "string");
  assertEquals(listUserCookbooksTool.function.description.length > 0, true);
});

Deno.test("listUserCookbooksTool: has no required parameters", () => {
  assertEquals(listUserCookbooksTool.function.parameters.required, []);
});

// ============================================================
// Execution Tests (with mock Supabase)
// ============================================================

const mockUserContext: UserContext = {
  locale: "es",
  localeChain: ["es"],
  language: "es",
  measurementSystem: "metric",
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

function createMockSupabase(options: {
  user?: { id: string } | null;
  cookbooks?: any[];
  error?: any;
}) {
  const cookbooks = options.cookbooks ?? [];
  return {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: options.user ?? null },
          error: null,
        }),
    },
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (_col: string, _val: any) => ({
          order: (_col2: string, _opts: any) => ({
            order: (_col3: string, _opts2: any) => {
              if (options.error) {
                return Promise.resolve({ data: null, error: options.error });
              }
              return Promise.resolve({ data: cookbooks, error: null });
            },
          }),
        }),
      }),
    }),
  } as any;
}

Deno.test("listUserCookbooks: throws when user not authenticated", async () => {
  const supabase = createMockSupabase({ user: null });
  await assertRejects(
    () => listUserCookbooks(supabase, {}, mockUserContext),
    Error,
    "User not authenticated",
  );
});

Deno.test("listUserCookbooks: returns empty array when no cookbooks", async () => {
  const supabase = createMockSupabase({
    user: { id: "user-1" },
    cookbooks: [],
  });
  const result = await listUserCookbooks(supabase, {}, mockUserContext);
  assertEquals(result, []);
});

Deno.test("listUserCookbooks: returns cookbooks with correct shape", async () => {
  const supabase = createMockSupabase({
    user: { id: "user-1" },
    cookbooks: [
      {
        id: "cb-1",
        is_default: true,
        translations: [{ locale: "es", name: "Favoritos" }],
        cookbook_recipes: [{ count: 2 }],
      },
      {
        id: "cb-2",
        is_default: false,
        translations: [{ locale: "es", name: "Cenas" }],
        cookbook_recipes: [{ count: 0 }],
      },
    ],
  });

  const result = await listUserCookbooks(supabase, {}, mockUserContext);
  assertEquals(result.length, 2);
  assertEquals(result[0].id, "cb-1");
  assertEquals(result[0].name, "Favoritos");
  assertEquals(result[0].recipeCount, 2);
  assertEquals(result[0].isDefault, true);
  assertEquals(result[1].name, "Cenas");
  assertEquals(result[1].recipeCount, 0);
  assertEquals(result[1].isDefault, false);
});

Deno.test("listUserCookbooks: falls back to first translation when locale not in chain", async () => {
  const supabase = createMockSupabase({
    user: { id: "user-1" },
    cookbooks: [
      {
        id: "cb-1",
        is_default: false,
        translations: [{ locale: "en", name: "Favorites" }],
        cookbook_recipes: [],
      },
    ],
  });

  // User locale chain is ['es'] but only 'en' translation exists
  const result = await listUserCookbooks(supabase, {}, mockUserContext);
  assertEquals(result[0].name, "Favorites");
});

Deno.test("listUserCookbooks: uses Untitled when no translations", async () => {
  const supabase = createMockSupabase({
    user: { id: "user-1" },
    cookbooks: [
      {
        id: "cb-1",
        is_default: false,
        translations: [],
        cookbook_recipes: [],
      },
    ],
  });

  const result = await listUserCookbooks(supabase, {}, mockUserContext);
  assertEquals(result[0].name, "Untitled");
});
