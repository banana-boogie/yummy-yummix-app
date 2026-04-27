/**
 * Meal Planner Edge Function
 *
 * Authenticated POST handler for all meal planning operations.
 *
 * Action handlers split out one-per-file in `./handlers/`. This module is
 * the request-routing front door: auth, JSON parsing, action dispatch, and
 * the shared `errorResponse` / `jsonResponse` helpers.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";
import { validateAuth } from "../_shared/auth.ts";
import { normalizeMealTypes } from "./meal-types.ts";
import {
  generatePlan,
  InsufficientRecipesError,
  PlanAlreadyExistsError,
} from "./plan-generator.ts";
import { loadActivePlan, loadSlotWithPlan } from "./plan-loader.ts";
import { buildLocaleChain, pickTranslation } from "../_shared/locale-utils.ts";

import {
  type ApprovePlanResponse,
  COMPONENT_ROLES,
  type ComponentRole,
  type GeneratePlanPayload,
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
  type PreferencesResponse,
  type SkipMealResponse,
  type SwapAlternative,
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
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Postgres UUIDs — used to defensively validate any IDs we interpolate into
// PostgREST filter strings.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_COMPONENT_ROLES = new Set<ComponentRole>(COMPONENT_ROLES);

export const DEFAULT_PREFERENCES: PreferencesResponse = {
  mealTypes: ["dinner"],
  busyDays: [],
  activeDayIndexes: [0, 1, 2, 3, 4],
  defaultMaxWeeknightMinutes: 45,
  // Default true globally — Mexican comida-recalentado culture is the
  // primary target market and reheated leftovers are positively framed.
  // Users (or the chat orchestrator on a per-generation basis) can disable
  // when they want fresh meals throughout the week.
  autoLeftovers: true,
  preferredEatTimes: {},
};

// ============================================================
// Response helpers
// ============================================================

function errorResponse(
  code: MealPlannerErrorCode,
  message: string,
  status = 400,
  warnings?: string[],
): Response {
  const body: MealPlannerErrorResponse = { error: { code, message } };
  if (warnings && warnings.length > 0) body.warnings = warnings;
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

// ============================================================
// Payload parsers
// ============================================================

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

function parseWeekStart(payload: Record<string, unknown>): string {
  const weekStart = requireString(payload, "weekStart");
  if (!ISO_DATE_PATTERN.test(weekStart)) {
    throw new Error("weekStart must be a valid ISO date in YYYY-MM-DD format");
  }

  const parsed = new Date(`${weekStart}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== weekStart
  ) {
    throw new Error("weekStart must be a valid ISO date in YYYY-MM-DD format");
  }

  return weekStart;
}

function parseOptionalWeekStart(
  payload: Record<string, unknown>,
): string | undefined {
  if (payload.weekStart === undefined) return undefined;
  return parseWeekStart(payload);
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
  base: PreferencesResponse = DEFAULT_PREFERENCES,
): PreferencesResponse {
  const next: PreferencesResponse = {
    ...base,
    preferredEatTimes: { ...base.preferredEatTimes },
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

  if (payload.autoLeftovers !== undefined) {
    if (typeof payload.autoLeftovers !== "boolean") {
      throw new Error("autoLeftovers must be a boolean");
    }
    next.autoLeftovers = payload.autoLeftovers;
  }

  if (payload.preferredEatTimes !== undefined) {
    if (!isRecord(payload.preferredEatTimes)) {
      throw new Error("preferredEatTimes must be an object");
    }
    next.preferredEatTimes = payload.preferredEatTimes;
  }

  return next;
}

// ============================================================
// Analytics helpers
// ============================================================

/**
 * Best-effort insert into `user_events`. Failures are logged but never bubble
 * up — analytics must not fail user-facing mutations.
 */
async function logUserEvent(
  supabase: UserClient,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.from("user_events").insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    });
    if (error) {
      console.warn(`[meal-planner] failed to log ${eventType}:`, error.message);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[meal-planner] exception logging ${eventType}:`, msg);
  }
}

// ============================================================
// Preference row mapping
// ============================================================

interface PreferencesRow {
  meal_types: string[] | null;
  busy_days: number[] | null;
  active_day_indexes: number[] | null;
  default_max_weeknight_minutes: number | null;
  auto_leftovers: boolean | null;
  preferred_eat_times: Record<string, unknown> | null;
}

function rowToPreferences(row: PreferencesRow): PreferencesResponse {
  return {
    mealTypes:
      (row.meal_types ?? DEFAULT_PREFERENCES.mealTypes) as PreferencesResponse[
        "mealTypes"
      ],
    busyDays: row.busy_days ?? DEFAULT_PREFERENCES.busyDays,
    activeDayIndexes: row.active_day_indexes ??
      DEFAULT_PREFERENCES.activeDayIndexes,
    defaultMaxWeeknightMinutes: row.default_max_weeknight_minutes ??
      DEFAULT_PREFERENCES.defaultMaxWeeknightMinutes,
    autoLeftovers: row.auto_leftovers ?? DEFAULT_PREFERENCES.autoLeftovers,
    preferredEatTimes: row.preferred_eat_times ?? {},
  };
}

// ============================================================
// Handlers
// ============================================================

async function handleGetCurrentPlan(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  let weekStart: string | undefined;
  try {
    weekStart = parseOptionalWeekStart(payload);
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const plan = await loadActivePlan(userId, supabase as never, weekStart);
  const response: GetCurrentPlanResponse = { plan, warnings: [] };
  return jsonResponse(response);
}

async function handleGeneratePlan(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  let typedPayload: GeneratePlanPayload;
  let includeDebugTrace = false;
  try {
    const weekStart = parseWeekStart(payload);
    const dayIndexes = parseDayIndexArray(payload.dayIndexes, "dayIndexes");

    const rawMealTypes = payload.mealTypes;
    if (!Array.isArray(rawMealTypes) || rawMealTypes.length === 0) {
      throw new Error("mealTypes is required and must be a non-empty array");
    }
    if (rawMealTypes.some((entry) => typeof entry !== "string")) {
      throw new Error("mealTypes entries must be strings");
    }
    // Validate canonical mapping; we keep raw labels so comida displays as comida.
    normalizeMealTypes(rawMealTypes as string[]);

    const busyDays = payload.busyDays !== undefined
      ? parseDayIndexArray(payload.busyDays, "busyDays")
      : undefined;

    if (
      payload.autoLeftovers !== undefined &&
      typeof payload.autoLeftovers !== "boolean"
    ) {
      throw new Error("autoLeftovers must be a boolean");
    }

    if (
      payload.replaceExisting !== undefined &&
      typeof payload.replaceExisting !== "boolean"
    ) {
      throw new Error("replaceExisting must be a boolean");
    }

    if (payload.debug !== undefined && typeof payload.debug !== "boolean") {
      throw new Error("debug must be a boolean");
    }
    includeDebugTrace = payload.debug === true;

    typedPayload = {
      weekStart,
      dayIndexes,
      mealTypes: rawMealTypes as string[],
      busyDays,
      autoLeftovers: payload.autoLeftovers as boolean | undefined,
      replaceExisting: payload.replaceExisting as boolean | undefined,
    };
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  try {
    const result = await generatePlan({
      payload: typedPayload,
      userId,
      supabase: supabase as never,
    });

    const response:
      & GeneratePlanResponse
      & { debugTrace?: unknown } = {
        plan: result.plan,
        isPartial: result.isPartial,
        missingSlots: result.missingSlots,
        warnings: result.warnings,
      };
    if (includeDebugTrace) response.debugTrace = result.debugTrace;
    return jsonResponse(response);
  } catch (error) {
    if (error instanceof PlanAlreadyExistsError) {
      return errorResponse("PLAN_ALREADY_EXISTS", error.message, 409);
    }
    if (error instanceof InsufficientRecipesError) {
      return errorResponse(
        "INSUFFICIENT_RECIPES",
        error.message,
        422,
        error.warnings,
      );
    }
    throw error;
  }
}

interface SwapCandidateRow {
  id: string;
  planner_role: string | null;
  alternate_planner_roles: string[] | null;
  meal_components: string[] | null;
  total_time: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  portions: number | null;
  image_url: string | null;
  equipment_tags: string[] | null;
  verified_at: string | null;
  recipe_translations:
    | Array<{ locale: string; name: string | null }>
    | null;
}

function pickName(
  rows: Array<{ locale: string; name: string | null }> | null,
  locale: string,
): string {
  const match = pickTranslation(rows ?? undefined, buildLocaleChain(locale));
  return match?.name ?? "";
}

async function handleSwapMeal(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  let mealPlanId: string;
  let mealPlanSlotId: string;
  let selectedRecipeId: string | undefined;
  try {
    mealPlanId = requireString(payload, "mealPlanId");
    mealPlanSlotId = requireString(payload, "mealPlanSlotId");
    if (payload.selectedRecipeId !== undefined) {
      if (
        typeof payload.selectedRecipeId !== "string" ||
        payload.selectedRecipeId.length === 0
      ) {
        throw new Error("selectedRecipeId must be a non-empty string");
      }
      selectedRecipeId = payload.selectedRecipeId;
    }
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const ctx = await loadSlotWithPlan(
    mealPlanSlotId,
    userId,
    supabase as never,
  );
  if (!ctx) return errorResponse("PLAN_NOT_FOUND", "Slot not found", 404);
  if (ctx.plan.planId !== mealPlanId) {
    return errorResponse(
      "INVALID_INPUT",
      "mealPlanId does not match the slot's parent plan",
    );
  }

  const { plan, slot } = ctx;
  const primary = slot.components.find((c) => c.isPrimary);
  if (!primary) {
    return errorResponse(
      "SWAP_NOT_AVAILABLE",
      "Slot has no primary component to swap",
      400,
    );
  }

  // Collect rejected recipe IDs from prior swaps so they don't reappear.
  const { data: rejectionRows } = await supabase
    .from("meal_plan_slot_rejections")
    .select("recipe_id")
    .eq("meal_plan_slot_id", slot.id);
  const rejectedRecipeIds = new Set<string>(
    ((rejectionRows ?? []) as Array<{ recipe_id: string }>).map((r) =>
      r.recipe_id
    ),
  );

  if (selectedRecipeId === undefined) {
    return await respondWithSwapAlternatives(
      supabase,
      plan,
      slot,
      primary,
      rejectedRecipeIds,
    );
  }

  return await applySwap(
    supabase,
    userId,
    plan,
    slot,
    primary,
    selectedRecipeId,
  );
}

async function respondWithSwapAlternatives(
  supabase: UserClient,
  plan: { locale: string },
  slot: import("./types.ts").MealPlanSlotResponse,
  primary: import("./types.ts").MealPlanSlotComponentResponse,
  rejectedRecipeIds: Set<string>,
): Promise<Response> {
  // Direct SQL prefilter — narrower than `fetchCandidates` but sufficient for
  // a swap browse: same primary role (or alternate role match), excludes
  // current and rejected recipes, only published recipes.
  // TODO(plan-14-followup): wire up the scoring core from `scoring/index.ts`
  // so alternatives are ranked against the user's week context (variety,
  // taste, time fit) instead of the current verified+quick heuristic.

  // PostgREST `.or()` and `.not("id","in",...)` interpolate values into a
  // filter-language string. Validate against the typed enum/UUID shape
  // before composing so a future schema broadening or unvalidated source
  // can't sneak filter-language metacharacters into the query.
  const role = primary.componentRole;
  if (!VALID_COMPONENT_ROLES.has(role)) {
    throw new Error(`Unexpected componentRole: ${role}`);
  }
  const excluded = [primary.recipeId, ...rejectedRecipeIds].filter(
    (id): id is string => typeof id === "string" && UUID_PATTERN.test(id),
  );

  let query = supabase
    .from("recipes")
    .select(`
      id,
      planner_role,
      alternate_planner_roles,
      meal_components,
      total_time,
      difficulty,
      portions,
      image_url,
      equipment_tags,
      verified_at,
      recipe_translations(locale, name)
    `)
    .eq("is_published", true)
    .or(`planner_role.eq.${role},alternate_planner_roles.cs.{${role}}`)
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("total_time", { ascending: true, nullsFirst: false })
    .limit(20);

  if (excluded.length > 0) {
    query = query.not("id", "in", `(${excluded.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch alternatives: ${error.message}`);

  const rows = (data ?? []) as SwapCandidateRow[];
  if (rows.length === 0) {
    return errorResponse(
      "SWAP_NOT_AVAILABLE",
      "No alternatives available for this slot",
      404,
    );
  }

  const alternatives: SwapAlternative[] = rows.slice(0, 3).map((row) => {
    const title = pickName(row.recipe_translations ?? null, plan.locale);
    const reason = row.verified_at
      ? "Verified recipe that fits this slot."
      : "Quick alternative for this slot.";
    return {
      slot: {
        ...slot,
        components: slot.components.map((c) =>
          c.isPrimary
            ? {
              ...c,
              recipeId: row.id,
              title,
              imageUrl: row.image_url,
              totalTimeMinutes: row.total_time,
              difficulty: row.difficulty,
              portions: row.portions,
              equipmentTags: row.equipment_tags ?? [],
              mealComponentsSnapshot: row.meal_components ?? [],
            }
            : c
        ),
        selectionReason: reason,
      },
      selectionReason: reason,
    };
  });

  const response: SwapMealResponse = { alternatives, warnings: [] };
  return jsonResponse(response);
}

async function applySwap(
  supabase: UserClient,
  userId: string,
  plan: import("./types.ts").MealPlanResponse,
  slot: import("./types.ts").MealPlanSlotResponse,
  primary: import("./types.ts").MealPlanSlotComponentResponse,
  selectedRecipeId: string,
): Promise<Response> {
  // Fetch the selected recipe with the same fields we snapshot at generation.
  const { data: recipeRow, error: recipeErr } = await supabase
    .from("recipes")
    .select(`
      id,
      planner_role,
      alternate_planner_roles,
      meal_components,
      total_time,
      difficulty,
      portions,
      image_url,
      equipment_tags,
      verified_at,
      is_published,
      recipe_translations(locale, name)
    `)
    .eq("id", selectedRecipeId)
    .maybeSingle();
  if (recipeErr) {
    throw new Error(`Failed to load recipe: ${recipeErr.message}`);
  }
  if (!recipeRow || !(recipeRow as { is_published: boolean }).is_published) {
    return errorResponse(
      "INVALID_INPUT",
      "selectedRecipeId is not a usable recipe",
    );
  }

  const recipe = recipeRow as unknown as SwapCandidateRow & {
    is_published: boolean;
  };
  const title = pickName(recipe.recipe_translations ?? null, plan.locale);

  // The four post-validation writes touch disjoint rows so we run them in
  // parallel — saves 3 round-trips on a path users notice. Refresh the
  // primary component's snapshot, increment swap_count + flip slot stale,
  // flip plan stale, and record the rejection for the replaced recipe.
  // `pairing_basis: "manual"` matches the existing schema enum — the user
  // picked from the planner's offered alternatives, so the original
  // automatic pairing basis no longer applies.
  const nowIso = new Date().toISOString();
  // Schema requires `recipe_id` on rejection rows; custom/leftover slots
  // (no replaced recipe) skip the insert rather than violating the
  // constraint.
  const rejectionInsert = primary.recipeId
    ? supabase
      .from("meal_plan_slot_rejections")
      .insert({
        meal_plan_slot_id: slot.id,
        component_role: primary.componentRole,
        recipe_id: primary.recipeId,
        rejection_source: "user",
        reason_code: "user_swap",
      })
    : Promise.resolve({ error: null });

  const [
    { error: compErr },
    { error: slotErr },
    { error: planErr },
    { error: rejErr },
  ] = await Promise.all([
    supabase
      .from("meal_plan_slot_components")
      .update({
        recipe_id: recipe.id,
        title_snapshot: title,
        image_url_snapshot: recipe.image_url,
        total_time_snapshot: recipe.total_time,
        difficulty_snapshot: recipe.difficulty,
        portions_snapshot: recipe.portions,
        equipment_tags_snapshot: recipe.equipment_tags ?? [],
        meal_components_snapshot: recipe.meal_components ?? [],
        pairing_basis: "manual",
      })
      .eq("id", primary.id),
    supabase
      .from("meal_plan_slots")
      .update({
        swap_count: (slot.swapCount ?? 0) + 1,
        last_swapped_at: nowIso,
        shopping_sync_state: "stale",
      })
      .eq("id", slot.id),
    supabase
      .from("meal_plans")
      .update({ shopping_sync_state: "stale" })
      .eq("id", plan.planId),
    rejectionInsert,
  ]);

  if (compErr) {
    throw new Error(`Failed to update component: ${compErr.message}`);
  }
  if (slotErr) throw new Error(`Failed to update slot: ${slotErr.message}`);
  if (planErr) throw new Error(`Failed to update plan: ${planErr.message}`);
  // Rejection is best-effort: the swap still succeeds even if we failed to
  // record the rejection. Worst case the user sees the same recipe back in
  // the next browse — annoying but not corrupting.
  if (rejErr) {
    console.warn(
      `[meal-planner] swap_meal: failed to record rejection: ${rejErr.message}`,
    );
  }

  await logUserEvent(supabase, userId, "meal_plan_meal_swapped", {
    meal_plan_id: plan.planId,
    meal_plan_slot_id: slot.id,
    from_recipe_id: primary.recipeId,
    to_recipe_id: recipe.id,
  });

  // Reload the slot so callers see the persisted state, including the
  // refreshed snapshots and incremented swap count.
  const refreshed = await loadSlotWithPlan(slot.id, userId, supabase as never);
  if (!refreshed) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Slot disappeared after swap",
      500,
    );
  }

  console.info(`[meal-planner] swap_meal ok: slot=${slot.id}`);
  const response: SwapMealResponse = {
    alternatives: [{
      slot: refreshed.slot,
      selectionReason: "applied",
    }],
    warnings: [],
  };
  return jsonResponse(response);
}

async function handleSkipMeal(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  let mealPlanId: string;
  let mealPlanSlotId: string;
  try {
    mealPlanId = requireString(payload, "mealPlanId");
    mealPlanSlotId = requireString(payload, "mealPlanSlotId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const ctx = await loadSlotWithPlan(
    mealPlanSlotId,
    userId,
    supabase as never,
  );
  if (!ctx) return errorResponse("PLAN_NOT_FOUND", "Slot not found", 404);
  if (ctx.plan.planId !== mealPlanId) {
    return errorResponse(
      "INVALID_INPUT",
      "mealPlanId does not match the slot's parent plan",
    );
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("meal_plan_slots")
    .update({
      status: "skipped",
      skipped_at: nowIso,
      // Per Plan 14 § 5.6: the shopping list isn't auto-regenerated when a
      // meal is skipped. Mark stale so the UI can offer manual refresh.
      shopping_sync_state: "stale",
    })
    .eq("id", mealPlanSlotId);
  if (error) throw new Error(`Failed to skip slot: ${error.message}`);

  await logUserEvent(supabase, userId, "meal_plan_skipped", {
    meal_plan_id: ctx.plan.planId,
    meal_plan_slot_id: mealPlanSlotId,
  });

  console.info(`[meal-planner] skip_meal ok: slot=${mealPlanSlotId}`);

  const refreshed = await loadSlotWithPlan(
    mealPlanSlotId,
    userId,
    supabase as never,
  );
  // TODO(plan-14-followup): compute the ingredient-salvage suggestion text
  // (forgiveness mechanic, Plan 14 § 5.6). Returning null here keeps the
  // contract stable so the UI can render an empty state without crashing.
  const response: SkipMealResponse = {
    slot: refreshed?.slot ?? null,
    suggestion: null,
    warnings: [],
  };
  return jsonResponse(response);
}

async function handleMarkMealCooked(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  let mealPlanId: string;
  let mealPlanSlotId: string;
  try {
    mealPlanId = requireString(payload, "mealPlanId");
    mealPlanSlotId = requireString(payload, "mealPlanSlotId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const ctx = await loadSlotWithPlan(
    mealPlanSlotId,
    userId,
    supabase as never,
  );
  if (!ctx) return errorResponse("PLAN_NOT_FOUND", "Slot not found", 404);
  if (ctx.plan.planId !== mealPlanId) {
    return errorResponse(
      "INVALID_INPUT",
      "mealPlanId does not match the slot's parent plan",
    );
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("meal_plan_slots")
    .update({ status: "cooked", cooked_at: nowIso })
    .eq("id", mealPlanSlotId);
  if (error) throw new Error(`Failed to mark cooked: ${error.message}`);

  // TODO(plan-14-followup): emit positive implicit-preference signal into
  // `user_implicit_preferences` and (if the helper lands) a `recipe_completion`
  // row. Plan 14 § 5.5 marks both as best-effort and ships them later.
  await logUserEvent(supabase, userId, "planned_meal_cook_completed", {
    meal_plan_id: ctx.plan.planId,
    meal_plan_slot_id: mealPlanSlotId,
  });

  console.info(`[meal-planner] mark_meal_cooked ok: slot=${mealPlanSlotId}`);

  const refreshed = await loadSlotWithPlan(
    mealPlanSlotId,
    userId,
    supabase as never,
  );
  const response: MarkMealCookedResponse = {
    slot: refreshed?.slot ?? null,
    warnings: [],
  };
  return jsonResponse(response);
}

async function handleApprovePlan(
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

  const { data: planRow, error: lookupErr } = await supabase
    .from("meal_plans")
    .select("id, status")
    .eq("id", mealPlanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`Failed to load plan: ${lookupErr.message}`);
  }
  if (!planRow) {
    return errorResponse("PLAN_NOT_FOUND", "Plan not found", 404);
  }

  // Idempotent: re-approving an already-active plan returns the current state
  // without touching DB rows. Only flip status when transitioning from draft.
  if ((planRow as { status: string }).status === "draft") {
    const { error: updateErr } = await supabase
      .from("meal_plans")
      .update({ status: "active" })
      .eq("id", mealPlanId);
    if (updateErr) {
      throw new Error(`Failed to approve plan: ${updateErr.message}`);
    }
  }

  await logUserEvent(supabase, userId, "meal_plan_approved", {
    meal_plan_id: mealPlanId,
  });
  console.info(`[meal-planner] approve_plan ok: plan=${mealPlanId}`);

  const plan = await loadActivePlan(userId, supabase as never);
  // Track B (shopping list) and merged-cooking-guide LLM are deferred to
  // follow-up PRs per Plan 14 § 4 + § 5.10. We surface zero counts so the
  // contract stays stable when those land.
  const response: ApprovePlanResponse = {
    plan,
    shoppingListId: plan?.shoppingListId ?? null,
    mergedGuidesGenerated: 0,
    mergedGuidesFailed: 0,
    warnings: [],
  };
  return jsonResponse(response);
}

function handleGenerateShoppingList(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Response {
  try {
    requireString(payload, "mealPlanId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  // Track B's shopping_lists / shopping_list_items tables aren't on this
  // branch yet (Plan 14 § 4 Option 2). Return a stub response with a warning
  // so the UI can show "shopping list pending"; the handler ships fully when
  // Track B's migration lands.
  const response: GenerateShoppingListResponse = {
    shoppingListId: null,
    warnings: ["SHOPPING_LIST_INTEGRATION_DEFERRED"],
  };
  return jsonResponse(response);
}

async function handleGetPreferences(
  _payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  const { data, error } = await supabase
    .from("user_meal_planning_preferences")
    .select(
      "meal_types, busy_days, active_day_indexes, default_max_weeknight_minutes, auto_leftovers, preferred_eat_times",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load preferences: ${error.message}`);

  const preferences = data
    ? rowToPreferences(data as PreferencesRow)
    : DEFAULT_PREFERENCES;
  const response: GetPreferencesResponse = { preferences, warnings: [] };
  return jsonResponse(response);
}

async function handleUpdatePreferences(
  payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  // Merge onto the user's existing preferences so partial payloads don't
  // wipe untouched fields. Falls back to DEFAULT_PREFERENCES for new users.
  // Read errors must surface as INTERNAL_ERROR — only payload validation
  // failures map to INVALID_INPUT.
  const { data: existing, error: readErr } = await supabase
    .from("user_meal_planning_preferences")
    .select(
      "meal_types, busy_days, active_day_indexes, default_max_weeknight_minutes, auto_leftovers, preferred_eat_times",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`Failed to load preferences: ${readErr.message}`);
  }
  const base = existing
    ? rowToPreferences(existing as PreferencesRow)
    : DEFAULT_PREFERENCES;

  let next: PreferencesResponse;
  try {
    next = buildPreferencesFromPayload(payload, base);
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const { error } = await supabase
    .from("user_meal_planning_preferences")
    .upsert({
      user_id: userId,
      meal_types: next.mealTypes,
      busy_days: next.busyDays,
      active_day_indexes: next.activeDayIndexes,
      default_max_weeknight_minutes: next.defaultMaxWeeknightMinutes,
      auto_leftovers: next.autoLeftovers,
      preferred_eat_times: next.preferredEatTimes,
    }, { onConflict: "user_id" });
  if (error) {
    throw new Error(`Failed to save preferences: ${error.message}`);
  }

  console.info(`[meal-planner] update_preferences ok: user=${userId}`);
  const response: UpdatePreferencesResponse = {
    preferences: next,
    updated: true,
    warnings: [],
  };
  return jsonResponse(response);
}

function handleLinkShoppingList(
  payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Response {
  let mealPlanId: string;
  let shoppingListId: string;
  try {
    mealPlanId = requireString(payload, "mealPlanId");
    shoppingListId = requireString(payload, "shoppingListId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  // See `handleGenerateShoppingList`. Persistence of the link is gated on
  // Track B's tables landing on this branch.
  const response: LinkShoppingListResponse = {
    linked: false,
    mealPlanId,
    shoppingListId,
    warnings: ["SHOPPING_LIST_INTEGRATION_DEFERRED"],
  };
  return jsonResponse(response);
}

const actionHandlers: Record<
  MealPlanAction,
  (
    payload: Record<string, unknown>,
    userId: string,
    supabase: UserClient,
  ) => Response | Promise<Response>
> = {
  get_current_plan: handleGetCurrentPlan,
  generate_plan: handleGeneratePlan,
  swap_meal: handleSwapMeal,
  skip_meal: handleSkipMeal,
  mark_meal_cooked: handleMarkMealCooked,
  approve_plan: handleApprovePlan,
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
