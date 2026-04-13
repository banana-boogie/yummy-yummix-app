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

// ============================================================
// User context loading
// ============================================================

interface ProfileRow {
  locale: string | null;
  dietary_restrictions: string[] | null;
  diet_types: string[] | null;
  cuisine_preferences: string[] | null;
  other_allergy: unknown;
  kitchen_equipment: string[] | null;
  skill_level: string | null;
  household_size: number | null;
  ingredient_dislikes: string[] | null;
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
    hardExcluded,
    recentCooked,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(`
        locale,
        dietary_restrictions,
        diet_types,
        cuisine_preferences,
        other_allergy,
        kitchen_equipment,
        skill_level,
        household_size,
        ingredient_dislikes,
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
    loadHardExcludedRecipeIds(supabase, userId),
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
    dietTypes: profile?.diet_types ?? [],
    cuisinePreferences: profile?.cuisine_preferences ?? [],
    ingredientDislikes: profile?.ingredient_dislikes ?? [],
    kitchenEquipment: profile?.kitchen_equipment ?? [],
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
  try {
    const { data, error } = await supabase
      .from("user_events")
      .select("payload")
      .eq("user_id", userId)
      .eq("event_type", "cook_complete");
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

async function annotateAllergenConflicts(
  supabase: SupabaseClient,
  candidateMap: CandidateMap,
  dietaryRestrictions: string[],
): Promise<void> {
  if (dietaryRestrictions.length === 0) return;
  const allIds = new Set<string>();
  for (const list of candidateMap.cook.values()) {
    for (const c of list) allIds.add(c.id);
  }
  for (const list of candidateMap.fallback.values()) {
    for (const c of list) allIds.add(c.id);
  }
  if (allIds.size === 0) return;

  // Load allergen_groups → restriction → ingredient list.
  const { data: allergens } = await supabase
    .from("allergen_groups")
    .select("category, ingredient_canonical");
  if (!allergens) return;
  const allergenByRestriction = new Map<string, Set<string>>();
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
  if (allergenByRestriction.size === 0) return;

  const markConflict = (c: RecipeCandidate) => {
    for (const key of c.ingredientKeys) {
      const lower = key.toLowerCase();
      for (const [restriction, ingredients] of allergenByRestriction) {
        for (const ing of ingredients) {
          if (lower.includes(ing)) {
            c.hasAllergenConflict = true;
            if (!c.allergenMatches.includes(restriction)) {
              c.allergenMatches.push(restriction);
            }
          }
        }
      }
    }
  };
  for (const list of candidateMap.cook.values()) list.forEach(markConflict);
  for (const list of candidateMap.fallback.values()) list.forEach(markConflict);
}

// ============================================================
// Plan persistence
// ============================================================

interface PersistedPlan {
  plan: { id: string; created_at: string };
  slots: Array<{ id: string; slotId: string }>;
  components: Array<{ id: string; slotId: string; displayOrder: number }>;
}

async function persistPlan(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  locale: string,
  best: WeekState,
  slots: MealSlot[],
  missingSlots: MealSlot[],
  requestedDayIndexes: number[],
  requestedMealTypes: string[],
  replaceExisting: boolean,
): Promise<PersistedPlan> {
  // If an existing draft/active plan blocks insertion, archive or delete as
  // requested. The unique index only permits one active/draft per week.
  if (replaceExisting) {
    await supabase
      .from("meal_plans")
      .update({ status: "archived" })
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .in("status", ["draft", "active"]);
  }

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
    throw new Error(
      `Failed to create meal_plan: ${planError?.message ?? "unknown"}`,
    );
  }

  const planId = (plan as { id: string; created_at: string }).id;
  const createdAt = (plan as { id: string; created_at: string }).created_at ??
    new Date().toISOString();

  // Build slot rows in calendar order. Unfilled slots still get inserted so
  // the UI can render them as pending.
  const slotInserts: Array<Record<string, unknown>> = [];
  for (const slot of slots) {
    const assignment = best.assignments.get(slot.slotId);
    slotInserts.push({
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
    });
  }

  const { data: insertedSlots, error: slotsError } = await supabase
    .from("meal_plan_slots")
    .insert(slotInserts)
    .select("id, day_index, meal_type");

  if (slotsError || !insertedSlots) {
    throw new Error(
      `Failed to insert slots: ${slotsError?.message ?? "unknown"}`,
    );
  }

  // Map slotId → insertedId.
  const slotIdToInsertedId = new Map<string, string>();
  const inserted = insertedSlots as Array<
    { id: string; day_index: number; meal_type: string }
  >;
  for (let i = 0; i < slots.length; i++) {
    const insertedRow = inserted.find(
      (row) =>
        row.day_index === slots[i].dayIndex &&
        row.meal_type === slots[i].canonicalMealType,
    );
    if (insertedRow) slotIdToInsertedId.set(slots[i].slotId, insertedRow.id);
  }

  // Components: only for assigned slots.
  const componentInserts: Array<Record<string, unknown>> = [];
  for (const slot of slots) {
    const assignment = best.assignments.get(slot.slotId);
    if (!assignment) continue;
    const slotInsertedId = slotIdToInsertedId.get(slot.slotId);
    if (!slotInsertedId) continue;
    for (const comp of assignment.components) {
      const candidate = comp.candidate;
      componentInserts.push({
        meal_plan_slot_id: slotInsertedId,
        component_role: comp.role,
        source_kind: comp.sourceKind,
        recipe_id: candidate?.id ?? null,
        source_component_id: null, // leftover linkage is resolved post-insert
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
      });
    }
  }

  let insertedComponents:
    | Array<{ id: string; meal_plan_slot_id: string; display_order: number }>
    | undefined = [];
  if (componentInserts.length > 0) {
    const { data, error } = await supabase
      .from("meal_plan_slot_components")
      .insert(componentInserts)
      .select("id, meal_plan_slot_id, display_order");
    if (error) {
      throw new Error(`Failed to insert components: ${error.message}`);
    }
    insertedComponents = data as typeof insertedComponents;
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
    components: (insertedComponents ?? []).map((row) => ({
      id: row.id,
      slotId: row.meal_plan_slot_id,
      displayOrder: row.display_order,
    })),
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

  await annotateAllergenConflicts(
    supabase,
    candidateMap,
    user.dietaryRestrictions,
  );

  // Check thin-catalog condition for coverage warnings.
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
  );
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
    assembly.missingSlots,
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
