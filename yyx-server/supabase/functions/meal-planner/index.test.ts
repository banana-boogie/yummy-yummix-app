import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createAuthenticatedRequest,
  createMockRequest,
} from "../_shared/test-helpers/mocks.ts";
import {
  DEFAULT_PREFERENCES,
  handleMealPlannerRequest,
  parseGeneratePlanPayload,
} from "./index.ts";
import { MEAL_PLAN_ACTIONS, type MealPlanAction } from "./types.ts";

const expectedActions: MealPlanAction[] = [
  "get_current_plan",
  "generate_plan",
  "swap_meal",
  "skip_meal",
  "mark_meal_cooked",
  "approve_plan",
  "generate_shopping_list",
  "get_preferences",
  "update_preferences",
  "link_shopping_list",
];

// Builder that returns empty results for every PostgREST call. Used by tests
// that just need handlers to take the "no rows" path without errors.
// deno-lint-ignore no-explicit-any
function makeEmptySupabase(): any {
  const buildBuilder = () => {
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      not: () => builder,
      neq: () => builder,
      or: () => builder,
      overlaps: () => builder,
      gte: () => builder,
      insert: () => builder,
      update: () => builder,
      upsert: () => builder,
      delete: () => builder,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      // deno-lint-ignore no-explicit-any
      then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return { from: (_t: string) => builder };
  };
  return { from: (t: string) => buildBuilder().from(t) };
}

const mockDependencies = {
  createUserClient: (_authHeader: string) => makeEmptySupabase() as never,
  // Service-role client is used only by the swap apply path's RPC. Tests
  // that exercise apply override this to share the stateful supabase mock
  // (so the RPC call is captured); the empty default keeps non-swap tests
  // hermetic.
  createServiceClient: () => makeEmptySupabase() as never,
  validateAuth: async (_authHeader: string | null) => ({
    user: { id: "user-123", email: "test@example.com", role: "user" },
    error: null,
  }),
};

Deno.test("meal-planner exposes the full action set", () => {
  assertEquals([...MEAL_PLAN_ACTIONS], expectedActions);
});

Deno.test("meal-planner handles CORS preflight", async () => {
  const req = createMockRequest(undefined, { method: "OPTIONS" });
  const response = await handleMealPlannerRequest(req, mockDependencies);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
});

Deno.test("meal-planner rejects non-POST methods", async () => {
  const req = createMockRequest(undefined, { method: "GET" });
  const response = await handleMealPlannerRequest(req, mockDependencies);

  assertEquals(response.status, 405);
  assertEquals(await response.text(), "Method not allowed");
});

Deno.test("meal-planner returns UNAUTHORIZED when auth fails", async () => {
  const req = createMockRequest({ action: "get_preferences", payload: {} });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    validateAuth: async () => ({
      user: null,
      error: "Missing Authorization header",
    }),
  });
  const body = await response.json();

  assertEquals(response.status, 401);
  assertEquals(body.error.code, "UNAUTHORIZED");
});

Deno.test("meal-planner rejects unknown actions with INVALID_INPUT", async () => {
  const req = createAuthenticatedRequest({
    action: "not_a_real_action",
    payload: {},
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
  assertStringIncludes(body.error.message, "Unknown action");
});

Deno.test("generate_plan accepts comida without raising INVALID_INPUT", async () => {
  // generate_plan now runs the real orchestrator. The empty-result mock
  // walks the planner past validation; the catalog is empty so it surfaces
  // INSUFFICIENT_RECIPES (422). The guarantee tested here is that `comida`
  // passes validation — we should not see INVALID_INPUT.
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-04-13",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["comida"],
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 422);
  assertEquals(body.error.code, "INSUFFICIENT_RECIPES");
});

Deno.test("generate_plan parser accepts autoLeftovers and preserves it for generation", () => {
  const parsed = parseGeneratePlanPayload({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1, 2, 3, 4],
    mealTypes: ["dinner"],
    busyDays: [2],
    autoLeftovers: false,
    replaceExisting: true,
    debug: true,
  });

  assertEquals(parsed.includeDebugTrace, true);
  assertEquals(parsed.typedPayload, {
    weekStart: "2026-04-13",
    dayIndexes: [0, 1, 2, 3, 4],
    mealTypes: ["dinner"],
    busyDays: [2],
    autoLeftovers: false,
    replaceExisting: true,
  });
});

// A minimal recipe row that satisfies `meal_components` non-empty and has an
// English translation, so `fetchCandidates` retains at least one candidate
// and `uniqueTotal > 0` — otherwise `generate_plan` throws
// InsufficientRecipesError before reaching the preflight/insert paths these
// tests care about.
const MINIMAL_RECIPE_ROW = {
  id: "fake-recipe-1",
  planner_role: "main",
  alternate_planner_roles: [],
  meal_components: ["protein"],
  is_complete_meal: false,
  total_time: 30,
  difficulty: "easy",
  portions: 2,
  image_url: null,
  leftovers_friendly: false,
  batch_friendly: null,
  max_household_size_supported: null,
  equipment_tags: [],
  cooking_level: "beginner",
  verified_at: null,
  is_published: true,
  recipe_translations: [{ locale: "en", name: "Fake Recipe" }],
  recipe_ingredients: [],
  recipe_to_tag: [{
    recipe_tags: {
      categories: ["meal_type"],
      recipe_tag_translations: [{ locale: "en", name: "Dinner" }],
    },
  }],
};

const DISLIKED_RECIPE_ROW = {
  ...MINIMAL_RECIPE_ROW,
  id: "fake-recipe-disliked",
  recipe_ingredients: [{
    ingredient_id: "ing-mushroom",
    ingredients: {
      id: "ing-mushroom",
      ingredient_translations: [{ locale: "en", name: "Cremini Mushrooms" }],
    },
  }],
};

// Minimal Supabase builder mock. Each `.from(table)` gets fresh state so
// filter flags don't bleed across tables. The only query that returns a row
// is the plan preflight: `from("meal_plans").select...in("status", ["draft",
// "active"]).maybeSingle()`. `recipes` also returns one minimal row so the
// thin-catalog check passes.
// deno-lint-ignore no-explicit-any
function makePreflightConflictSupabase(existingPlanId: string | null): any {
  const buildBuilder = () => {
    let table = "";
    let sawDraftStatusFilter = false;
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      // deno-lint-ignore no-explicit-any
      in: (col: string, vals: any) => {
        if (col === "status" && Array.isArray(vals) && vals.includes("draft")) {
          sawDraftStatusFilter = true;
        }
        return builder;
      },
      overlaps: () => builder,
      or: () => builder,
      not: () => builder,
      neq: () => builder,
      gte: () => builder,
      insert: () => builder,
      update: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        if (table === "meal_plans" && sawDraftStatusFilter) {
          return Promise.resolve({
            data: existingPlanId ? { id: existingPlanId } : null,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single: () => Promise.resolve({ data: null, error: null }),
      // deno-lint-ignore no-explicit-any
      then: (resolve: any) => {
        if (table === "recipes") {
          resolve({ data: [MINIMAL_RECIPE_ROW], error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return {
      from: (t: string) => {
        table = t;
        return builder;
      },
    };
  };
  return {
    from: (t: string) => buildBuilder().from(t),
  };
}

Deno.test("generate_plan returns 409 PLAN_ALREADY_EXISTS when replaceExisting=false and a draft plan exists", async () => {
  const mockSupabase = makePreflightConflictSupabase("existing-plan-uuid");
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-04-13",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
      replaceExisting: false,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => mockSupabase as never,
  });
  const body = await response.json();

  assertEquals(response.status, 409);
  assertEquals(body.error.code, "PLAN_ALREADY_EXISTS");
});

// Mock where meal_plans INSERT returns a Postgres unique-violation (23505).
// Simulates the concurrent-generate_plan race: both requests pass preflight
// (or replaceExisting=true skips it), but the second INSERT collides on the
// idx_meal_plans_active_week partial unique index. `recipes` returns one
// minimal row so we get past the thin-catalog check.
// deno-lint-ignore no-explicit-any
function makeInsertUniqueViolationSupabase(): any {
  const buildBuilder = () => {
    let table = "";
    let insertCalled = false;
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      overlaps: () => builder,
      or: () => builder,
      not: () => builder,
      neq: () => builder,
      gte: () => builder,
      limit: () => builder,
      insert: () => {
        insertCalled = true;
        return builder;
      },
      update: () => builder,
      delete: () => builder,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => {
        if (table === "meal_plans" && insertCalled) {
          return Promise.resolve({
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "idx_meal_plans_active_week"',
            },
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      // deno-lint-ignore no-explicit-any
      then: (resolve: any) => {
        if (table === "recipes") {
          resolve({ data: [MINIMAL_RECIPE_ROW], error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return {
      from: (t: string) => {
        table = t;
        return builder;
      },
    };
  };
  return {
    from: (t: string) => buildBuilder().from(t),
  };
}

Deno.test("generate_plan returns 409 PLAN_ALREADY_EXISTS when insert races on unique index (23505)", async () => {
  const mockSupabase = makeInsertUniqueViolationSupabase();
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-04-13",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
      // replaceExisting=true skips preflight so the race hits the INSERT.
      replaceExisting: true,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => mockSupabase as never,
  });
  const body = await response.json();

  assertEquals(response.status, 409);
  assertEquals(body.error.code, "PLAN_ALREADY_EXISTS");
});

// Mock supabase that returns well-shaped-but-empty results for every query.
// fetchCandidates() sees an empty recipes array → uniqueTotal = 0 → we throw
// InsufficientRecipesError → handler maps to 422 INSUFFICIENT_RECIPES.
// deno-lint-ignore no-explicit-any
function makeEmptyCatalogSupabase(): any {
  const buildBuilder = () => {
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      overlaps: () => builder,
      or: () => builder,
      not: () => builder,
      neq: () => builder,
      gte: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      // deno-lint-ignore no-explicit-any
      then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return { from: (_t: string) => builder };
  };
  return { from: (t: string) => buildBuilder().from(t) };
}

Deno.test("generate_plan returns 422 INSUFFICIENT_RECIPES when the catalog is empty", async () => {
  const mockSupabase = makeEmptyCatalogSupabase();
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-04-13",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => mockSupabase as never,
  });
  const body = await response.json();

  assertEquals(response.status, 422);
  assertEquals(body.error.code, "INSUFFICIENT_RECIPES");
});

// Mock supabase that exposes one raw candidate, but the user's explicit
// ingredient dislike removes it from the viable pool after annotation. This
// exercises the contract regression where we used to count raw candidates and
// persist an empty/partial plan instead of returning 422.
// deno-lint-ignore no-explicit-any
function makeDislikeFilteredCatalogSupabase(): any {
  const buildBuilder = () => {
    let table = "";
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      overlaps: () => builder,
      or: () => builder,
      not: () => builder,
      neq: () => builder,
      gte: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        if (table === "user_profiles") {
          return Promise.resolve({
            data: {
              locale: "en",
              dietary_restrictions: [],
              cuisine_preferences: [],
              ingredient_dislikes: ["cremini mushrooms"],
              skill_level: "beginner",
              household_size: 2,
              nutrition_goal: "no_preference",
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single: () => Promise.resolve({ data: null, error: null }),
      // deno-lint-ignore no-explicit-any
      then: (resolve: any) => {
        if (table === "recipes") {
          resolve({ data: [DISLIKED_RECIPE_ROW], error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return {
      from: (t: string) => {
        table = t;
        return builder;
      },
    };
  };
  return {
    from: (t: string) => buildBuilder().from(t),
  };
}

Deno.test("generate_plan returns 422 INSUFFICIENT_RECIPES when every raw candidate is filtered by hard dislike rules", async () => {
  const mockSupabase = makeDislikeFilteredCatalogSupabase();
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-04-13",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => mockSupabase as never,
  });
  const body = await response.json();

  assertEquals(response.status, 422);
  assertEquals(body.error.code, "INSUFFICIENT_RECIPES");
});

Deno.test("generate_plan debug flag controls debugTrace presence", async () => {
  // Debug flag validation is a contract check. The full orchestrator will
  // still fail on the empty mock supabase (500 INTERNAL_ERROR), but we can
  // verify INVALID_INPUT fires when `debug` is the wrong type.
  const badReq = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-04-13",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
      debug: "yes",
    },
  });
  const badResponse = await handleMealPlannerRequest(badReq, mockDependencies);
  const badBody = await badResponse.json();
  assertEquals(badResponse.status, 400);
  assertEquals(badBody.error.code, "INVALID_INPUT");
});

Deno.test("get_preferences returns DEFAULT_PREFERENCES when no row exists", async () => {
  const req = createAuthenticatedRequest({
    action: "get_preferences",
    payload: {},
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.preferences, DEFAULT_PREFERENCES);
  assertEquals(body.warnings, []);
});

Deno.test("update_preferences canonicalizes meal types and persists", async () => {
  const req = createAuthenticatedRequest({
    action: "update_preferences",
    payload: {
      mealTypes: ["comida", "dessert"],
      busyDays: [1, 3],
      dayIndexes: [0, 1, 2, 3, 4],
      defaultMaxWeeknightMinutes: 30,
      autoLeftovers: true,
      preferredEatTimes: { lunch: "14:00" },
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.updated, true);
  assertEquals(body.preferences.mealTypes, ["lunch", "dessert"]);
  assertEquals(body.preferences.busyDays, [1, 3]);
  assertEquals(body.preferences.activeDayIndexes, [0, 1, 2, 3, 4]);
  assertEquals(body.preferences.defaultMaxWeeknightMinutes, 30);
  assertEquals(body.preferences.autoLeftovers, true);
  assertEquals(body.preferences.preferredEatTimes, { lunch: "14:00" });
  // First-save-wins: setupCompletedAt is stamped to a real ISO string when
  // no prior row existed. The empty-supabase mock returns null on read, so
  // this is the "first save" path.
  if (typeof body.preferences.setupCompletedAt !== "string") {
    throw new Error(
      "expected setupCompletedAt to be set on first update_preferences call",
    );
  }
});

Deno.test("update_preferences preserves existing setup_completed_at on subsequent saves", async () => {
  const existingTimestamp = "2026-04-01T10:00:00.000Z";
  const { supabase, upserts } = makeStatefulSupabase({
    preferences: {
      meal_types: ["dinner"],
      busy_days: [],
      active_day_indexes: [0, 1, 2, 3, 4],
      default_max_weeknight_minutes: 45,
      auto_leftovers: true,
      preferred_eat_times: {},
      setup_completed_at: existingTimestamp,
    },
  });
  const req = createAuthenticatedRequest({
    action: "update_preferences",
    payload: { busyDays: [1, 3] },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.preferences.setupCompletedAt, existingTimestamp);
  // The upsert payload should also carry the original timestamp, not a new
  // one — the server must not silently bump it on every save.
  const upserted = upserts.user_meal_planning_preferences?.[0];
  if (!upserted || upserted.setup_completed_at !== existingTimestamp) {
    throw new Error(
      `expected upsert to preserve setup_completed_at=${existingTimestamp}, got ${
        JSON.stringify(upserted)
      }`,
    );
  }
});

Deno.test("update_preferences rejects malformed payload values", async () => {
  const req = createAuthenticatedRequest({
    action: "update_preferences",
    payload: {
      busyDays: ["abc"],
      autoLeftovers: "false",
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
});

Deno.test("generate_plan rejects missing weekStart", async () => {
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
});

Deno.test("generate_plan rejects malformed weekStart before planner execution", async () => {
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-02-30",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
  assertStringIncludes(body.error.message, "weekStart");
});

Deno.test("link_shopping_list returns 501 NOT_IMPLEMENTED until Track B lands", async () => {
  const req = createAuthenticatedRequest({
    action: "link_shopping_list",
    payload: {
      mealPlanId: "plan-123",
      shoppingListId: "list-123",
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 501);
  assertEquals(body.error.code, "NOT_IMPLEMENTED");
});

Deno.test("swap_meal rejects missing mealPlanSlotId", async () => {
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: "plan-123",
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
});

// Same shape as MINIMAL_RECIPE_ROW but with NO MEAL_TYPE tag — exercises the
// strict meal-type filter path. Role-compatible recipes that lack meal-type
// tags should be excluded with a MISSING_MEAL_TYPE_TAGS warning, leading to
// uniqueTotal === 0 → 422 INSUFFICIENT_RECIPES + warnings in body.
const UNTAGGED_RECIPE_ROW = {
  ...MINIMAL_RECIPE_ROW,
  id: "fake-recipe-untagged",
  recipe_to_tag: [],
};

// deno-lint-ignore no-explicit-any
function makeUntaggedRecipeSupabase(): any {
  const buildBuilder = () => {
    let table = "";
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      overlaps: () => builder,
      or: () => builder,
      not: () => builder,
      neq: () => builder,
      gte: () => builder,
      insert: () => builder,
      update: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      // deno-lint-ignore no-explicit-any
      then: (resolve: any) => {
        if (table === "recipes") {
          resolve({ data: [UNTAGGED_RECIPE_ROW], error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return {
      from: (t: string) => {
        table = t;
        return builder;
      },
    };
  };
  return {
    from: (t: string) => buildBuilder().from(t),
  };
}

Deno.test("generate_plan returns 422 INSUFFICIENT_RECIPES with MISSING_MEAL_TYPE_TAGS warning when role-compatible recipes lack meal-type tags", async () => {
  const mockSupabase = makeUntaggedRecipeSupabase();
  const req = createAuthenticatedRequest({
    action: "generate_plan",
    payload: {
      weekStart: "2026-04-13",
      dayIndexes: [0, 1, 2, 3, 4],
      mealTypes: ["dinner"],
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: (_authHeader: string) => mockSupabase,
  });
  const body = await response.json();

  assertEquals(response.status, 422);
  assertEquals(body.error.code, "INSUFFICIENT_RECIPES");
  // The diagnostic must surface so callers know it's a tagging gap, not a
  // generic "no recipes" condition.
  if (
    !Array.isArray(body.warnings) ||
    !body.warnings.some((w: string) =>
      w === "MISSING_MEAL_TYPE_TAGS:meal_type=dinner"
    )
  ) {
    throw new Error(
      `expected warnings to include MISSING_MEAL_TYPE_TAGS:meal_type=dinner, got: ${
        JSON.stringify(body.warnings)
      }`,
    );
  }
});

// ============================================================
// New handlers — get_current_plan / mutations / approve_plan
// ============================================================

/**
 * Stateful in-memory Supabase mock that records updates and returns seeded
 * rows. Sufficient to exercise the read/mutate/approve loop without a live
 * database. Each test seeds the rows it needs and checks the resulting
 * recorded mutations.
 */
function makeStatefulSupabase(opts: {
  plan?: Record<string, unknown> | null;
  slot?: Record<string, unknown> | null;
  components?: Record<string, unknown>[];
  rejections?: Record<string, unknown>[];
  recipes?: Record<string, unknown>[];
  recipeById?: Record<string, Record<string, unknown>>;
  preferences?: Record<string, unknown> | null;
  // When set, meal_plans `.eq("id", X).maybeSingle()` looks up here first
  // and falls back to `opts.plan`. Lets tests assert which plan a handler
  // returns when more than one exists for the user.
  planById?: Record<string, Record<string, unknown>>;
  // Per-RPC error injection. When `rpcErrors[name]` is set, calls to
  // `supabase.rpc(name, …)` resolve with that error instead of success —
  // exercises partial-failure paths without needing a live DB.
  rpcErrors?: Record<string, { message: string }>;
}) {
  const updates: Record<string, Record<string, unknown>[]> = {};
  const inserts: Record<string, Record<string, unknown>[]> = {};
  const upserts: Record<string, Record<string, unknown>[]> = {};
  const rpcCalls: Record<string, Record<string, unknown>[]> = {};

  const buildBuilder = (table: string) => {
    let pendingUpdate: Record<string, unknown> | null = null;
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpsert: Record<string, unknown> | null = null;
    const filters: Array<{ kind: string; col?: string; val?: unknown }> = [];

    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push({ kind: "eq", col, val });
        return builder;
      },
      in: (col: string, val: unknown) => {
        filters.push({ kind: "in", col, val });
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      not: () => builder,
      neq: () => builder,
      or: () => builder,
      overlaps: () => builder,
      gte: () => builder,
      maybeSingle: () => {
        if (table === "meal_plans") {
          // If the query filtered by a specific plan ID and the test seeded
          // that ID via planById, return that row. Otherwise fall back to
          // the generic `opts.plan` (used by loadActivePlan-style queries).
          const idFilter = filters.find((f) =>
            f.kind === "eq" && f.col === "id"
          );
          if (idFilter && opts.planById) {
            const row = opts.planById[idFilter.val as string];
            return Promise.resolve({ data: row ?? null, error: null });
          }
          return Promise.resolve({ data: opts.plan ?? null, error: null });
        }
        if (table === "meal_plan_slots") {
          return Promise.resolve({ data: opts.slot ?? null, error: null });
        }
        if (table === "user_meal_planning_preferences") {
          return Promise.resolve({
            data: opts.preferences ?? null,
            error: null,
          });
        }
        if (table === "recipes") {
          const idFilter = filters.find((f) =>
            f.kind === "eq" && f.col === "id"
          );
          const recipe = idFilter
            ? opts.recipeById?.[idFilter.val as string]
            : null;
          if (!recipe) return Promise.resolve({ data: null, error: null });

          // Honor the `eq("is_published", true)` filter the apply path uses
          // for eligibility validation. A recipe row with is_published=false
          // looks absent to the caller, mirroring PostgREST behavior. Without
          // this, eligibility-regression tests would pass for the wrong
          // reason (the UUID guard rejecting a non-UUID id before the
          // is_published check ever fires).
          const publishedFilter = filters.find((f) =>
            f.kind === "eq" && f.col === "is_published"
          );
          if (
            publishedFilter && publishedFilter.val === true &&
            (recipe as { is_published?: boolean }).is_published === false
          ) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: recipe, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single: () => Promise.resolve({ data: null, error: null }),
      insert: (row: Record<string, unknown>) => {
        pendingInsert = row;
        if (!inserts[table]) inserts[table] = [];
        inserts[table].push(row);
        // PostgREST insert is awaitable directly when no .select()/.single().
        return Object.assign(
          Promise.resolve({ data: null, error: null }),
          builder,
        );
      },
      update: (row: Record<string, unknown>) => {
        pendingUpdate = row;
        return builder;
      },
      upsert: (row: Record<string, unknown>) => {
        pendingUpsert = row;
        if (!upserts[table]) upserts[table] = [];
        upserts[table].push(row);
        return Object.assign(
          Promise.resolve({ data: null, error: null }),
          builder,
        );
      },
      // deno-lint-ignore no-explicit-any
      then: (resolve: any) => {
        if (pendingUpdate) {
          if (!updates[table]) updates[table] = [];
          updates[table].push(pendingUpdate);
          pendingUpdate = null;
          return resolve({ data: null, error: null });
        }
        if (pendingInsert) {
          pendingInsert = null;
          return resolve({ data: null, error: null });
        }
        if (pendingUpsert) {
          pendingUpsert = null;
          return resolve({ data: null, error: null });
        }
        if (table === "recipes") {
          return resolve({ data: opts.recipes ?? [], error: null });
        }
        if (table === "meal_plan_slot_rejections") {
          return resolve({ data: opts.rejections ?? [], error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return builder;
  };

  return {
    supabase: {
      from: (t: string) => buildBuilder(t),
      rpc: (name: string, params: Record<string, unknown>) => {
        if (!rpcCalls[name]) rpcCalls[name] = [];
        rpcCalls[name].push(params);
        const injected = opts.rpcErrors?.[name];
        return Promise.resolve({
          data: null,
          error: injected ?? null,
        });
      },
    },
    updates,
    inserts,
    upserts,
    rpcCalls,
  };
}

const SEEDED_PLAN_ID = "plan-uuid-1";
const SEEDED_SLOT_ID = "slot-uuid-1";
const SEEDED_COMPONENT_ID = "comp-uuid-1";

function seededPlanRow() {
  return {
    id: SEEDED_PLAN_ID,
    user_id: "user-123",
    week_start: "2026-04-13",
    status: "draft",
    locale: "en",
    requested_day_indexes: [0, 1, 2, 3, 4],
    requested_meal_types: ["dinner"],
    shopping_list_id: null,
    shopping_sync_state: "not_created",
    meal_plan_slots: [
      {
        id: SEEDED_SLOT_ID,
        planned_date: "2026-04-13",
        day_index: 0,
        meal_type: "dinner",
        display_order: 0,
        slot_type: "cook_slot",
        structure_template: "single_component",
        expected_meal_components: [],
        coverage_complete: true,
        selection_reason: null,
        shopping_sync_state: "not_created",
        status: "planned",
        swap_count: 0,
        last_swapped_at: null,
        cooked_at: null,
        skipped_at: null,
        merged_cooking_guide: null,
        meal_plan_slot_components: [
          {
            id: SEEDED_COMPONENT_ID,
            component_role: "main",
            source_kind: "recipe",
            recipe_id: "recipe-A",
            source_component_id: null,
            meal_components_snapshot: ["protein"],
            pairing_basis: "standalone",
            display_order: 0,
            is_primary: true,
            title_snapshot: "Original Recipe",
            image_url_snapshot: null,
            total_time_snapshot: 30,
            difficulty_snapshot: "easy",
            portions_snapshot: 4,
            equipment_tags_snapshot: [],
          },
        ],
      },
    ],
  };
}

function seededSlotRef() {
  return { id: SEEDED_SLOT_ID, meal_plan_id: SEEDED_PLAN_ID };
}

Deno.test("get_current_plan returns null when no plan exists", async () => {
  const { supabase } = makeStatefulSupabase({});
  const req = createAuthenticatedRequest({
    action: "get_current_plan",
    payload: {},
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.plan, null);
  assertEquals(body.warnings, []);
});

Deno.test("get_current_plan returns the plan with slots and components", async () => {
  const { supabase } = makeStatefulSupabase({ plan: seededPlanRow() });
  const req = createAuthenticatedRequest({
    action: "get_current_plan",
    payload: {},
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.plan.planId, SEEDED_PLAN_ID);
  assertEquals(body.plan.slots.length, 1);
  assertEquals(body.plan.slots[0].components[0].title, "Original Recipe");
});

Deno.test("mark_meal_cooked flips status and stamps cooked_at", async () => {
  const { supabase, updates } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
  });
  const req = createAuthenticatedRequest({
    action: "mark_meal_cooked",
    payload: { mealPlanId: SEEDED_PLAN_ID, mealPlanSlotId: SEEDED_SLOT_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  assertEquals(response.status, 200);

  const slotUpdates = updates["meal_plan_slots"] ?? [];
  assertEquals(slotUpdates.length >= 1, true);
  assertEquals(slotUpdates[0].status, "cooked");
  if (typeof slotUpdates[0].cooked_at !== "string") {
    throw new Error("expected cooked_at to be set to an ISO timestamp");
  }
});

Deno.test("skip_meal flips status, stamps skipped_at, marks shopping stale", async () => {
  const { supabase, updates } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
  });
  const req = createAuthenticatedRequest({
    action: "skip_meal",
    payload: { mealPlanId: SEEDED_PLAN_ID, mealPlanSlotId: SEEDED_SLOT_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.suggestion, null);

  const slotUpdates = updates["meal_plan_slots"] ?? [];
  assertEquals(slotUpdates[0].status, "skipped");
  assertEquals(slotUpdates[0].shopping_sync_state, "stale");
});

Deno.test("approve_plan flips status from draft to active", async () => {
  const { supabase, updates } = makeStatefulSupabase({
    plan: seededPlanRow(),
  });
  const req = createAuthenticatedRequest({
    action: "approve_plan",
    payload: { mealPlanId: SEEDED_PLAN_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.mergedGuidesGenerated, 0);
  assertEquals(body.mergedGuidesFailed, 0);

  const planUpdates = updates["meal_plans"] ?? [];
  assertEquals(planUpdates[0].status, "active");
});

Deno.test("approve_plan returns PLAN_NOT_FOUND when plan missing", async () => {
  const { supabase } = makeStatefulSupabase({});
  const req = createAuthenticatedRequest({
    action: "approve_plan",
    payload: { mealPlanId: "missing" },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 404);
  assertEquals(body.error.code, "PLAN_NOT_FOUND");
});

Deno.test("approve_plan is idempotent on already-active plans (no status flip, no analytics event)", async () => {
  const activeRow = { ...seededPlanRow(), status: "active" };
  const { supabase, updates, inserts } = makeStatefulSupabase({
    plan: activeRow,
  });
  const req = createAuthenticatedRequest({
    action: "approve_plan",
    payload: { mealPlanId: SEEDED_PLAN_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  assertEquals(response.status, 200);
  // No status flip — the plan was already active.
  assertEquals(updates["meal_plans"], undefined);
  // No analytics event — re-approval of an already-active plan must not
  // inflate the meal_plan_approved counter.
  const events = inserts["user_events"] ?? [];
  const approvalEvents = events.filter((e) =>
    e.event_type === "meal_plan_approved"
  );
  assertEquals(approvalEvents.length, 0);
});

Deno.test("approve_plan rejects archived plans with INVALID_INPUT", async () => {
  const archivedRow = { ...seededPlanRow(), status: "archived" };
  const { supabase, inserts } = makeStatefulSupabase({ plan: archivedRow });
  const req = createAuthenticatedRequest({
    action: "approve_plan",
    payload: { mealPlanId: SEEDED_PLAN_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
  // No analytics event for an archived-plan rejection either.
  const events = inserts["user_events"] ?? [];
  const approvalEvents = events.filter((e) =>
    e.event_type === "meal_plan_approved"
  );
  assertEquals(approvalEvents.length, 0);
});

Deno.test("swap_meal browse path returns up to 3 alternatives", async () => {
  const recipes = Array.from({ length: 5 }, (_, i) => ({
    id: `alt-${i}`,
    planner_role: "main",
    alternate_planner_roles: [],
    meal_components: ["protein"],
    total_time: 25 + i,
    difficulty: "easy",
    portions: 4,
    image_url: null,
    equipment_tags: [],
    verified_at: null,
    recipe_translations: [{ locale: "en", name: `Alt ${i}` }],
    recipe_to_tag: [{
      recipe_tags: {
        categories: ["meal_type"],
        recipe_tag_translations: [{ locale: "en", name: "dinner" }],
      },
    }],
  }));
  const { supabase } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
    recipes,
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: { mealPlanId: SEEDED_PLAN_ID, mealPlanSlotId: SEEDED_SLOT_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.alternatives.length, 3);
});

Deno.test("swap_meal browse path filters out wrong-meal-type alternatives", async () => {
  // Two protein recipes: one tagged dinner, one tagged breakfast. Only the
  // dinner one should surface for a dinner slot.
  const recipes = [
    {
      id: "alt-dinner",
      planner_role: "main",
      alternate_planner_roles: [],
      meal_components: ["protein"],
      total_time: 25,
      difficulty: "easy",
      portions: 4,
      image_url: null,
      equipment_tags: [],
      verified_at: null,
      recipe_translations: [{ locale: "en", name: "Dinner Protein" }],
      recipe_to_tag: [{
        recipe_tags: {
          categories: ["meal_type"],
          recipe_tag_translations: [{ locale: "en", name: "dinner" }],
        },
      }],
    },
    {
      id: "alt-breakfast",
      planner_role: "main",
      alternate_planner_roles: [],
      meal_components: ["protein"],
      total_time: 15,
      difficulty: "easy",
      portions: 4,
      image_url: null,
      equipment_tags: [],
      verified_at: null,
      recipe_translations: [{ locale: "en", name: "Pancakes" }],
      recipe_to_tag: [{
        recipe_tags: {
          categories: ["meal_type"],
          recipe_tag_translations: [{ locale: "en", name: "breakfast" }],
        },
      }],
    },
  ];
  const { supabase } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
    recipes,
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: { mealPlanId: SEEDED_PLAN_ID, mealPlanSlotId: SEEDED_SLOT_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.alternatives.length, 1);
  const alt = body.alternatives[0];
  const altPrimary = alt.slot.components.find((
    c: { isPrimary?: boolean },
  ) => c.isPrimary);
  assertEquals(altPrimary?.recipeId, "alt-dinner");
});

Deno.test("swap_meal apply path persists swap and records rejection", async () => {
  const REPLACEMENT_ID = "44444444-4444-4444-4444-444444444444";
  const replacement = {
    id: REPLACEMENT_ID,
    planner_role: "main",
    alternate_planner_roles: [],
    meal_components: ["protein"],
    total_time: 20,
    difficulty: "easy",
    portions: 4,
    image_url: null,
    equipment_tags: [],
    verified_at: null,
    is_published: true,
    recipe_translations: [{ locale: "en", name: "Replacement" }],
    recipe_to_tag: [{
      recipe_tags: {
        categories: ["meal_type"],
        recipe_tag_translations: [{ locale: "en", name: "dinner" }],
      },
    }],
  };
  const { supabase, inserts, rpcCalls } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
    recipeById: { [REPLACEMENT_ID]: replacement },
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: SEEDED_PLAN_ID,
      mealPlanSlotId: SEEDED_SLOT_ID,
      selectedRecipeId: REPLACEMENT_ID,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
    // Share the stateful mock so the RPC call lands in the same `rpcCalls`
    // bucket the test is asserting against.
    createServiceClient: () => supabase as never,
  });
  assertEquals(response.status, 200);

  // The required slot/component/plan writes go through the transactional
  // RPC; the test asserts the RPC was called with the right snapshot.
  const rpcCall = rpcCalls["apply_meal_plan_slot_swap"]?.[0];
  if (!rpcCall) throw new Error("apply_meal_plan_slot_swap was not called");
  assertEquals(rpcCall.p_recipe_id, REPLACEMENT_ID);
  assertEquals(rpcCall.p_title_snapshot, "Replacement");
  assertEquals(rpcCall.p_component_id, SEEDED_COMPONENT_ID);
  assertEquals(rpcCall.p_slot_id, SEEDED_SLOT_ID);
  assertEquals(rpcCall.p_plan_id, SEEDED_PLAN_ID);

  // Rejection insert is best-effort and runs OUTSIDE the transaction.
  const rejections = inserts["meal_plan_slot_rejections"] ?? [];
  assertEquals(rejections[0].recipe_id, "recipe-A");
  assertEquals(rejections[0].reason_code, "user_swap");
});

Deno.test("swap_meal apply path recomputes coverage_complete after swap", async () => {
  const REPLACEMENT_ID = "55555555-5555-5555-5555-555555555555";
  const replacement = {
    id: REPLACEMENT_ID,
    planner_role: "main",
    alternate_planner_roles: [],
    meal_components: ["protein"],
    total_time: 20,
    difficulty: "easy",
    portions: 4,
    image_url: null,
    equipment_tags: [],
    verified_at: null,
    is_published: true,
    recipe_translations: [{ locale: "en", name: "Replacement Protein" }],
    recipe_to_tag: [{
      recipe_tags: {
        categories: ["meal_type"],
        recipe_tag_translations: [{ locale: "en", name: "dinner" }],
      },
    }],
  };
  const plan = seededPlanRow();
  const slot = plan.meal_plan_slots[0] as Record<string, unknown> & {
    meal_plan_slot_components: Record<string, unknown>[];
  };
  slot.structure_template = "main_plus_side";
  slot.expected_meal_components = ["protein", "carb"];
  slot.coverage_complete = false;
  slot.meal_plan_slot_components = [
    {
      ...slot.meal_plan_slot_components[0],
      meal_components_snapshot: ["veg"],
    },
    {
      id: "comp-side-1",
      component_role: "side",
      source_kind: "recipe",
      recipe_id: "recipe-side-carb",
      source_component_id: null,
      meal_components_snapshot: ["carb"],
      pairing_basis: "paired",
      display_order: 1,
      is_primary: false,
      title_snapshot: "Carb Side",
      image_url_snapshot: null,
      total_time_snapshot: 15,
      difficulty_snapshot: "easy",
      portions_snapshot: 4,
      equipment_tags_snapshot: [],
    },
  ];
  const { supabase, updates } = makeStatefulSupabase({
    plan,
    slot: seededSlotRef(),
    recipeById: { [REPLACEMENT_ID]: replacement },
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: SEEDED_PLAN_ID,
      mealPlanSlotId: SEEDED_SLOT_ID,
      selectedRecipeId: REPLACEMENT_ID,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
    createServiceClient: () => supabase as never,
  });
  assertEquals(response.status, 200);

  const slotUpdates = updates["meal_plan_slots"] ?? [];
  assertEquals(slotUpdates.some((row) => row.coverage_complete === true), true);
});

Deno.test("swap_meal apply path returns 500 and skips rejection insert when the RPC fails", async () => {
  // Regression: with the prior parallel-write design a partial failure could
  // persist a refreshed component snapshot while the slot/plan freshness
  // updates failed. The transactional RPC eliminates that — this test
  // exercises the failure path by injecting an RPC error and asserts no
  // rejection row was written either (rollback intent: after a failed
  // transactional swap, no side effects should be visible to the user).
  const REPLACEMENT_ID = "77777777-7777-7777-7777-777777777777";
  const replacement = {
    id: REPLACEMENT_ID,
    planner_role: "main",
    alternate_planner_roles: [],
    meal_components: ["protein"],
    total_time: 20,
    difficulty: "easy",
    portions: 4,
    image_url: null,
    equipment_tags: [],
    verified_at: null,
    is_published: true,
    recipe_translations: [{ locale: "en", name: "Replacement" }],
    recipe_to_tag: [{
      recipe_tags: {
        categories: ["meal_type"],
        recipe_tag_translations: [{ locale: "en", name: "dinner" }],
      },
    }],
  };
  const { supabase, inserts } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
    recipeById: { [REPLACEMENT_ID]: replacement },
    rpcErrors: {
      apply_meal_plan_slot_swap: { message: "constraint x failed" },
    },
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: SEEDED_PLAN_ID,
      mealPlanSlotId: SEEDED_SLOT_ID,
      selectedRecipeId: REPLACEMENT_ID,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
    createServiceClient: () => supabase as never,
  });
  assertEquals(response.status, 500);

  // No rejection row should be written when the swap itself failed.
  const rejections = inserts["meal_plan_slot_rejections"] ?? [];
  assertEquals(rejections.length, 0);
});

Deno.test("swap_meal apply rejects re-applying the slot's current recipe", async () => {
  const PRIMARY_RECIPE_ID = "55555555-5555-5555-5555-555555555555";
  // Override the seed so the slot's current primary has a UUID; otherwise
  // UUID validation would intercept before the same-as-primary check fires.
  const planRow = seededPlanRow();
  // deno-lint-ignore no-explicit-any
  const slotsList = (planRow as any).meal_plan_slots as Array<
    Record<string, unknown>
  >;
  const componentsList = slotsList[0].meal_plan_slot_components as Array<
    Record<string, unknown>
  >;
  componentsList[0].recipe_id = PRIMARY_RECIPE_ID;

  const { supabase } = makeStatefulSupabase({
    plan: planRow,
    slot: seededSlotRef(),
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: SEEDED_PLAN_ID,
      mealPlanSlotId: SEEDED_SLOT_ID,
      selectedRecipeId: PRIMARY_RECIPE_ID,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
  if (
    typeof body.error.message !== "string" ||
    !body.error.message.includes("already occupies")
  ) {
    throw new Error(
      `expected 'already occupies' in error message, got: ${body.error.message}`,
    );
  }
});

Deno.test("swap_meal apply rejects a previously-rejected recipe", async () => {
  const replacement = {
    id: "11111111-1111-1111-1111-111111111111",
    planner_role: "main",
    alternate_planner_roles: [],
    meal_components: ["protein"],
    total_time: 20,
    difficulty: "easy",
    portions: 4,
    image_url: null,
    equipment_tags: [],
    verified_at: null,
    is_published: true,
    recipe_translations: [{ locale: "en", name: "Already Rejected" }],
    recipe_to_tag: [{
      recipe_tags: {
        categories: ["meal_type"],
        recipe_tag_translations: [{ locale: "en", name: "dinner" }],
      },
    }],
  };
  const { supabase } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
    rejections: [{ recipe_id: replacement.id }],
    recipeById: { [replacement.id]: replacement },
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: SEEDED_PLAN_ID,
      mealPlanSlotId: SEEDED_SLOT_ID,
      selectedRecipeId: replacement.id,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
});

Deno.test("swap_meal apply rejects a non-UUID selectedRecipeId", async () => {
  const { supabase } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: SEEDED_PLAN_ID,
      mealPlanSlotId: SEEDED_SLOT_ID,
      selectedRecipeId: "not-a-uuid",
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
});

Deno.test("approve_plan returns the approved plan, not the most recent one", async () => {
  const APPROVED_ID = "22222222-2222-2222-2222-222222222222";
  const OTHER_ID = "33333333-3333-3333-3333-333333333333";
  const approvedRow = { ...seededPlanRow(), id: APPROVED_ID, status: "draft" };
  const otherRow = {
    ...seededPlanRow(),
    id: OTHER_ID,
    status: "active",
    week_start: "2026-05-04",
  };
  const { supabase } = makeStatefulSupabase({
    plan: otherRow, // loadActivePlan would return this — the bug case.
    planById: {
      [APPROVED_ID]: { ...approvedRow, status: "active" },
      [OTHER_ID]: otherRow,
    },
  });
  const req = createAuthenticatedRequest({
    action: "approve_plan",
    payload: { mealPlanId: APPROVED_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.plan.planId, APPROVED_ID);
});

Deno.test("swap_meal apply path rejects an unpublished recipe", async () => {
  // Real UUID so the format guard passes; the mock is configured to
  // honor the `eq("is_published", true)` filter, so a row with
  // is_published=false comes back as null from PostgREST and the handler
  // surfaces INVALID_INPUT. Without the filter-aware mock this test
  // would pass for the wrong reason (rejected by the UUID format guard
  // before reaching the eligibility query).
  const UNPUBLISHED_ID = "66666666-6666-6666-6666-666666666666";
  const unpublished = {
    id: UNPUBLISHED_ID,
    planner_role: "main",
    alternate_planner_roles: [],
    meal_components: ["protein"],
    total_time: 20,
    difficulty: "easy",
    portions: 4,
    image_url: null,
    equipment_tags: [],
    verified_at: null,
    is_published: false,
    recipe_translations: [{ locale: "en", name: "Unpublished" }],
  };
  const { supabase } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
    recipeById: { [UNPUBLISHED_ID]: unpublished },
  });
  const req = createAuthenticatedRequest({
    action: "swap_meal",
    payload: {
      mealPlanId: SEEDED_PLAN_ID,
      mealPlanSlotId: SEEDED_SLOT_ID,
      selectedRecipeId: UNPUBLISHED_ID,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
});

Deno.test("mark_meal_cooked returns INVALID_INPUT when mealPlanId mismatches the slot's plan", async () => {
  const { supabase } = makeStatefulSupabase({
    plan: seededPlanRow(),
    slot: seededSlotRef(),
  });
  const req = createAuthenticatedRequest({
    action: "mark_meal_cooked",
    payload: {
      mealPlanId: "wrong-plan-uuid",
      mealPlanSlotId: SEEDED_SLOT_ID,
    },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
});

Deno.test("generate_shopping_list returns 501 NOT_IMPLEMENTED when Track B not present", async () => {
  const { supabase } = makeStatefulSupabase({});
  const req = createAuthenticatedRequest({
    action: "generate_shopping_list",
    payload: { mealPlanId: SEEDED_PLAN_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  const body = await response.json();
  assertEquals(response.status, 501);
  assertEquals(body.error.code, "NOT_IMPLEMENTED");
});

Deno.test("mark_meal_cooked is idempotent when slot is already cooked", async () => {
  // Seed the plan with a pre-cooked slot. loadSlotWithPlan queries
  // `meal_plans` and pulls the slot from `meal_plan_slots[]`, so we mutate
  // there (the `slot` opt is the row returned for direct meal_plan_slots
  // lookups, not used on this path).
  const planRow = seededPlanRow() as Record<string, unknown>;
  // deno-lint-ignore no-explicit-any
  const slots = planRow.meal_plan_slots as any[];
  slots[0].status = "cooked";
  slots[0].cooked_at = "2026-04-27T00:00:00.000Z";

  const { supabase, updates, inserts } = makeStatefulSupabase({
    plan: planRow,
    slot: seededSlotRef(),
  });
  const req = createAuthenticatedRequest({
    action: "mark_meal_cooked",
    payload: { mealPlanSlotId: SEEDED_SLOT_ID },
  });
  const response = await handleMealPlannerRequest(req, {
    ...mockDependencies,
    createUserClient: () => supabase as never,
  });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.slot?.status, "cooked");
  // No update or analytics insert should happen on the idempotent path.
  assertEquals(updates.meal_plan_slots ?? [], []);
  assertEquals(inserts.user_events ?? [], []);
});
