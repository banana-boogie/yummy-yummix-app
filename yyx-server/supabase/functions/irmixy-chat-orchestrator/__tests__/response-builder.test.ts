/**
 * Response Builder Tests
 *
 * Verifies response shaping, message overrides, and history persistence behavior.
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import type { UserContext } from "../../_shared/irmixy-schemas.ts";
import { finalizeResponse } from "../response-builder.ts";

function createUserContext(
  overrides: Partial<UserContext> = {},
): UserContext {
  return {
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
    ...overrides,
  } as UserContext;
}

function createMockSupabase(options?: { throwOnInsertCall?: number }) {
  let insertCallCount = 0;
  const inserts: unknown[] = [];
  const tables: string[] = [];

  return {
    supabase: {
      from: (table: string) => {
        tables.push(table);
        return {
          insert: async (payload: unknown) => {
            insertCallCount += 1;
            if (options?.throwOnInsertCall === insertCallCount) {
              throw new Error("insert failed");
            }
            inserts.push(payload);
            return { data: null, error: null };
          },
        };
      },
    },
    inserts,
    tables,
  };
}

Deno.test("finalizeResponse skips history persistence when sessionId is undefined", async () => {
  const { supabase, inserts, tables } = createMockSupabase();
  const response = await finalizeResponse(
    supabase as unknown as any,
    undefined,
    "hello",
    "Assistant response",
    createUserContext(),
    undefined,
    undefined,
    [{ label: "Show more options", message: "Show more options" }],
  );

  assertEquals(response.message, "Assistant response");
  assertEquals(response.suggestions?.length, 1);
  assertEquals(response.isAIGenerated, undefined);
  assertEquals(tables.length, 0);
  assertEquals(inserts.length, 0);
});

Deno.test("finalizeResponse persists user and assistant messages when sessionId exists", async () => {
  const { supabase, inserts, tables } = createMockSupabase();
  const response = await finalizeResponse(
    supabase as unknown as any,
    "session-123",
    "Can you help me cook?",
    "Sure, let's do it.",
    createUserContext(),
    undefined,
    undefined,
    [{ label: "Show more options", message: "Show more options" }],
  );

  assertEquals(response.message, "Sure, let's do it.");
  assertEquals(response.isAIGenerated, undefined);
  assertEquals(tables, ["user_chat_messages", "user_chat_messages"]);
  assertEquals(inserts.length, 2);
  assertEquals(inserts[0], {
    session_id: "session-123",
    role: "user",
    content: "Can you help me cook?",
  });
  assertEquals(inserts[1], {
    session_id: "session-123",
    role: "assistant",
    content: "Sure, let's do it.",
    tool_calls: {
      suggestions: [{
        label: "Show more options",
        message: "Show more options",
      }],
    },
  });
});

Deno.test("finalizeResponse uses fixed short message when a custom recipe is present", async () => {
  const { supabase } = createMockSupabase();
  const response = await finalizeResponse(
    supabase as unknown as any,
    undefined,
    "make me a recipe",
    "This message should be overridden",
    createUserContext({ language: "en" }),
    undefined,
    {
      recipe: {
        schemaVersion: "1.0",
        suggestedName: "Weeknight Pasta",
        measurementSystem: "imperial",
        language: "en",
        ingredients: [],
        steps: [],
        totalTime: 20,
        difficulty: "easy",
        portions: 2,
        tags: ["quick"],
      },
    },
  );

  assertEquals(response.message, "Ready! Want to change anything?");
  assertEquals(response.customRecipe?.suggestedName, "Weeknight Pasta");
  assertEquals(response.isAIGenerated, true);
});

Deno.test("finalizeResponse propagates history insert failures", async () => {
  const { supabase } = createMockSupabase({ throwOnInsertCall: 1 });

  await assertRejects(
    () =>
      finalizeResponse(
        supabase as unknown as any,
        "session-123",
        "hello",
        "assistant",
        createUserContext(),
        undefined,
        undefined,
      ),
    Error,
    "insert failed",
  );
});
