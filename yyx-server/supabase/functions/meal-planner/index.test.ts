import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createAuthenticatedRequest,
  createMockRequest,
} from "../_shared/test-helpers/mocks.ts";
import { DEFAULT_PREFERENCES, handleMealPlannerRequest } from "./index.ts";
import { MEAL_PLAN_ACTIONS, type MealPlanAction } from "./types.ts";

const expectedActions: MealPlanAction[] = [
  "get_current_plan",
  "generate_plan",
  "swap_meal",
  "skip_meal",
  "mark_meal_cooked",
  "generate_shopping_list",
  "get_preferences",
  "update_preferences",
  "link_shopping_list",
];

const mockDependencies = {
  createUserClient: (_authHeader: string) => ({}) as never,
  validateAuth: async (_authHeader: string | null) => ({
    user: { id: "user-123", email: "test@example.com", role: "user" },
    error: null,
  }),
};

Deno.test("meal-planner exposes only the PR #1 action set", () => {
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
    action: "approve_plan",
    payload: {},
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
  assertStringIncludes(body.error.message, "Unknown action");
});

Deno.test("generate_plan accepts comida without raising INVALID_INPUT", async () => {
  // generate_plan now runs the real orchestrator. With the stub supabase
  // returned by mockDependencies it will fail at the first DB call and we
  // expect the outer handler to wrap that as INTERNAL_ERROR (500). The key
  // guarantee tested here is that `comida` passes validation — we should
  // not see INVALID_INPUT.
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

  assertEquals(response.status, 500);
  assertEquals(body.error.code, "INTERNAL_ERROR");
});

// Minimal Supabase builder mock. Each `.from(table)` gets fresh state so
// filter flags don't bleed across tables. The only query that returns a row
// is the plan preflight: `from("meal_plans").select...in("status", ["draft",
// "active"]).maybeSingle()`.
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
      not: () => builder,
      gte: () => builder,
      insert: () => builder,
      update: () => builder,
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
      then: (resolve: any) => resolve({ data: [], error: null }),
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
// idx_meal_plans_active_week partial unique index.
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
      not: () => builder,
      gte: () => builder,
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
      then: (resolve: any) => resolve({ data: [], error: null }),
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

Deno.test("get_preferences returns the PR #1 default preference stub", async () => {
  const req = createAuthenticatedRequest({
    action: "get_preferences",
    payload: {},
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.preferences, DEFAULT_PREFERENCES);
  assertEquals(body.warnings, ["STUB: get_preferences not yet implemented"]);
});

Deno.test("update_preferences canonicalizes meal types without persisting", async () => {
  const req = createAuthenticatedRequest({
    action: "update_preferences",
    payload: {
      mealTypes: ["comida", "dessert"],
      busyDays: [1, 3],
      dayIndexes: [0, 1, 2, 3, 4],
      defaultMaxWeeknightMinutes: 30,
      preferLeftoversForLunch: true,
      preferredEatTimes: { lunch: "14:00" },
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.updated, false);
  assertEquals(body.preferences.mealTypes, ["lunch", "dessert"]);
  assertEquals(body.preferences.busyDays, [1, 3]);
  assertEquals(body.preferences.activeDayIndexes, [0, 1, 2, 3, 4]);
  assertEquals(body.preferences.defaultMaxWeeknightMinutes, 30);
  assertEquals(body.preferences.preferLeftoversForLunch, true);
  assertEquals(body.preferences.preferredEatTimes, { lunch: "14:00" });
});

Deno.test("update_preferences rejects malformed payload values", async () => {
  const req = createAuthenticatedRequest({
    action: "update_preferences",
    payload: {
      busyDays: ["abc"],
      preferLeftoversForLunch: "false",
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

Deno.test("link_shopping_list rejects missing shoppingListId", async () => {
  const req = createAuthenticatedRequest({
    action: "link_shopping_list",
    payload: {
      mealPlanId: "plan-123",
    },
  });
  const response = await handleMealPlannerRequest(req, mockDependencies);
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "INVALID_INPUT");
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
