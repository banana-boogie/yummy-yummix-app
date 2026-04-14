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
import { buildSuggestions, finalizeResponse } from "../response-builder.ts";
import type { PlanContext } from "../plan-context.ts";

function createUserContext(
  overrides: Partial<UserContext> = {},
): UserContext {
  return {
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
  );

  assertEquals(response.message, "Assistant response");
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
    tool_calls: null,
  });
});

Deno.test("finalizeResponse preserves provided message when a custom recipe is present", async () => {
  const { supabase } = createMockSupabase();
  const response = await finalizeResponse(
    supabase as unknown as any,
    undefined,
    "make me a recipe",
    "Custom recipe is ready.",
    createUserContext({ locale: "en", localeChain: ["en"] }),
    undefined,
    {
      recipe: {
        schemaVersion: "1.0",
        suggestedName: "Weeknight Pasta",
        measurementSystem: "imperial",
        locale: "en",
        ingredients: [],
        steps: [],
        totalTime: 20,
        difficulty: "easy",
        portions: 2,
        tags: ["quick"],
      },
    },
  );

  assertEquals(response.message, "Custom recipe is ready.");
  assertEquals(response.customRecipe?.suggestedName, "Weeknight Pasta");
  assertEquals(response.isAIGenerated, true);
});

Deno.test("finalizeResponse persists actions in tool_calls when provided", async () => {
  const { supabase, inserts } = createMockSupabase();
  const actions = [
    {
      id: "share_recipe_123",
      type: "share_recipe" as const,
      label: "Share Recipe",
      payload: {},
      autoExecute: true,
    },
  ];
  const response = await finalizeResponse(
    supabase as unknown as any,
    "session-123",
    "Share this recipe",
    "Sure, sharing now!",
    createUserContext(),
    undefined,
    undefined,
    actions,
  );

  assertEquals(response.actions?.length, 1);
  assertEquals(response.actions?.[0].type, "share_recipe");
  // Check that actions are in the persisted tool_calls
  const assistantInsert = inserts[1] as Record<string, unknown>;
  const toolCalls = assistantInsert.tool_calls as Record<string, unknown>;
  assertEquals(Array.isArray(toolCalls.actions), true);
  assertEquals((toolCalls.actions as unknown[]).length, 1);
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

// ============================================================
// buildSuggestions — chip generation
// ============================================================

const samplePlanContext: PlanContext = {
  planId: "plan-1",
  weekStart: "2026-04-13",
  nextMeal: null,
};

Deno.test("buildSuggestions returns 1-3 EN chips for each category", () => {
  for (const category of ["recipe", "planner", "general"] as const) {
    const chips = buildSuggestions(category, "en");
    const n = chips.length;
    assertEquals(
      n >= 1 && n <= 3,
      true,
      `expected 1-3 chips for ${category}, got ${n}`,
    );
    for (const chip of chips) {
      assertEquals(typeof chip.label, "string");
      assertEquals(typeof chip.message, "string");
      // English chips should not contain accented Spanish characters
      assertEquals(
        /[¿¡áéíóúñ]/i.test(chip.label),
        false,
        `EN chip looks Spanish: ${chip.label}`,
      );
    }
  }
});

Deno.test("buildSuggestions returns Spanish chips when language is 'es'", () => {
  const chips = buildSuggestions("recipe", "es");
  assertEquals(chips.length >= 1 && chips.length <= 3, true);
  // At least one chip should contain a Spanish-specific character
  const hasSpanish = chips.some((c) =>
    /[¿¡áéíóúñ]/i.test(c.label) || /[¿¡áéíóúñ]/i.test(c.message)
  );
  assertEquals(
    hasSpanish,
    true,
    "expected at least one ES chip with Spanish characters",
  );
});

Deno.test("buildSuggestions differentiates planner category based on active plan", () => {
  const withPlan = buildSuggestions("planner", "en", samplePlanContext);
  const withoutPlan = buildSuggestions("planner", "en", null);
  assertEquals(withPlan.length >= 1 && withPlan.length <= 3, true);
  assertEquals(withoutPlan.length >= 1 && withoutPlan.length <= 3, true);
  // With a plan, we reference the existing week; without one, we offer to plan.
  const withPlanLabels = withPlan.map((c) => c.label).join(" | ");
  const withoutPlanLabels = withoutPlan.map((c) => c.label).join(" | ");
  assertEquals(withPlanLabels.includes("See my week"), true);
  assertEquals(withoutPlanLabels.includes("Plan my week"), true);
});

Deno.test("buildSuggestions general category varies based on active plan", () => {
  const withPlan = buildSuggestions("general", "en", samplePlanContext);
  const withoutPlan = buildSuggestions("general", "en", null);
  assertEquals(
    withPlan.map((c) => c.label).includes("See my week"),
    true,
  );
  assertEquals(
    withoutPlan.map((c) => c.label).includes("Plan my week"),
    true,
  );
});

// ============================================================
// finalizeResponse — suggestions persistence
// ============================================================

Deno.test("finalizeResponse persists suggestions in tool_calls when provided", async () => {
  const { supabase, inserts } = createMockSupabase();
  const suggestions = [
    { label: "Plan my week", message: "Help me plan my week" },
    { label: "Something quicker", message: "I want something quicker" },
  ];
  const response = await finalizeResponse(
    supabase as unknown as any,
    "session-123",
    "hi",
    "assistant text",
    createUserContext(),
    undefined,
    undefined,
    undefined,
    suggestions,
  );

  assertEquals(response.suggestions?.length, 2);
  const assistantInsert = inserts[1] as Record<string, unknown>;
  const toolCalls = assistantInsert.tool_calls as Record<string, unknown>;
  assertEquals(Array.isArray(toolCalls.suggestions), true);
  assertEquals((toolCalls.suggestions as unknown[]).length, 2);
});

Deno.test("finalizeResponse omits empty suggestions array from tool_calls", async () => {
  const { supabase, inserts } = createMockSupabase();
  await finalizeResponse(
    supabase as unknown as any,
    "session-123",
    "hi",
    "assistant text",
    createUserContext(),
    undefined,
    undefined,
    undefined,
    [],
  );

  const assistantInsert = inserts[1] as Record<string, unknown>;
  assertEquals(assistantInsert.tool_calls, null);
});
