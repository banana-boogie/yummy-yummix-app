/**
 * Meal Planner Edge Function
 *
 * Authenticated POST handler for all meal planning operations.
 * PR #1 only ships the slot-based contract and typed stub responses.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";
import { validateAuth } from "../_shared/auth.ts";
import { normalizeMealTypes } from "./meal-types.ts";
import { executeGenerateShoppingList } from "./generate-shopping-list.ts";

import {
  type GeneratePlanResponse,
  type GenerateShoppingListResponse,
  type GetCurrentPlanResponse,
  type GetPreferencesResponse,
  type LinkShoppingListResponse,
  type MarkMealCookedResponse,
  MEAL_PLAN_ACTIONS,
  type MealPlanAction,
  type MealPlannerErrorCode,
  type MealPlannerErrorResponse,
  type MealPlannerRequest,
  type PreferencesResponse,
  type SkipMealResponse,
  type SwapMealResponse,
  type UpdatePreferencesResponse,
} from "./types.ts";

type UserClient = ReturnType<typeof createUserClient>;

export interface MealPlannerDependencies {
  createUserClient: typeof createUserClient;
  validateAuth: typeof validateAuth;
}

const DEFAULT_DEPENDENCIES: MealPlannerDependencies = {
  createUserClient,
  validateAuth,
};

const VALID_ACTIONS = new Set<MealPlanAction>(MEAL_PLAN_ACTIONS);

export const DEFAULT_PREFERENCES: PreferencesResponse = {
  mealTypes: ["dinner"],
  busyDays: [],
  activeDayIndexes: [0, 1, 2, 3, 4],
  defaultMaxWeeknightMinutes: 45,
  preferLeftoversForLunch: false,
  preferredEatTimes: {},
};

function errorResponse(
  code: MealPlannerErrorCode,
  message: string,
  status = 400,
): Response {
  const body: MealPlannerErrorResponse = { error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonResponse<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stubWarning(action: MealPlanAction): string {
  return `STUB: ${action} not yet implemented`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMealPlanAction(value: unknown): value is MealPlanAction {
  return typeof value === "string" &&
    VALID_ACTIONS.has(value as MealPlanAction);
}

function requireString(
  payload: Record<string, unknown>,
  field: string,
): string {
  const value = payload[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} is required and must be a non-empty string`);
  }
  return value;
}

function parseDayIndexArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value.map((entry) => {
    if (
      typeof entry !== "number" ||
      !Number.isInteger(entry) ||
      entry < 0 ||
      entry > 6
    ) {
      throw new Error(`${field} entries must be integers between 0 and 6`);
    }
    return entry;
  });
}

function buildPreferencesFromPayload(
  payload: Record<string, unknown>,
): PreferencesResponse {
  const next: PreferencesResponse = {
    ...DEFAULT_PREFERENCES,
    preferredEatTimes: { ...DEFAULT_PREFERENCES.preferredEatTimes },
  };

  if (payload.mealTypes !== undefined) {
    if (!Array.isArray(payload.mealTypes)) {
      throw new Error("mealTypes must be an array");
    }
    if (payload.mealTypes.some((entry) => typeof entry !== "string")) {
      throw new Error("mealTypes entries must be strings");
    }
    next.mealTypes = normalizeMealTypes(payload.mealTypes as string[]);
  }

  if (payload.busyDays !== undefined) {
    next.busyDays = parseDayIndexArray(payload.busyDays, "busyDays");
  }

  if (payload.dayIndexes !== undefined) {
    next.activeDayIndexes = parseDayIndexArray(
      payload.dayIndexes,
      "dayIndexes",
    );
  }

  if (payload.defaultMaxWeeknightMinutes !== undefined) {
    const minutes = payload.defaultMaxWeeknightMinutes;
    if (
      typeof minutes !== "number" ||
      !Number.isFinite(minutes) ||
      minutes <= 0
    ) {
      throw new Error(
        "defaultMaxWeeknightMinutes must be a positive finite number",
      );
    }
    next.defaultMaxWeeknightMinutes = minutes;
  }

  if (payload.preferLeftoversForLunch !== undefined) {
    if (typeof payload.preferLeftoversForLunch !== "boolean") {
      throw new Error("preferLeftoversForLunch must be a boolean");
    }
    next.preferLeftoversForLunch = payload.preferLeftoversForLunch;
  }

  if (payload.preferredEatTimes !== undefined) {
    if (!isRecord(payload.preferredEatTimes)) {
      throw new Error("preferredEatTimes must be an object");
    }
    next.preferredEatTimes = payload.preferredEatTimes;
  }

  return next;
}

async function handleGetCurrentPlan(
  _payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  const response: GetCurrentPlanResponse = {
    plan: null,
    warnings: [stubWarning("get_current_plan")],
  };
  return jsonResponse(response);
}

async function handleGeneratePlan(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  try {
    requireString(payload, "weekStart");
    parseDayIndexArray(payload.dayIndexes, "dayIndexes");

    const rawMealTypes = payload.mealTypes;
    if (!Array.isArray(rawMealTypes) || rawMealTypes.length === 0) {
      throw new Error("mealTypes is required and must be a non-empty array");
    }
    if (rawMealTypes.some((entry) => typeof entry !== "string")) {
      throw new Error("mealTypes entries must be strings");
    }
    normalizeMealTypes(rawMealTypes as string[]);
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const response: GeneratePlanResponse = {
    plan: null,
    isPartial: true,
    missingSlots: [],
    warnings: [stubWarning("generate_plan")],
  };
  return jsonResponse(response);
}

async function handleSwapMeal(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  try {
    requireString(payload, "mealPlanId");
    requireString(payload, "mealPlanSlotId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const response: SwapMealResponse = {
    alternatives: [],
    warnings: [stubWarning("swap_meal")],
  };
  return jsonResponse(response);
}

async function handleSkipMeal(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  try {
    requireString(payload, "mealPlanId");
    requireString(payload, "mealPlanSlotId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const response: SkipMealResponse = {
    slot: null,
    suggestion: null,
    warnings: [stubWarning("skip_meal")],
  };
  return jsonResponse(response);
}

async function handleMarkMealCooked(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  try {
    requireString(payload, "mealPlanId");
    requireString(payload, "mealPlanSlotId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const response: MarkMealCookedResponse = {
    slot: null,
    warnings: [stubWarning("mark_meal_cooked")],
  };
  return jsonResponse(response);
}

async function handleGenerateShoppingList(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  let mealPlanId: string;
  try {
    mealPlanId = requireString(payload, "mealPlanId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const { response, status } = await executeGenerateShoppingList(
    supabase,
    userId,
    mealPlanId,
  );
  if (status === 404) {
    return errorResponse("PLAN_NOT_FOUND", "Meal plan not found", 404);
  }
  return jsonResponse(response, status);
}

async function handleGetPreferences(
  _payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  const response: GetPreferencesResponse = {
    preferences: DEFAULT_PREFERENCES,
    warnings: [stubWarning("get_preferences")],
  };
  return jsonResponse(response);
}

async function handleUpdatePreferences(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  try {
    const response: UpdatePreferencesResponse = {
      preferences: buildPreferencesFromPayload(payload),
      updated: false,
      warnings: [stubWarning("update_preferences")],
    };
    return jsonResponse(response);
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }
}

async function handleLinkShoppingList(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  let mealPlanId: string;
  let shoppingListId: string;
  try {
    mealPlanId = requireString(payload, "mealPlanId");
    shoppingListId = requireString(payload, "shoppingListId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const response: LinkShoppingListResponse = {
    linked: false,
    mealPlanId,
    shoppingListId,
    warnings: [stubWarning("link_shopping_list")],
  };
  return jsonResponse(response);
}

const actionHandlers: Record<
  MealPlanAction,
  (
    payload: Record<string, unknown>,
    userId: string,
    supabase: UserClient,
  ) => Promise<Response>
> = {
  get_current_plan: handleGetCurrentPlan,
  generate_plan: handleGeneratePlan,
  swap_meal: handleSwapMeal,
  skip_meal: handleSkipMeal,
  mark_meal_cooked: handleMarkMealCooked,
  generate_shopping_list: handleGenerateShoppingList,
  get_preferences: handleGetPreferences,
  update_preferences: handleUpdatePreferences,
  link_shopping_list: handleLinkShoppingList,
};

export async function handleMealPlannerRequest(
  req: Request,
  dependencies: MealPlannerDependencies = DEFAULT_DEPENDENCIES,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get("Authorization");
  const { user, error: authError } = await dependencies.validateAuth(
    authHeader,
  );
  if (authError || !user) {
    return errorResponse("UNAUTHORIZED", authError ?? "Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Invalid JSON body");
  }

  if (!isRecord(body)) {
    return errorResponse("INVALID_INPUT", "Request body must be an object");
  }

  const action = body.action;
  const payload = body.payload ?? {};

  if (!isMealPlanAction(action)) {
    return errorResponse("INVALID_INPUT", `Unknown action: ${String(action)}`);
  }

  if (!isRecord(payload)) {
    return errorResponse("INVALID_INPUT", "payload must be an object");
  }

  const supabase = dependencies.createUserClient(authHeader!);

  try {
    return await actionHandlers[action](payload, user.id, supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[meal-planner] ${action} error:`, message);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMealPlannerRequest(req));
}
