/**
 * Plan Loader — read-side helpers for the meal-planner edge function.
 *
 * Centralizes the SELECT shape used by every read path (`get_current_plan`,
 * `swap_meal`, `skip_meal`, `mark_meal_cooked`, `approve_plan`) so the wire
 * contract stays in one place.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type {
  CanonicalMealType,
  ComponentRole,
  MealPlanResponse,
  MealPlanSlotComponentResponse,
  MealPlanSlotResponse,
  MealPlanStatus,
  PairingBasis,
  ShoppingSyncState,
  SlotStatus,
  SlotType,
  SourceKind,
  StructureTemplate,
} from "./types.ts";

interface PlanRow {
  id: string;
  user_id: string;
  week_start: string;
  status: MealPlanStatus;
  locale: string;
  requested_day_indexes: number[] | null;
  requested_meal_types: string[] | null;
  shopping_list_id: string | null;
  shopping_sync_state: ShoppingSyncState;
  meal_plan_slots: SlotRow[] | null;
}

interface SlotRow {
  id: string;
  planned_date: string;
  day_index: number;
  meal_type: CanonicalMealType;
  display_order: number | null;
  slot_type: SlotType;
  structure_template: StructureTemplate;
  expected_meal_components: string[] | null;
  coverage_complete: boolean | null;
  selection_reason: string | null;
  shopping_sync_state: ShoppingSyncState;
  status: SlotStatus;
  swap_count: number | null;
  last_swapped_at: string | null;
  cooked_at: string | null;
  skipped_at: string | null;
  merged_cooking_guide: Record<string, unknown> | null;
  meal_plan_slot_components: ComponentRow[] | null;
}

interface ComponentRow {
  id: string;
  component_role: ComponentRole;
  source_kind: SourceKind;
  recipe_id: string | null;
  source_component_id: string | null;
  meal_components_snapshot: string[] | null;
  pairing_basis: PairingBasis;
  display_order: number | null;
  is_primary: boolean;
  title_snapshot: string;
  image_url_snapshot: string | null;
  total_time_snapshot: number | null;
  difficulty_snapshot: "easy" | "medium" | "hard" | null;
  portions_snapshot: number | null;
  equipment_tags_snapshot: string[] | null;
}

const PLAN_SELECT = `
  id,
  user_id,
  week_start,
  status,
  locale,
  requested_day_indexes,
  requested_meal_types,
  shopping_list_id,
  shopping_sync_state,
  meal_plan_slots (
    id,
    planned_date,
    day_index,
    meal_type,
    display_order,
    slot_type,
    structure_template,
    expected_meal_components,
    coverage_complete,
    selection_reason,
    shopping_sync_state,
    status,
    swap_count,
    last_swapped_at,
    cooked_at,
    skipped_at,
    merged_cooking_guide,
    meal_plan_slot_components (
      id,
      component_role,
      source_kind,
      recipe_id,
      source_component_id,
      meal_components_snapshot,
      pairing_basis,
      display_order,
      is_primary,
      title_snapshot,
      image_url_snapshot,
      total_time_snapshot,
      difficulty_snapshot,
      portions_snapshot,
      equipment_tags_snapshot
    )
  )
`;

function mapComponent(row: ComponentRow): MealPlanSlotComponentResponse {
  return {
    id: row.id,
    componentRole: row.component_role,
    sourceKind: row.source_kind,
    recipeId: row.recipe_id,
    sourceComponentId: row.source_component_id,
    mealComponentsSnapshot: row.meal_components_snapshot ?? [],
    pairingBasis: row.pairing_basis,
    displayOrder: row.display_order ?? 0,
    isPrimary: row.is_primary,
    title: row.title_snapshot,
    imageUrl: row.image_url_snapshot,
    totalTimeMinutes: row.total_time_snapshot,
    difficulty: row.difficulty_snapshot,
    portions: row.portions_snapshot,
    equipmentTags: row.equipment_tags_snapshot ?? [],
  };
}

function displayMealLabelFor(
  mealType: CanonicalMealType,
  locale: string,
): string {
  if (locale.startsWith("es")) {
    switch (mealType) {
      case "breakfast":
        return "desayuno";
      case "lunch":
        return "comida";
      case "dinner":
        return "cena";
      case "snack":
        return "snack";
      case "dessert":
        return "postre";
      case "beverage":
        return "bebida";
    }
  }
  return mealType;
}

function mapSlot(row: SlotRow, locale: string): MealPlanSlotResponse {
  const components = (row.meal_plan_slot_components ?? [])
    .map(mapComponent)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    id: row.id,
    plannedDate: row.planned_date,
    dayIndex: row.day_index,
    mealType: row.meal_type,
    displayMealLabel: displayMealLabelFor(row.meal_type, locale),
    displayOrder: row.display_order ?? 0,
    slotType: row.slot_type,
    structureTemplate: row.structure_template,
    expectedMealComponents: row.expected_meal_components ?? [],
    coverageComplete: row.coverage_complete ?? true,
    selectionReason: row.selection_reason ?? "",
    shoppingSyncState: row.shopping_sync_state,
    status: row.status,
    swapCount: row.swap_count ?? 0,
    lastSwappedAt: row.last_swapped_at,
    cookedAt: row.cooked_at,
    skippedAt: row.skipped_at,
    mergedCookingGuide: row.merged_cooking_guide,
    components,
  };
}

function mapPlan(row: PlanRow): MealPlanResponse {
  const slots = (row.meal_plan_slots ?? [])
    .map((slot) => mapSlot(slot, row.locale))
    .sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return a.displayOrder - b.displayOrder;
    });

  return {
    planId: row.id,
    weekStart: row.week_start,
    locale: row.locale,
    requestedDayIndexes: row.requested_day_indexes ?? [],
    requestedMealTypes: row.requested_meal_types ?? [],
    shoppingListId: row.shopping_list_id,
    shoppingSyncState: row.shopping_sync_state,
    slots,
  };
}

/**
 * Load the user's most recent draft/active plan (or the one for `weekStart`
 * if provided). Returns null when no plan exists. RLS scopes the query to
 * the calling user, so no manual ownership check is required.
 */
export async function loadActivePlan(
  userId: string,
  supabase: SupabaseClient,
  weekStart?: string,
): Promise<MealPlanResponse | null> {
  let query = supabase
    .from("meal_plans")
    .select(PLAN_SELECT)
    .eq("user_id", userId)
    .in("status", ["draft", "active"])
    .order("week_start", { ascending: false })
    .limit(1);

  if (weekStart) query = query.eq("week_start", weekStart);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to load plan: ${error.message}`);
  if (!data) return null;

  return mapPlan(data as unknown as PlanRow);
}

/**
 * Load the plan a slot belongs to plus the slot itself. Returns null when
 * the slot doesn't exist or doesn't belong to the calling user (RLS).
 */
export async function loadSlotWithPlan(
  slotId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ plan: MealPlanResponse; slot: MealPlanSlotResponse } | null> {
  const { data: slotRef, error: slotErr } = await supabase
    .from("meal_plan_slots")
    .select("id, meal_plan_id")
    .eq("id", slotId)
    .maybeSingle();
  if (slotErr) throw new Error(`Failed to load slot: ${slotErr.message}`);
  if (!slotRef) return null;

  const { data, error } = await supabase
    .from("meal_plans")
    .select(PLAN_SELECT)
    .eq("id", (slotRef as { meal_plan_id: string }).meal_plan_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load plan: ${error.message}`);
  if (!data) return null;

  const plan = mapPlan(data as unknown as PlanRow);
  const slot = plan.slots.find((s) => s.id === slotId);
  if (!slot) return null;

  return { plan, slot };
}
