import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createContextBuilder } from "./context-builder.ts";

function createMockSupabase(
  response: { data: unknown; error: unknown },
) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => response,
  };

  return {
    from: () => builder,
  };
}

Deno.test("getResumableCookingSession returns mapped payload with sessionId + recipeType", async () => {
  const now = new Date().toISOString();
  const supabase = createMockSupabase({
    data: {
      id: "session-123",
      recipe_id: "recipe-456",
      recipe_type: "custom",
      recipe_name: "Chicken Tinga",
      current_step: 3,
      total_steps: 9,
      last_active_at: now,
    },
    error: null,
  });

  const builder = createContextBuilder(supabase as any);
  const session = await builder.getResumableCookingSession("user-abc");

  assertEquals(session, {
    sessionId: "session-123",
    recipeName: "Chicken Tinga",
    recipeType: "custom",
    currentStep: 3,
    totalSteps: 9,
    recipeId: "recipe-456",
  });
});

Deno.test("getResumableCookingSession defaults unknown recipe_type to database", async () => {
  const now = new Date().toISOString();
  const supabase = createMockSupabase({
    data: {
      id: "session-123",
      recipe_id: "recipe-456",
      recipe_type: "legacy_value",
      recipe_name: "Legacy recipe",
      current_step: 1,
      total_steps: 4,
      last_active_at: now,
    },
    error: null,
  });

  const builder = createContextBuilder(supabase as any);
  const session = await builder.getResumableCookingSession("user-abc");

  assertEquals(session?.recipeType, "database");
  assertEquals(session?.sessionId, "session-123");
});

Deno.test("getResumableCookingSession returns null for stale sessions (>24h)", async () => {
  const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const supabase = createMockSupabase({
    data: {
      id: "session-123",
      recipe_id: "recipe-456",
      recipe_type: "custom",
      recipe_name: "Old recipe",
      current_step: 2,
      total_steps: 8,
      last_active_at: stale,
    },
    error: null,
  });

  const builder = createContextBuilder(supabase as any);
  const session = await builder.getResumableCookingSession("user-abc");

  assertEquals(session, null);
});
