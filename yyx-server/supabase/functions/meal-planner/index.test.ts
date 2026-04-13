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
} from "./index.ts";
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

Deno.test("generate_plan accepts comida and returns a typed stub", async () => {
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

  assertEquals(response.status, 200);
  assertEquals(body.plan, null);
  assertEquals(body.isPartial, true);
  assertEquals(body.missingSlots, []);
  assertEquals(body.warnings, ["STUB: generate_plan not yet implemented"]);
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
