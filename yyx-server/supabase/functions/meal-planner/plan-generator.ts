/**
 * Plan Generator — top-level orchestrator.
 *
 * 1. Load user context (profile + implicit preferences + day patterns + history).
 * 2. Classify slots from the request.
 * 3. Retrieve candidates from SQL (hard filters).
 * 4. Assemble the week via beam search.
 * 5. Persist the draft plan + slots + components atomically.
 * 6. Build the API response and a JSON debug trace.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  classifySlots,
  type MealSlot,
  type SlotClassificationResult,
} from "./slot-classifier.ts";
import {
  type CandidateMap,
  countUniqueCandidates,
  fetchCandidates,
  loadHardExcludedRecipeIds,
  loadRecentCookedRecipeIds,
  type RecipeCandidate,
} from "./candidate-retrieval.ts";
import {
  fetchPairingsForCandidates,
  type PairingLookup,
} from "./bundle-builder.ts";
import {
  type AssembleResult,
  assembleWeek,
  type WeekState,
} from "./week-assembler.ts";
import type { SlotComponent } from "./bundle-builder.ts";
import { matchesAllergen } from "../_shared/allergen-filter.ts";
import type { UserContext } from "./scoring/types.ts";
import { buildLocaleChain } from "../_shared/locale-utils.ts";
import {
  HOUSEHOLD,
  SCORING_CONFIG_V1,
  THIN_CATALOG,
} from "./scoring-config.ts";
import type {
  CanonicalMealType,
  GeneratePlanPayload,
  GeneratePlanResponse,
  MealPlanResponse,
  MealPlanSlotComponentResponse,
  MealPlanSlotResponse,
  MissingSlot,
} from "./types.ts";
import type { NutritionGoal } from "./scoring-config.ts";
import { normalizeMealTypes } from "./meal-types.ts";

export interface GeneratePlanArgs {
  payload: GeneratePlanPayload;
  userId: string;
  supabase: SupabaseClient;
}

export interface DebugTrace {
  version: string;
  config: typeof SCORING_CONFIG_V1;
  mode: "normal" | "first_week_trust";
  slotCount: number;
  candidateCounts: Record<string, number>;
  totalUniqueCandidates: number;
  objectiveScore: number;
  assemblyBonus: number;
  assemblyPenalty: number;
  beamSize: number;
  warnings: string[];
  chosenSlots: Array<{
    slotId: string;
    slotKind: string;
    score: number;
    reason: string;
    primaryRecipeId: string | null;
    components: number;
  }>;
}

export interface GeneratePlanResult extends GeneratePlanResponse {
  debugTrace: DebugTrace;
}

/**
 * Thrown by `persistPlan` when a draft/active plan already exists for the same
 * (user_id, week_start). Two paths raise this:
 *   1. The preflight SELECT when `replaceExisting` is false.
 *   2. A Postgres 23505 unique-violation on the INSERT — hit when a concurrent
 *      request beat us past preflight and committed first. `existingPlanId`
 *      is null in that path since we can't cheaply recover the winning row.
 *
 * The request handler maps this to PLAN_ALREADY_EXISTS with HTTP 409.
 */
export class PlanAlreadyExistsError extends Error {
  public readonly existingPlanId: string | null;
  constructor(existingPlanId: string | null = null) {
    super(`A draft or active plan already exists for this week`);
    this.name = "PlanAlreadyExistsError";
    this.existingPlanId = existingPlanId;
  }
}

// ============================================================
// User context loading
// ============================================================

interface ProfileRow {
  locale: string | null;
  dietary_restrictions: string[] | null;
  cuisine_preferences: string[] | null;
  ingredient_dislikes: string[] | null;
  skill_level: string | null;
  household_size: number | null;
  nutrition_goal: string | null;
}

interface PreferencesRow {
  meal_types: string[] | null;
  busy_days: number[] | null;
  active_day_indexes: number[] | null;
  default_max_weeknight_minutes: number | null;
  prefer_leftovers_for_lunch: boolean | null;
}

interface ImplicitPrefRow {
  dimension_type: string;
  dimension_key: string;
  preference_score: number;
  confidence_score: number;
}

interface DayPatternRow {
  day_index: number;
  evidence_weeks: number;
}

async function loadUserContext(
  supabase: SupabaseClient,
  userId: string,
  payload: GeneratePlanPayload,
): Promise<UserContext> {
  const [
    profileResult,
    prefsResult,
    implicitResult,
    patternsResult,
    recentCooked,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(`
        locale,
        dietary_restrictions,
        cuisine_preferences,
        ingredient_dislikes,
        skill_level,
        household_size,
        nutrition_goal
      `)
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_meal_planning_preferences")
      .select(`
        meal_types,
        busy_days,
        active_day_indexes,
        default_max_weeknight_minutes,
        prefer_leftovers_for_lunch
      `)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_implicit_preferences")
      .select(
        "dimension_type, dimension_key, preference_score, confidence_score",
      )
      .eq("user_id", userId),
    supabase
      .from("user_day_patterns")
      .select("day_index, evidence_weeks")
      .eq("user_id", userId),
    loadRecentCookedRecipeIds(supabase, userId),
  ]);

  const profile = (profileResult.data as ProfileRow | null) ?? null;
  const prefs = (prefsResult.data as PreferencesRow | null) ?? null;

  const locale = profile?.locale ?? "en";
  const implicitPreferences = new Map<
    string,
    { score: number; confidence: number }
  >();
  for (const row of (implicitResult.data ?? []) as ImplicitPrefRow[]) {
    implicitPreferences.set(`${row.dimension_type}:${row.dimension_key}`, {
      score: Number(row.preference_score ?? 0),
      confidence: Number(row.confidence_score ?? 0),
    });
  }

  const evidenceWeeks = Math.max(
    0,
    ...((patternsResult.data ?? []) as DayPatternRow[]).map(
      (row) => row.evidence_weeks ?? 0,
    ),
  );

  // Cook-count map: consolidate across the recent-cooked window.
  const cookCountByRecipe = await loadCookCount(supabase, userId);

  return {
    userId,
    locale,
    localeChain: buildLocaleChain(locale),
    householdSize: profile?.household_size ?? HOUSEHOLD.defaultSize,
    skillLevel: (profile?.skill_level as UserContext["skillLevel"]) ?? null,
    dietaryRestrictions: profile?.dietary_restrictions ?? [],
    ingredientDislikes: profile?.ingredient_dislikes ?? [],
    cuisinePreferences: profile?.cuisine_preferences ?? [],
    nutritionGoal:
      (profile?.nutrition_goal ?? "no_preference") as NutritionGoal,
    preferLeftoversForLunch: payload.preferLeftoversForLunch ??
      prefs?.prefer_leftovers_for_lunch ??
      false,
    defaultMaxWeeknightMinutes: prefs?.default_max_weeknight_minutes ?? 45,
    implicitPreferences,
    evidenceWeeks,
    recentCookedRecipes: recentCooked,
    cookCountByRecipe,
  };
}

async function loadCookCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  // Bounded scan: matches the recentCookedRecipes window so the cook-count
  // map and the recency map describe the same slice of history. Plus a hard
  // row cap so a heavy user doesn't pull a giant payload per generation.
  const cutoff = new Date(Date.now() - 21 * 86_400_000).toISOString();
  try {
    const { data, error } = await supabase
      .from("user_events")
      .select("payload")
      .eq("user_id", userId)
      .eq("event_type", "cook_complete")
      .gte("created_at", cutoff)
      .limit(2000);
    if (error || !data) return map;
    for (const row of data as Array<{ payload: Record<string, unknown> }>) {
      const recipeId = row.payload?.recipe_id;
      if (typeof recipeId === "string" && recipeId.length > 0) {
        map.set(recipeId, (map.get(recipeId) ?? 0) + 1);
      }
    }
  } catch {
    // swallow
  }
  return map;
}

// ============================================================
// Leftover transform lookup
// ============================================================

async function loadLeftoverTransforms(
  supabase: SupabaseClient,
  primaryRecipeIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (primaryRecipeIds.length === 0) return map;
  const { data, error } = await supabase
    .from("recipe_pairings")
    .select("source_recipe_id, target_recipe_id")
    .eq("pairing_role", "leftover_transform")
    .in("source_recipe_id", primaryRecipeIds);
  if (error || !data) return map;
  for (
    const p of data as Array<
      { source_recipe_id: string; target_recipe_id: string }
    >
  ) {
    const list = map.get(p.source_recipe_id) ?? [];
    list.push(p.target_recipe_id);
    map.set(p.source_recipe_id, list);
  }
  return map;
}

// ============================================================
// Allergen annotation — marks candidates with hard conflicts.
// ============================================================

/**
 * Load the allergen → canonical-ingredient map once per request. Kept separate
 * from `annotateAllergenConflicts` so callers that also need it (pairings)
 * can avoid re-fetching.
 */
async function loadAllergenMap(
  supabase: SupabaseClient,
  dietaryRestrictions: string[],
): Promise<Map<string, Set<string>>> {
  const allergenByRestriction = new Map<string, Set<string>>();
  if (dietaryRestrictions.length === 0) return allergenByRestriction;

  const { data: allergens } = await supabase
    .from("allergen_groups")
    .select("category, ingredient_canonical");
  if (!allergens) return allergenByRestriction;

  for (
    const row of allergens as Array<
      { category: string; ingredient_canonical: string }
    >
  ) {
    if (!dietaryRestrictions.includes(row.category)) continue;
    const set = allergenByRestriction.get(row.category) ?? new Set<string>();
    set.add(row.ingredient_canonical.toLowerCase());
    allergenByRestriction.set(row.category, set);
  }
  return allergenByRestriction;
}

/**
 * Tag each candidate with allergen conflicts. Uses word-boundary matching via
 * `_shared/allergen-filter.ts:matchesAllergen` so canonicals like `bread`
 * don't false-positive against `breadfruit`. Exported for regression testing.
 */
export function annotateCandidates(
  candidates: Iterable<RecipeCandidate>,
  allergenByRestriction: Map<string, Set<string>>,
): void {
  if (allergenByRestriction.size === 0) return;
  for (const c of candidates) {
    for (const key of c.ingredientKeys) {
      for (const [restriction, ingredients] of allergenByRestriction) {
        for (const ing of ingredients) {
          if (matchesAllergen(key, ing)) {
            c.hasAllergenConflict = true;
            if (!c.allergenMatches.includes(restriction)) {
              c.allergenMatches.push(restriction);
            }
          }
        }
      }
    }
  }
}

async function annotateAllergenConflicts(
  supabase: SupabaseClient,
  candidateMap: CandidateMap,
  dietaryRestrictions: string[],
): Promise<Map<string, Set<string>>> {
  const allergenByRestriction = await loadAllergenMap(
    supabase,
    dietaryRestrictions,
  );
  if (allergenByRestriction.size === 0) return allergenByRestriction;
  for (const list of candidateMap.cook.values()) {
    annotateCandidates(list, allergenByRestriction);
  }
  for (const list of candidateMap.fallback.values()) {
    annotateCandidates(list, allergenByRestriction);
  }
  return allergenByRestriction;
}

/**
 * Normalize a user-provided dislike label into the same canonical-key shape
 * produced by `normalizeKey()` for recipe ingredient keys. That way word-
 * boundary allergen matching can compare apples to apples.
 */
function normalizeDislike(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/**
 * Tag each candidate with explicit-dislike conflicts. User-profile
 * `ingredient_dislikes` is a HARD reject signal (distinct from the soft
 * implicit-preference penalty handled in `scoring/taste-household-fit.ts`).
 * Uses the same `matchesAllergen` word-boundary helper so a dislike of
 * `"bread"` does not false-positive against `breadfruit`.
 *
 * Exported for regression testing.
 */
export function annotateDislikeConflicts(
  candidates: Iterable<RecipeCandidate>,
  ingredientDislikes: string[],
): void {
  if (ingredientDislikes.length === 0) return;
  const normalized = ingredientDislikes
    .map(normalizeDislike)
    .filter((d) => d.length > 0);
  if (normalized.length === 0) return;
  for (const c of candidates) {
    for (const key of c.ingredientKeys) {
      for (const dislike of normalized) {
        if (matchesAllergen(key, dislike)) {
          c.hasDislikeConflict = true;
          if (!c.dislikeMatches.includes(dislike)) {
            c.dislikeMatches.push(dislike);
          }
        }
      }
    }
  }
}

// ============================================================
// Plan persistence
// ============================================================

interface PersistedPlan {
  plan: { id: string; created_at: string };
  slots: Array<{ id: string; slotId: string }>;
  components: Array<{ id: string; slotId: string; displayOrder: number }>;
}

type ArchivedPlan = { id: string; previousStatus: string };

/**
 * Mutable reference populated by `writeFreshPlan` as it commits rows. If the
 * inner write throws partway through, the outer `persistPlan` catch reads
 * this to know what to clean up — specifically the orphan meal_plans row
 * that would otherwise block the archive-restore UPDATE on the partial
 * unique index `idx_meal_plans_active_week`.
 */
interface WriteRefs {
  newPlanId: string | null;
}

/**
 * Delete the orphan plan row (if any) created by a failed write. CASCADE
 * cleans the associated slots/components. Best-effort: errors are logged and
 * swallowed so the outer catch can still attempt archive restoration.
 */
async function deleteOrphanPlan(
  supabase: SupabaseClient,
  planId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("meal_plans")
      .delete()
      .eq("id", planId);
    if (error) {
      console.error(
        `[plan-generator] Failed to delete orphan plan ${planId}:`,
        error.message,
      );
    }
  } catch (err) {
    console.error(
      `[plan-generator] Exception deleting orphan plan ${planId}:`,
      err,
    );
  }
}

/**
 * Best-effort rollback of archived plans. If a later insert in the persistence
 * flow fails, we walk this list and try to restore each plan's previous status.
 * Errors during rollback are logged but swallowed — rollback itself is
 * best-effort. This is not a real transaction; the intent is to avoid leaving
 * the user with zero visible plans when generation fails partway through.
 *
 * Callers MUST delete the orphan new-plan row first. Otherwise the partial
 * unique index `idx_meal_plans_active_week` blocks the UPDATE back to
 * draft/active.
 */
async function restoreArchivedPlans(
  supabase: SupabaseClient,
  archived: ArchivedPlan[],
): Promise<void> {
  for (const plan of archived) {
    try {
      const { error } = await supabase
        .from("meal_plans")
        .update({ status: plan.previousStatus })
        .eq("id", plan.id);
      if (error) {
        console.error(
          `[plan-generator] Failed to restore plan ${plan.id} to ${plan.previousStatus}:`,
          error.message,
        );
      }
    } catch (err) {
      console.error(
        `[plan-generator] Exception restoring plan ${plan.id}:`,
        err,
      );
    }
  }
}

async function persistPlan(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  locale: string,
  best: WeekState,
  slots: MealSlot[],
  requestedDayIndexes: number[],
  requestedMealTypes: string[],
  replaceExisting: boolean,
): Promise<PersistedPlan> {
  // Preflight: the unique index only permits one draft/active plan per week.
  // If `replaceExisting` is false and such a plan exists, surface the
  // documented PLAN_ALREADY_EXISTS contract rather than letting the insert
  // throw a generic unique-constraint error that would map to INTERNAL_ERROR.
  if (!replaceExisting) {
    const { data: existing, error: existingError } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .in("status", ["draft", "active"])
      .maybeSingle();
    if (existingError) {
      throw new Error(
        `Failed to check for existing plan: ${existingError.message}`,
      );
    }
    if (existing?.id) {
      throw new PlanAlreadyExistsError(existing.id as string);
    }
  }

  // Archive the current draft/active plans for this week. Remember their
  // prior statuses so we can roll back if the subsequent inserts fail.
  const archived: ArchivedPlan[] = [];
  if (replaceExisting) {
    const { data: current, error: currentError } = await supabase
      .from("meal_plans")
      .select("id, status")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .in("status", ["draft", "active"]);
    if (currentError) {
      throw new Error(
        `Failed to load existing plans: ${currentError.message}`,
      );
    }
    for (
      const row of (current ?? []) as Array<{ id: string; status: string }>
    ) {
      archived.push({ id: row.id, previousStatus: row.status });
    }
    if (archived.length > 0) {
      const { error: archiveError } = await supabase
        .from("meal_plans")
        .update({ status: "archived" })
        .in("id", archived.map((p) => p.id));
      if (archiveError) {
        throw new Error(
          `Failed to archive existing plans: ${archiveError.message}`,
        );
      }
    }
  }

  const refs: WriteRefs = { newPlanId: null };
  try {
    return await writeFreshPlan(
      supabase,
      userId,
      weekStart,
      locale,
      best,
      slots,
      requestedDayIndexes,
      requestedMealTypes,
      refs,
    );
  } catch (err) {
    // Clean up the orphan new-plan row (if any) BEFORE restoring archived
    // plans. Otherwise the partial unique index blocks the archive restore
    // because the orphan is still status='draft' for the same (user_id,
    // week_start) tuple.
    if (refs.newPlanId) {
      await deleteOrphanPlan(supabase, refs.newPlanId);
    }
    if (archived.length > 0) {
      console.warn(
        `[plan-generator] Write failed after archive; attempting to restore ${archived.length} plan(s)`,
      );
      await restoreArchivedPlans(supabase, archived);
    }
    throw err;
  }
}

/**
 * Inner write path: insert plan, slots, then components in two phases so
 * `source_kind = 'leftover'` rows carry a real `source_component_id`
 * (required by the `components_source_lineage_check` CHECK constraint).
 *
 * Populates `refs.newPlanId` as soon as the plan row is committed, so the
 * outer `persistPlan` catch can delete the orphan on failure before trying
 * to restore archived plans.
 *
 * This function does not roll back. The outer `persistPlan` handles orphan
 * deletion and archive rollback when this throws.
 */
async function writeFreshPlan(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  locale: string,
  best: WeekState,
  slots: MealSlot[],
  requestedDayIndexes: number[],
  requestedMealTypes: string[],
  refs: WriteRefs,
): Promise<PersistedPlan> {
  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({
      user_id: userId,
      week_start: weekStart,
      status: "draft",
      locale,
      requested_day_indexes: requestedDayIndexes,
      requested_meal_types: requestedMealTypes,
      shopping_sync_state: "not_created",
    })
    .select("id, created_at")
    .single();

  if (planError || !plan) {
    // 23505 is Postgres' unique-violation. We see this when a concurrent
    // request beat us past our preflight and committed its plan first.
    // Surface the documented PLAN_ALREADY_EXISTS contract rather than leaking
    // the raw DB error up as INTERNAL_ERROR.
    const code = (planError as { code?: string } | null)?.code;
    if (code === "23505") {
      throw new PlanAlreadyExistsError(null);
    }
    throw new Error(
      `Failed to create meal_plan: ${planError?.message ?? "unknown"}`,
    );
  }

  const planId = (plan as { id: string; created_at: string }).id;
  refs.newPlanId = planId;
  const createdAt = (plan as { id: string; created_at: string }).created_at ??
    new Date().toISOString();

  // Insert slots first; unfilled slots still land so the UI can render them.
  const slotInserts: Array<Record<string, unknown>> = slots.map((slot) => {
    const assignment = best.assignments.get(slot.slotId);
    return {
      meal_plan_id: planId,
      planned_date: slot.plannedDate,
      day_index: slot.dayIndex,
      meal_type: slot.canonicalMealType,
      display_order: 0,
      slot_type: slot.slotKind,
      structure_template: slot.structureTemplate,
      expected_food_groups: assignment?.components.flatMap((c) =>
        c.foodGroupsSnapshot
      ) ?? [],
      selection_reason: assignment?.selectionReason ?? null,
      shopping_sync_state: "not_created",
      status: "planned",
      swap_count: 0,
    };
  });

  const { data: insertedSlots, error: slotsError } = await supabase
    .from("meal_plan_slots")
    .insert(slotInserts)
    .select("id, day_index, meal_type");

  if (slotsError || !insertedSlots) {
    throw new Error(
      `Failed to insert slots: ${slotsError?.message ?? "unknown"}`,
    );
  }

  const inserted = insertedSlots as Array<
    { id: string; day_index: number; meal_type: string }
  >;

  // Map in-memory slotId → inserted DB UUID.
  const slotIdToInsertedId = new Map<string, string>();
  for (const slot of slots) {
    const insertedRow = inserted.find(
      (row) =>
        row.day_index === slot.dayIndex &&
        row.meal_type === slot.canonicalMealType,
    );
    if (insertedRow) slotIdToInsertedId.set(slot.slotId, insertedRow.id);
  }

  // Phase 1: insert every component whose source_kind is not 'leftover'.
  // This includes primaries (recipe/no_cook) and secondary pairing components.
  // We need their DB UUIDs before we can fill in `source_component_id` on any
  // downstream leftover rows.
  const phase1Rows: Array<{ slotId: string; comp: SlotComponent }> = [];
  const phase2Rows: Array<{ slotId: string; comp: SlotComponent }> = [];

  for (const slot of slots) {
    const assignment = best.assignments.get(slot.slotId);
    if (!assignment) continue;
    for (const comp of assignment.components) {
      if (comp.sourceKind === "leftover") {
        phase2Rows.push({ slotId: slot.slotId, comp });
      } else {
        phase1Rows.push({ slotId: slot.slotId, comp });
      }
    }
  }

  const phase1Inserts = phase1Rows.map(({ slotId, comp }) => {
    const slotDBId = slotIdToInsertedId.get(slotId);
    return {
      meal_plan_slot_id: slotDBId,
      component_role: comp.role,
      source_kind: comp.sourceKind,
      recipe_id: comp.candidate?.id ?? null,
      source_component_id: null,
      food_groups_snapshot: comp.foodGroupsSnapshot,
      pairing_basis: comp.pairingBasis,
      display_order: comp.displayOrder,
      title_snapshot: comp.titleSnapshot,
      image_url_snapshot: comp.imageSnapshot,
      total_time_snapshot: comp.totalTimeSnapshot,
      difficulty_snapshot: comp.difficultySnapshot,
      portions_snapshot: comp.portionsSnapshot,
      equipment_tags_snapshot: comp.equipmentSnapshot,
      selection_reason: comp.selectionReason ?? null,
      is_primary: comp.isPrimary,
    };
  });

  let phase1DB: Array<{
    id: string;
    meal_plan_slot_id: string;
    display_order: number;
    is_primary: boolean;
  }> = [];
  if (phase1Inserts.length > 0) {
    const { data, error } = await supabase
      .from("meal_plan_slot_components")
      .insert(phase1Inserts)
      .select("id, meal_plan_slot_id, display_order, is_primary");
    if (error) {
      throw new Error(
        `Failed to insert components (phase 1): ${error.message}`,
      );
    }
    phase1DB = (data ?? []) as typeof phase1DB;
  }

  // Build lookup: in-memory slotId → primary component DB UUID. Each cook
  // slot should have at most one primary component.
  const primaryComponentIdBySlot = new Map<string, string>();
  for (const [slotId, slotDBId] of slotIdToInsertedId) {
    const primary = phase1DB.find(
      (row) => row.meal_plan_slot_id === slotDBId && row.is_primary,
    );
    if (primary) primaryComponentIdBySlot.set(slotId, primary.id);
  }

  // Phase 2: insert leftover components with real source_component_id UUIDs
  // so they satisfy the schema's leftover lineage check.
  let phase2DB: Array<{
    id: string;
    meal_plan_slot_id: string;
    display_order: number;
  }> = [];
  if (phase2Rows.length > 0) {
    const phase2Inserts = phase2Rows.map(({ slotId, comp }) => {
      const slotDBId = slotIdToInsertedId.get(slotId);
      const sourceSlotId = comp.sourceSlotIdRef ?? "";
      const sourceComponentId = primaryComponentIdBySlot.get(sourceSlotId);
      if (!sourceComponentId) {
        throw new Error(
          `Leftover component for slot ${slotId} references unknown source slot ${sourceSlotId}`,
        );
      }
      return {
        meal_plan_slot_id: slotDBId,
        component_role: comp.role,
        source_kind: comp.sourceKind,
        recipe_id: null,
        source_component_id: sourceComponentId,
        food_groups_snapshot: comp.foodGroupsSnapshot,
        pairing_basis: comp.pairingBasis,
        display_order: comp.displayOrder,
        title_snapshot: comp.titleSnapshot,
        image_url_snapshot: comp.imageSnapshot,
        total_time_snapshot: comp.totalTimeSnapshot,
        difficulty_snapshot: comp.difficultySnapshot,
        portions_snapshot: comp.portionsSnapshot,
        equipment_tags_snapshot: comp.equipmentSnapshot,
        selection_reason: comp.selectionReason ?? null,
        is_primary: comp.isPrimary,
      };
    });
    const { data, error } = await supabase
      .from("meal_plan_slot_components")
      .insert(phase2Inserts)
      .select("id, meal_plan_slot_id, display_order");
    if (error) {
      throw new Error(
        `Failed to insert components (phase 2): ${error.message}`,
      );
    }
    phase2DB = (data ?? []) as typeof phase2DB;

    // Back-fill the in-memory `sourceComponentId` so `buildResponse` can
    // return real lineage to callers.
    for (let i = 0; i < phase2Rows.length; i++) {
      const entry = phase2Rows[i];
      const sourceSlotId = entry.comp.sourceSlotIdRef ?? "";
      const sourceComponentId = primaryComponentIdBySlot.get(sourceSlotId);
      if (sourceComponentId) entry.comp.sourceComponentId = sourceComponentId;
    }
  }

  return {
    plan: { id: planId, created_at: createdAt },
    slots: inserted.map((row) => ({
      id: row.id,
      slotId: slots.find(
        (s) =>
          s.dayIndex === row.day_index && s.canonicalMealType === row.meal_type,
      )?.slotId ?? "",
    })),
    components: [
      ...phase1DB.map((row) => ({
        id: row.id,
        slotId: row.meal_plan_slot_id,
        displayOrder: row.display_order,
      })),
      ...phase2DB.map((row) => ({
        id: row.id,
        slotId: row.meal_plan_slot_id,
        displayOrder: row.display_order,
      })),
    ],
  };
}

// ============================================================
// Response building
// ============================================================

function buildResponse(
  planId: string,
  weekStart: string,
  locale: string,
  requestedDayIndexes: number[],
  requestedMealTypes: string[],
  slots: MealSlot[],
  best: WeekState,
  persisted: PersistedPlan,
): MealPlanResponse {
  const slotsOut: MealPlanSlotResponse[] = [];
  for (const slot of slots) {
    const assignment = best.assignments.get(slot.slotId);
    const persistedSlot = persisted.slots.find((s) => s.slotId === slot.slotId);
    const components: MealPlanSlotComponentResponse[] = [];
    if (assignment) {
      for (const comp of assignment.components) {
        const persistedComp = persisted.components.find(
          (c) =>
            c.slotId === persistedSlot?.id &&
            c.displayOrder === comp.displayOrder,
        );
        components.push({
          id: persistedComp?.id ?? "",
          componentRole: comp.role,
          sourceKind: comp.sourceKind,
          recipeId: comp.recipeId,
          sourceComponentId: comp.sourceComponentId,
          foodGroupsSnapshot: comp.foodGroupsSnapshot,
          pairingBasis: comp.pairingBasis,
          displayOrder: comp.displayOrder,
          isPrimary: comp.isPrimary,
          title: comp.titleSnapshot,
          imageUrl: comp.imageSnapshot,
          totalTimeMinutes: comp.totalTimeSnapshot,
          difficulty: comp.difficultySnapshot,
          portions: comp.portionsSnapshot,
          equipmentTags: comp.equipmentSnapshot,
        });
      }
    }
    slotsOut.push({
      id: persistedSlot?.id ?? "",
      plannedDate: slot.plannedDate,
      dayIndex: slot.dayIndex,
      mealType: slot.canonicalMealType,
      displayMealLabel: slot.displayMealLabel,
      displayOrder: 0,
      slotType: slot.slotKind,
      structureTemplate: slot.structureTemplate,
      expectedFoodGroups: assignment?.components.flatMap((c) =>
        c.foodGroupsSnapshot
      ) ?? [],
      selectionReason: assignment?.selectionReason ?? "",
      shoppingSyncState: "not_created",
      status: "planned",
      swapCount: 0,
      lastSwappedAt: null,
      cookedAt: null,
      skippedAt: null,
      mergedCookingGuide: null,
      components,
    });
  }

  return {
    planId,
    weekStart,
    locale,
    requestedDayIndexes,
    requestedMealTypes,
    shoppingListId: null,
    shoppingSyncState: "not_created",
    slots: slotsOut,
  };
}

function buildDebugTrace(
  mode: WeekState["mode"],
  slots: MealSlot[],
  candidates: CandidateMap,
  best: WeekState,
  beam: WeekState[],
  warnings: string[],
): DebugTrace {
  const candidateCounts: Record<string, number> = {};
  for (const [slotId, list] of candidates.cook) {
    candidateCounts[`cook:${slotId}`] = list.length;
  }
  for (const [slotId, list] of candidates.fallback) {
    candidateCounts[`fallback:${slotId}`] = list.length;
  }
  const chosenSlots = slots.map((slot) => {
    const assignment = best.assignments.get(slot.slotId);
    const primary = assignment?.components.find((c) => c.isPrimary);
    return {
      slotId: slot.slotId,
      slotKind: slot.slotKind,
      score: assignment?.slotScore ?? 0,
      reason: assignment?.selectionReason ?? "",
      primaryRecipeId: primary?.recipeId ?? null,
      components: assignment?.components.length ?? 0,
    };
  });
  return {
    version: SCORING_CONFIG_V1.version,
    config: SCORING_CONFIG_V1,
    mode,
    slotCount: slots.length,
    candidateCounts,
    totalUniqueCandidates: countUniqueCandidates(candidates),
    objectiveScore: best.objectiveScore,
    assemblyBonus: best.assemblyBonus,
    assemblyPenalty: best.assemblyPenalty,
    beamSize: beam.length,
    warnings,
    chosenSlots,
  };
}

// ============================================================
// Main entry
// ============================================================

export async function generatePlan(
  args: GeneratePlanArgs,
): Promise<GeneratePlanResult> {
  const { payload, userId, supabase } = args;

  const canonicalMealTypes = normalizeMealTypes(payload.mealTypes);
  const requestedMealTypes = canonicalMealTypes as CanonicalMealType[];
  const requestedDayIndexes = payload.dayIndexes;

  const user = await loadUserContext(supabase, userId, payload);

  const classification: SlotClassificationResult = classifySlots({
    weekStart: payload.weekStart,
    dayIndexes: payload.dayIndexes,
    mealTypes: payload.mealTypes,
    busyDays: payload.busyDays ?? [],
    preferLeftoversForLunch: user.preferLeftoversForLunch,
    locale: user.locale,
  });

  const warnings: string[] = [];
  if (classification.slots.length === 0) {
    return {
      plan: null,
      isPartial: true,
      missingSlots: [],
      warnings: ["NO_SLOTS_REQUESTED"],
      debugTrace: buildDebugTrace(
        user.evidenceWeeks === 0 ? "first_week_trust" : "normal",
        [],
        { cook: new Map(), fallback: new Map() },
        {
          assignments: new Map(),
          assignedRecipeIds: new Set(),
          assignedProteinByDayIndex: new Map(),
          assignedCuisineCounts: new Map(),
          ingredientIdUsage: new Map(),
          leftoverSources: new Map(),
          noveltyCount: 0,
          mode: user.evidenceWeeks === 0 ? "first_week_trust" : "normal",
          slotIndex: 0,
          objectiveScore: 0,
          assemblyBonus: 0,
          assemblyPenalty: 0,
          warnings: [],
        },
        [],
        ["NO_SLOTS_REQUESTED"],
      ),
    };
  }

  const hardExcluded = await loadHardExcludedRecipeIds(supabase, userId);
  const candidateMap = await fetchCandidates(classification.slots, {
    supabase,
    locale: user.locale,
    localeChain: user.localeChain,
    dietaryRestrictions: user.dietaryRestrictions,
    ingredientDislikes: user.ingredientDislikes,
    hardExcludedRecipeIds: hardExcluded,
  });

  const allergenByRestriction = await annotateAllergenConflicts(
    supabase,
    candidateMap,
    user.dietaryRestrictions,
  );

  // Explicit dislikes are a hard reject — same treatment as allergens but
  // scoped to the user's own preferences rather than the shared allergen map.
  if (user.ingredientDislikes.length > 0) {
    for (const list of candidateMap.cook.values()) {
      annotateDislikeConflicts(list, user.ingredientDislikes);
    }
    for (const list of candidateMap.fallback.values()) {
      annotateDislikeConflicts(list, user.ingredientDislikes);
    }
  }

  // Check thin-catalog condition for coverage warnings.
  //
  // Warning string format: `CODE` or `CODE:key=value[:key=value]...`.
  // Clients detect a warning class with `.startsWith("CODE")` and parse the
  // colon-separated `key=value` pairs for detail. Kept as strings (not
  // structured objects) to match the `warnings: string[]` API contract; if
  // we ever need richer client-side filtering, switch the contract to
  // `warnings: Array<{ code: string; detail?: Record<string, unknown> }>`.
  const primaryRecipeIds = new Set<string>();
  for (const list of candidateMap.cook.values()) {
    for (const c of list) primaryRecipeIds.add(c.id);
  }
  const uniqueTotal = countUniqueCandidates(candidateMap);
  if (uniqueTotal < THIN_CATALOG.totalPublishedThreshold) {
    warnings.push(`LIMITED_CATALOG_COVERAGE:total=${uniqueTotal}`);
  }

  for (const [slotId, list] of candidateMap.cook) {
    if (list.length < THIN_CATALOG.viableCandidatesPerSlotThreshold) {
      warnings.push(`LIMITED_CATALOG_COVERAGE:slot=${slotId}:n=${list.length}`);
    }
  }

  const pairings: PairingLookup = await fetchPairingsForCandidates(
    supabase,
    [...primaryRecipeIds],
    user.localeChain,
  );
  // Paired side/base/dessert/condiment candidates must go through the same
  // allergen + dislike filters as primaries — otherwise a user with a gluten
  // allergy could get an allergen-safe primary dish with a gluten-containing
  // side, and similarly for explicit dislikes.
  if (allergenByRestriction.size > 0) {
    annotateCandidates(pairings.candidatesById.values(), allergenByRestriction);
  }
  if (user.ingredientDislikes.length > 0) {
    annotateDislikeConflicts(
      pairings.candidatesById.values(),
      user.ingredientDislikes,
    );
  }

  const leftoverTransformByRecipe = await loadLeftoverTransforms(
    supabase,
    [...primaryRecipeIds],
  );

  const assembly: AssembleResult = assembleWeek({
    slots: classification.slots,
    planningOrder: classification.planningOrder,
    candidates: candidateMap,
    pairings,
    user,
    leftoverTransformByRecipe,
  });

  for (const w of assembly.best.warnings) warnings.push(w);

  const persisted = await persistPlan(
    supabase,
    userId,
    payload.weekStart,
    user.locale,
    assembly.best,
    classification.slots,
    requestedDayIndexes,
    requestedMealTypes as unknown as string[],
    payload.replaceExisting ?? true,
  );

  const plan = buildResponse(
    persisted.plan.id,
    payload.weekStart,
    user.locale,
    requestedDayIndexes,
    requestedMealTypes as unknown as string[],
    classification.slots,
    assembly.best,
    persisted,
  );

  const missingSlotsOut: MissingSlot[] = assembly.missingSlots.map((s) => ({
    dayIndex: s.dayIndex,
    mealType: s.canonicalMealType,
  }));

  const debugTrace = buildDebugTrace(
    assembly.best.mode,
    classification.slots,
    candidateMap,
    assembly.best,
    assembly.beamCandidates,
    warnings,
  );

  return {
    plan,
    isPartial: missingSlotsOut.length > 0,
    missingSlots: missingSlotsOut,
    warnings,
    debugTrace,
  };
}
