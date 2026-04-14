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

import {
  type AddRecipeToSlotResponse,
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
  type MealPlanSlotComponentResponse,
  type MealPlanSlotResponse,
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
  _userId: string,
  _supabase: UserClient,
): Promise<Response> {
  try {
    requireString(payload, "mealPlanId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const response: GenerateShoppingListResponse = {
    shoppingListId: null,
    warnings: [stubWarning("generate_shopping_list")],
  };
  return jsonResponse(response);
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

interface SlotRow {
  id: string;
  meal_plan_id: string;
  planned_date: string;
  day_index: number;
  meal_type: string;
  display_order: number;
  slot_type: string;
  structure_template: string;
  expected_food_groups: string[];
  selection_reason: string | null;
  shopping_sync_state: string;
  status: string;
  swap_count: number;
  last_swapped_at: string | null;
  cooked_at: string | null;
  skipped_at: string | null;
  merged_cooking_guide: Record<string, unknown> | null;
  meal_plan: { id: string; user_id: string } | null;
}

interface ComponentRow {
  id: string;
  component_role: string;
  source_kind: string;
  recipe_id: string | null;
  source_component_id: string | null;
  food_groups_snapshot: string[];
  pairing_basis: string;
  display_order: number;
  is_primary: boolean;
  title_snapshot: string;
  image_url_snapshot: string | null;
  total_time_snapshot: number | null;
  difficulty_snapshot: string | null;
  portions_snapshot: number | null;
  equipment_tags_snapshot: string[];
}

function componentRowToResponse(
  row: ComponentRow,
): MealPlanSlotComponentResponse {
  return {
    id: row.id,
    componentRole: row.component_role as MealPlanSlotComponentResponse[
      "componentRole"
    ],
    sourceKind: row.source_kind as MealPlanSlotComponentResponse["sourceKind"],
    recipeId: row.recipe_id,
    sourceComponentId: row.source_component_id,
    foodGroupsSnapshot: row.food_groups_snapshot ?? [],
    pairingBasis: row.pairing_basis as MealPlanSlotComponentResponse[
      "pairingBasis"
    ],
    displayOrder: row.display_order,
    isPrimary: row.is_primary,
    title: row.title_snapshot,
    imageUrl: row.image_url_snapshot,
    totalTimeMinutes: row.total_time_snapshot,
    difficulty: row
      .difficulty_snapshot as MealPlanSlotComponentResponse["difficulty"],
    portions: row.portions_snapshot,
    equipmentTags: row.equipment_tags_snapshot ?? [],
  };
}

function slotRowToResponse(
  row: SlotRow,
  components: ComponentRow[],
): MealPlanSlotResponse {
  return {
    id: row.id,
    plannedDate: row.planned_date,
    dayIndex: row.day_index,
    mealType: row.meal_type as MealPlanSlotResponse["mealType"],
    displayMealLabel: row.meal_type,
    displayOrder: row.display_order,
    slotType: row.slot_type as MealPlanSlotResponse["slotType"],
    structureTemplate: row.structure_template as MealPlanSlotResponse[
      "structureTemplate"
    ],
    expectedFoodGroups: row.expected_food_groups ?? [],
    selectionReason: row.selection_reason ?? "",
    shoppingSyncState: row.shopping_sync_state as MealPlanSlotResponse[
      "shoppingSyncState"
    ],
    status: row.status as MealPlanSlotResponse["status"],
    swapCount: row.swap_count,
    lastSwappedAt: row.last_swapped_at,
    cookedAt: row.cooked_at,
    skippedAt: row.skipped_at,
    mergedCookingGuide: row.merged_cooking_guide,
    components: components
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map(componentRowToResponse),
  };
}

async function handleAddRecipeToSlot(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  let mealPlanId: string;
  let mealPlanSlotId: string;
  let recipeId: string;
  try {
    mealPlanId = requireString(payload, "mealPlanId");
    mealPlanSlotId = requireString(payload, "mealPlanSlotId");
    recipeId = requireString(payload, "recipeId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  // Validate slot ownership and plan match in a single query.
  // deno-lint-ignore no-explicit-any
  const slotQuery = await (supabase as any)
    .from("meal_plan_slots")
    .select(
      "id, meal_plan_id, planned_date, day_index, meal_type, display_order, slot_type, structure_template, expected_food_groups, selection_reason, shopping_sync_state, status, swap_count, last_swapped_at, cooked_at, skipped_at, merged_cooking_guide, meal_plan:meal_plans!inner(id, user_id)",
    )
    .eq("id", mealPlanSlotId)
    .single();

  if (slotQuery.error || !slotQuery.data) {
    return errorResponse("PLAN_NOT_FOUND", "Slot not found", 404);
  }
  const slot = slotQuery.data as SlotRow;
  if (!slot.meal_plan || slot.meal_plan.user_id !== userId) {
    return errorResponse("UNAUTHORIZED", "Slot does not belong to user", 403);
  }
  if (slot.meal_plan.id !== mealPlanId) {
    return errorResponse(
      "INVALID_INPUT",
      "Slot does not belong to the given meal plan",
    );
  }

  // Load the recipe snapshot fields.
  // deno-lint-ignore no-explicit-any
  const recipeQuery = await (supabase as any)
    .from("recipes")
    .select(
      "id, image_url, total_time, difficulty, portions, equipment_tags, planner_role, food_groups, translations:recipe_translations(locale, name)",
    )
    .eq("id", recipeId)
    .single();

  if (recipeQuery.error || !recipeQuery.data) {
    return errorResponse("INVALID_INPUT", "Recipe not found");
  }
  const recipe = recipeQuery.data as {
    id: string;
    image_url: string | null;
    total_time: number | null;
    difficulty: string | null;
    portions: number | null;
    equipment_tags: string[] | null;
    planner_role: string | null;
    food_groups: string[] | null;
    translations: Array<{ locale: string; name: string }>;
  };

  const translation = recipe.translations?.find((t) => t.locale === "en") ??
    recipe.translations?.[0];
  const title = translation?.name ?? "Untitled";

  // Load existing components to decide display_order + primacy.
  // deno-lint-ignore no-explicit-any
  const existingQuery = await (supabase as any)
    .from("meal_plan_slot_components")
    .select(
      "id, component_role, source_kind, recipe_id, source_component_id, food_groups_snapshot, pairing_basis, display_order, is_primary, title_snapshot, image_url_snapshot, total_time_snapshot, difficulty_snapshot, portions_snapshot, equipment_tags_snapshot",
    )
    .eq("meal_plan_slot_id", mealPlanSlotId);

  if (existingQuery.error) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to load slot components",
      500,
    );
  }
  const existing = (existingQuery.data ?? []) as ComponentRow[];
  const nextDisplayOrder = existing.reduce(
    (max, c) => Math.max(max, c.display_order + 1),
    0,
  );
  const shouldBePrimary = existing.length === 0;

  const componentRole = recipe.planner_role === "main" || existing.length === 0
    ? "main"
    : "side";

  // deno-lint-ignore no-explicit-any
  const insertQuery = await (supabase as any)
    .from("meal_plan_slot_components")
    .insert({
      meal_plan_slot_id: mealPlanSlotId,
      component_role: componentRole,
      source_kind: "recipe",
      recipe_id: recipe.id,
      food_groups_snapshot: recipe.food_groups ?? [],
      pairing_basis: "manual",
      display_order: nextDisplayOrder,
      title_snapshot: title,
      image_url_snapshot: recipe.image_url,
      total_time_snapshot: recipe.total_time,
      difficulty_snapshot: recipe.difficulty,
      portions_snapshot: recipe.portions,
      equipment_tags_snapshot: recipe.equipment_tags ?? [],
      selection_reason: "explore_add",
      is_primary: shouldBePrimary,
    })
    .select(
      "id, component_role, source_kind, recipe_id, source_component_id, food_groups_snapshot, pairing_basis, display_order, is_primary, title_snapshot, image_url_snapshot, total_time_snapshot, difficulty_snapshot, portions_snapshot, equipment_tags_snapshot",
    )
    .single();

  if (insertQuery.error || !insertQuery.data) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to add recipe to slot",
      500,
    );
  }

  const updatedComponents = [...existing, insertQuery.data as ComponentRow];
  const response: AddRecipeToSlotResponse = {
    slot: slotRowToResponse(slot, updatedComponents),
    warnings: [],
  };
  return jsonResponse(response);
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
  add_recipe_to_slot: handleAddRecipeToSlot,
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
