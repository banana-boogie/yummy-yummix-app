/**
 * Plan Context Loader
 *
 * Loads a minimal view of the user's active meal plan to inject into the
 * Irmixy system prompt. Cheap: one indexed lookup by (user_id, status) plus
 * a bounded slot fetch. Returns null when there's no active plan.
 *
 * This is intentionally tolerant: any error (table missing on older envs,
 * RLS edge case, transient failure) collapses to null so chat stays healthy.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface PlanContextNextMeal {
  plannedDate: string;
  dayIndex: number;
  mealType: string;
  title: string | null;
}

export interface PlanContext {
  planId: string;
  weekStart: string;
  nextMeal: PlanContextNextMeal | null;
}

interface NextSlotRow {
  id: string;
  planned_date: string;
  day_index: number;
  meal_type: string;
  meal_plan_slot_components:
    | Array<{
      title_snapshot: string | null;
      is_primary: boolean | null;
      display_order: number | null;
    }>
    | null;
}

/**
 * Load the user's active meal plan context.
 * Returns null if none exists, the lookup fails, or the stub shape is empty.
 */
export async function loadPlanContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanContext | null> {
  try {
    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .select("id, week_start")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError || !plan) return null;

    const today = new Date().toISOString().slice(0, 10);

    const { data: slots, error: slotsError } = await supabase
      .from("meal_plan_slots")
      .select(
        "id, planned_date, day_index, meal_type, meal_plan_slot_components(title_snapshot, is_primary, display_order)",
      )
      .eq("meal_plan_id", plan.id)
      .eq("status", "planned")
      .gte("planned_date", today)
      .order("planned_date", { ascending: true })
      .order("display_order", { ascending: true })
      .limit(1);

    if (slotsError) {
      return { planId: plan.id, weekStart: plan.week_start, nextMeal: null };
    }

    const slot = (slots as NextSlotRow[] | null)?.[0];
    let nextMeal: PlanContextNextMeal | null = null;
    if (slot) {
      const components = slot.meal_plan_slot_components ?? [];
      const primary = components.find((c) => c.is_primary) ??
        [...components].sort(
          (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
        )[0];
      nextMeal = {
        plannedDate: slot.planned_date,
        dayIndex: slot.day_index,
        mealType: slot.meal_type,
        title: primary?.title_snapshot ?? null,
      };
    }

    return {
      planId: plan.id,
      weekStart: plan.week_start,
      nextMeal,
    };
  } catch {
    return null;
  }
}
