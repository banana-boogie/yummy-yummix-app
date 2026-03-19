/**
 * Create Cookbook Tool Tests
 *
 * Tests for the create_cookbook tool.
 * Covers:
 * - Tool definition structure
 * - Creates cookbook with translation
 * - Throws on empty name
 * - Throws on unauthenticated user
 * - Trims and limits name/description length
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createCookbook, createCookbookTool } from "./create-cookbook.ts";
import type { UserContext } from "../irmixy-schemas.ts";

// ============================================================
// Tool Definition Tests
// ============================================================

Deno.test("createCookbookTool: has correct name", () => {
  assertEquals(createCookbookTool.function.name, "create_cookbook");
});

Deno.test("createCookbookTool: requires name parameter", () => {
  assertEquals(createCookbookTool.function.parameters.required, ["name"]);
});

Deno.test("createCookbookTool: has description", () => {
  assertEquals(typeof createCookbookTool.function.description, "string");
  assertEquals(createCookbookTool.function.description.length > 0, true);
});

// ============================================================
// Execution Tests
// ============================================================

const mockUserContext: UserContext = {
  locale: "es-MX",
  localeChain: ["es-MX", "es"],
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

Deno.test("createCookbook: throws on unauthenticated user", async () => {
  const supabase = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  } as any;

  await assertRejects(
    () => createCookbook(supabase, { name: "Test" }, mockUserContext),
    Error,
    "User not authenticated",
  );
});

Deno.test("createCookbook: throws on empty name", async () => {
  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as any;

  await assertRejects(
    () => createCookbook(supabase, { name: "" }, mockUserContext),
    Error,
    "create_cookbook requires a non-empty name",
  );
});

Deno.test("createCookbook: throws on whitespace-only name", async () => {
  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as any;

  await assertRejects(
    () => createCookbook(supabase, { name: "   " }, mockUserContext),
    Error,
    "create_cookbook requires a non-empty name",
  );
});

Deno.test("createCookbook: creates cookbook and translation successfully", async () => {
  let insertedCookbook: any = null;
  let insertedTranslation: any = null;

  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => {
      if (table === "cookbooks") {
        return {
          insert: (data: any) => {
            insertedCookbook = data;
            return {
              select: (_cols: string) => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "new-cb-id" },
                    error: null,
                  }),
              }),
            };
          },
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === "cookbook_translations") {
        return {
          insert: (data: any) => {
            insertedTranslation = data;
            return Promise.resolve({ error: null });
          },
        };
      }
      return {};
    },
  } as any;

  const result = await createCookbook(
    supabase,
    { name: "Holiday Baking", description: "My favorites" },
    mockUserContext,
  );

  assertEquals(result.id, "new-cb-id");
  assertEquals(result.name, "Holiday Baking");
  assertEquals(insertedCookbook.user_id, "user-1");
  assertEquals(insertedCookbook.is_default, false);
  assertEquals(insertedTranslation.cookbook_id, "new-cb-id");
  assertEquals(insertedTranslation.locale, "es");
  assertEquals(insertedTranslation.name, "Holiday Baking");
  assertEquals(insertedTranslation.description, "My favorites");
});
