/**
 * Meal Planner Edge Function
 *
 * Authenticated POST handler for all meal planning operations. This module
 * holds request routing (auth, JSON parsing, action dispatch), all action
 * handlers, and shared `errorResponse` / `jsonResponse` helpers.
 *
 * Read-side helpers live in `./plan-loader.ts`; locale-label resolution in
 * `./meal-types.ts`; selection-reason copy in `./selection-reason-templates.ts`.
 */

import { corsHeaders } from "../_shared/cors.ts";
import {
  createServiceClient,
  createUserClient,
} from "../_shared/supabase-client.ts";
import { validateAuth } from "../_shared/auth.ts";
import { normalizeMealTypes, toCanonicalMealType } from "./meal-types.ts";
import {
  generatePlan,
  InsufficientRecipesError,
  PlanAlreadyExistsError,
} from "./plan-generator.ts";
import {
  loadActivePlan,
  loadPlanById,
  loadSlotWithPlan,
} from "./plan-loader.ts";
import { buildLocaleChain, pickTranslation } from "../_shared/locale-utils.ts";
import { renderSelectionReason } from "./selection-reason-templates.ts";

import {
  type ApprovePlanResponse,
  COMPONENT_ROLES,
  type ComponentRole,
  type GeneratePlanPayload,
  type GeneratePlanResponse,
  type GetCurrentPlanResponse,
  type GetPreferencesResponse,
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
  // The swap apply path needs an elevated client to invoke the
  // `apply_meal_plan_slot_swap` RPC, which is granted only to `service_role`
  // (its surface accepts arbitrary snapshot params, so we keep it off the
  // authenticated public RPC surface). Edge-side ownership validation runs
  // before the RPC call via `loadSlotWithPlan`, so elevating privilege after
  // that point is safe.
  createServiceClient: typeof createServiceClient;
  validateAuth: typeof validateAuth;
}

const DEFAULT_DEPENDENCIES: MealPlannerDependencies = {
  createUserClient,
  createServiceClient,
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
  // Null until the user's first successful `update_preferences` call.
  // The client treats this as the canonical "needs first-time setup" flag.
  setupCompletedAt: null,
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

function optionalString(
  payload: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = payload[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string when provided`);
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
 *
 * Column shape: `(user_id, event_type, payload)`. `payload` is JSONB. We
 * named the parameter `payload` to match the schema; an earlier draft used
 * `metadata` and the inserts silently 4xx'd against the constraint.
 */
async function logUserEvent(
  supabase: UserClient,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.from("user_events").insert({
      user_id: userId,
      event_type: eventType,
      payload,
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
  setup_completed_at: string | null;
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
    setupCompletedAt: row.setup_completed_at,
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
  recipe_to_tag?:
    | Array<{
      recipe_tags: {
        categories: string[] | null;
        recipe_tag_translations: Array<
          { locale: string; name: string | null }
        >;
      } | null;
    }>
    | null;
}

/**
 * Derive canonical meal-type tags from a candidate row's tag join. Returns the
 * set of meal types this recipe is tagged with (e.g. ["dinner", "lunch"]).
 * Used to filter swap alternatives so a breakfast recipe doesn't surface for
 * a dinner slot. Mirrors the logic in candidate-retrieval.ts.
 */
function deriveMealTypeTags(
  row: SwapCandidateRow,
): Set<import("./types.ts").CanonicalMealType> {
  const tags = new Set<import("./types.ts").CanonicalMealType>();
  for (const link of row.recipe_to_tag ?? []) {
    const tag = link.recipe_tags;
    if (!tag?.categories?.includes("meal_type")) continue;
    for (const t of tag.recipe_tag_translations ?? []) {
      if (!t.name) continue;
      try {
        tags.add(toCanonicalMealType(t.name));
      } catch {
        // ignore non-canonical legacy names
      }
    }
  }
  return tags;
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
  deps: MealPlannerDependencies,
): Promise<Response> {
  let mealPlanId: string | undefined;
  let mealPlanSlotId: string;
  let selectedRecipeId: string | undefined;
  try {
    mealPlanId = optionalString(payload, "mealPlanId");
    mealPlanSlotId = requireString(payload, "mealPlanSlotId");
    selectedRecipeId = optionalString(payload, "selectedRecipeId");
  } catch (error) {
    return errorResponse("INVALID_INPUT", (error as Error).message);
  }

  const ctx = await loadSlotWithPlan(
    mealPlanSlotId,
    userId,
    supabase as never,
  );
  if (!ctx) return errorResponse("PLAN_NOT_FOUND", "Slot not found", 404);
  if (mealPlanId !== undefined && ctx.plan.planId !== mealPlanId) {
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
    deps,
    userId,
    plan,
    slot,
    primary,
    selectedRecipeId,
    rejectedRecipeIds,
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
      recipe_translations(locale, name),
      recipe_to_tag(recipe_tags(categories, recipe_tag_translations(locale, name)))
    `)
    .eq("is_published", true)
    .or(`planner_role.eq.${role},alternate_planner_roles.cs.{${role}}`)
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("total_time", { ascending: true, nullsFirst: false })
    .limit(60);

  if (excluded.length > 0) {
    query = query.not("id", "in", `(${excluded.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch alternatives: ${error.message}`);

  // Filter by meal_type tag so e.g. breakfast recipes don't surface for dinner
  // slots. Recipes without any meal_type tags are excluded — un-tagged recipes
  // are catalog gaps to fix in the metadata pipeline (Plan 12), not silent
  // matches that would degrade swap quality.
  const allRows = (data ?? []) as unknown as SwapCandidateRow[];
  const rows = allRows.filter((r) => deriveMealTypeTags(r).has(slot.mealType));
  if (rows.length === 0) {
    return errorResponse(
      "SWAP_NOT_AVAILABLE",
      "No alternatives available for this slot",
      404,
    );
  }

  const alternatives: SwapAlternative[] = rows.slice(0, 3).map((row) => {
    const title = pickName(row.recipe_translations ?? null, plan.locale);
    const reason = renderSelectionReason(
      row.verified_at ? "swap_alternative_verified" : "swap_alternative_quick",
      plan.locale,
    );
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
  deps: MealPlannerDependencies,
  userId: string,
  plan: import("./types.ts").MealPlanResponse,
  slot: import("./types.ts").MealPlanSlotResponse,
  primary: import("./types.ts").MealPlanSlotComponentResponse,
  selectedRecipeId: string,
  rejectedRecipeIds: Set<string>,
): Promise<Response> {
  // Validate `selectedRecipeId` against the same eligibility rules used by
  // the browse path so a stale or crafted client can't slot a beverage into
  // a dinner main, re-apply a previously rejected recipe, or pick the slot's
  // current primary. Cheap defense-in-depth — RLS doesn't enforce role
  // compatibility because role is a recipe column, not a user-scoped one.
  if (!UUID_PATTERN.test(selectedRecipeId)) {
    return errorResponse("INVALID_INPUT", "selectedRecipeId must be a UUID");
  }
  if (selectedRecipeId === primary.recipeId) {
    return errorResponse(
      "INVALID_INPUT",
      "selectedRecipeId already occupies this slot",
    );
  }
  if (rejectedRecipeIds.has(selectedRecipeId)) {
    return errorResponse(
      "INVALID_INPUT",
      "selectedRecipeId has been rejected for this slot",
    );
  }

  const role = primary.componentRole;
  // role was already validated against COMPONENT_ROLES at the browse-path
  // entry; double-check here so apply can stand alone if the contract ever
  // splits browse and apply into separate actions.
  if (!VALID_COMPONENT_ROLES.has(role)) {
    throw new Error(`Unexpected componentRole: ${role}`);
  }
  // Fetch with the same role + published filter the browse path applies.
  // If the row isn't returned, the recipe is unpublished, role-incompatible,
  // or doesn't exist — all map to INVALID_INPUT.
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
      recipe_translations(locale, name),
      recipe_to_tag(recipe_tags(categories, recipe_tag_translations(locale, name)))
    `)
    .eq("id", selectedRecipeId)
    .eq("is_published", true)
    .or(`planner_role.eq.${role},alternate_planner_roles.cs.{${role}}`)
    .maybeSingle();
  if (recipeErr) {
    throw new Error(`Failed to load recipe: ${recipeErr.message}`);
  }
  if (!recipeRow) {
    return errorResponse(
      "INVALID_INPUT",
      "selectedRecipeId is not eligible for this slot",
    );
  }

  const recipe = recipeRow as unknown as SwapCandidateRow & {
    is_published: boolean;
  };
  // Same meal_type filter the browse path applies — keeps applySwap aligned
  // with what the user could have actually been shown.
  if (!deriveMealTypeTags(recipe).has(slot.mealType)) {
    return errorResponse(
      "INVALID_INPUT",
      "selectedRecipeId is not eligible for this slot",
    );
  }
  const title = pickName(recipe.recipe_translations ?? null, plan.locale);

  // Required writes (component snapshot, slot bump, plan stale) run in a
  // single transactional RPC so a partial failure can't leave the user
  // looking at a refreshed recipe with a stale swap_count or out-of-sync
  // freshness flags. `pairing_basis: "swap"` (set inside the RPC)
  // distinguishes user-picked-from-alternatives from `manual` (planner-
  // bypass) for analytics.
  //
  // The RPC is granted ONLY to `service_role` — its surface accepts
  // arbitrary snapshot params, so we keep it off the authenticated public
  // RPC surface. Edge-side validation above (ownership via RLS-scoped
  // `loadSlotWithPlan`, plus role/publication/meal-type/rejection guards)
  // gates access; we elevate after that point to write transactionally.
  const serviceClient = deps.createServiceClient();
  const nowIso = new Date().toISOString();
  const { error: rpcErr } = await serviceClient.rpc(
    "apply_meal_plan_slot_swap",
    {
      p_component_id: primary.id,
      p_recipe_id: recipe.id,
      p_title_snapshot: title,
      p_image_url_snapshot: recipe.image_url,
      p_total_time_snapshot: recipe.total_time,
      p_difficulty_snapshot: recipe.difficulty,
      p_portions_snapshot: recipe.portions,
      p_equipment_tags_snapshot: recipe.equipment_tags ?? [],
      p_meal_components_snapshot: recipe.meal_components ?? [],
      p_slot_id: slot.id,
      p_plan_id: plan.planId,
      p_now: nowIso,
    },
  );
  if (rpcErr) {
    throw new Error(`Failed to apply swap: ${rpcErr.message}`);
  }

  // Rejection is best-effort and runs OUTSIDE the transaction. Schema
  // requires `recipe_id` on rejection rows; custom/leftover slots (no
  // replaced recipe) skip the insert rather than violating the constraint.
  // Losing a rejection row only causes the same recipe to reappear in the
  // next browse — annoying but not corrupting.
  if (primary.recipeId) {
    const { error: rejErr } = await supabase
      .from("meal_plan_slot_rejections")
      .insert({
        meal_plan_slot_id: slot.id,
        component_role: primary.componentRole,
        recipe_id: primary.recipeId,
        rejection_source: "user",
        reason_code: "user_swap",
      });
    if (rejErr) {
      console.warn(
        `[meal-planner] swap_meal: failed to record rejection: ${rejErr.message}`,
      );
    }
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
  const appliedReason = renderSelectionReason("swap_applied", plan.locale);
  const response: SwapMealResponse = {
    alternatives: [{
      slot: refreshed.slot,
      selectionReason: appliedReason,
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
  let mealPlanId: string | undefined;
  let mealPlanSlotId: string;
  try {
    mealPlanId = optionalString(payload, "mealPlanId");
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
  if (mealPlanId !== undefined && ctx.plan.planId !== mealPlanId) {
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
  let mealPlanId: string | undefined;
  let mealPlanSlotId: string;
  try {
    mealPlanId = optionalString(payload, "mealPlanId");
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
  if (mealPlanId !== undefined && ctx.plan.planId !== mealPlanId) {
    return errorResponse(
      "INVALID_INPUT",
      "mealPlanId does not match the slot's parent plan",
    );
  }

  // Idempotency guard: if the slot is already cooked, return its current
  // state without re-writing `cooked_at` or re-emitting the analytics event.
  // Protects against double-taps and retries.
  if (ctx.slot.status === "cooked") {
    const response: MarkMealCookedResponse = {
      slot: ctx.slot,
      warnings: [],
    };
    return jsonResponse(response);
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

  const status = (planRow as { status: string }).status;
  // Archived plans cannot be re-approved — silently no-oping would mislead the
  // UI into thinking the call succeeded.
  if (status === "archived") {
    return errorResponse(
      "INVALID_INPUT",
      "Cannot approve an archived plan",
      400,
    );
  }

  // Idempotent: re-approving an already-active plan returns the current state
  // without touching DB rows or re-emitting the analytics event. Only flip
  // status and log the transition when moving from draft → active.
  if (status === "draft") {
    const { error: updateErr } = await supabase
      .from("meal_plans")
      .update({ status: "active" })
      .eq("id", mealPlanId);
    if (updateErr) {
      throw new Error(`Failed to approve plan: ${updateErr.message}`);
    }
    await logUserEvent(supabase, userId, "meal_plan_approved", {
      meal_plan_id: mealPlanId,
    });
  }
  console.info(`[meal-planner] approve_plan ok: plan=${mealPlanId}`);

  // Reload the specific plan we just approved (NOT loadActivePlan, which
  // would return whichever draft/active plan is most recent — that may be
  // a different plan if the user has more than one in flight).
  const plan = await loadPlanById(mealPlanId, userId, supabase as never);
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
  _payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Response {
  // Track B (shopping list integration) is not on this branch. Return 501
  // so the UI cannot accidentally treat a stubbed null `shoppingListId` as
  // success. When Track B lands, replace this with the real implementation.
  return errorResponse(
    "NOT_IMPLEMENTED",
    "generate_shopping_list is not yet implemented (Track B pending)",
    501,
  );
}

async function handleGetPreferences(
  _payload: Record<string, unknown>,
  userId: string,
  supabase: UserClient,
): Promise<Response> {
  const { data, error } = await supabase
    .from("user_meal_planning_preferences")
    .select(
      "meal_types, busy_days, active_day_indexes, default_max_weeknight_minutes, auto_leftovers, preferred_eat_times, setup_completed_at",
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
      "meal_types, busy_days, active_day_indexes, default_max_weeknight_minutes, auto_leftovers, preferred_eat_times, setup_completed_at",
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

  // First-save-wins: stamp `setup_completed_at` only when the existing row
  // (if any) had it null. This is the canonical "first-time setup done"
  // signal the client reads — replaces any client-side flag.
  const setupCompletedAt = base.setupCompletedAt ?? new Date().toISOString();
  next.setupCompletedAt = setupCompletedAt;

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
      setup_completed_at: setupCompletedAt,
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
  _payload: Record<string, unknown>,
  _userId: string,
  _supabase: UserClient,
): Response {
  return errorResponse(
    "NOT_IMPLEMENTED",
    "link_shopping_list is not yet implemented (Track B pending)",
    501,
  );
}

const actionHandlers: Record<
  MealPlanAction,
  (
    payload: Record<string, unknown>,
    userId: string,
    supabase: UserClient,
    deps: MealPlannerDependencies,
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
    return await actionHandlers[action](
      payload,
      user.id,
      supabase,
      dependencies,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[meal-planner] ${action} error:`, message);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMealPlannerRequest(req));
}
