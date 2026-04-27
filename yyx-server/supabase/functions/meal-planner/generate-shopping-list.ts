/**
 * generate_shopping_list implementation.
 *
 * Loads all active (planned/cooked) slots for a plan, expands recipe
 * components into their recipe_ingredients, consolidates identical
 * (ingredient_id + measurement_unit_id) rows by summing quantities,
 * and replaces plan-sourced rows on the plan's linked shopping list
 * while preserving manually-added rows.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { GenerateShoppingListResponse } from "./types.ts";

// Generic client type — the real callers pass a user-scoped client from the
// shared helper, but we don't want to import that type from Deno-only code
// in unit tests. `any` is acceptable here because the caller's RLS enforces
// per-user isolation; this module just composes queries.
// deno-lint-ignore no-explicit-any
type Supa = SupabaseClient<any, "public", any>;

interface ConsolidatedItem {
  ingredientId: string | null;
  nameCustom: string | null;
  measurementUnitId: string | null;
  quantity: number;
  firstComponentId: string;
  firstSlotId: string;
  categoryId: string;
}

interface GenerateResult {
  response: GenerateShoppingListResponse;
  status: number;
}

const DEFAULT_CATEGORY_ID = "other";
const LIST_NAME = "Meal Plan";

export async function executeGenerateShoppingList(
  supabase: Supa,
  userId: string,
  mealPlanId: string,
): Promise<GenerateResult> {
  const warnings: string[] = [];

  // 1. Load plan and verify ownership. RLS also enforces this, but checking
  // explicitly gives us a clean 404 instead of a silent empty result.
  const { data: plan, error: planErr } = await supabase
    .from("meal_plans")
    .select("id, user_id, shopping_list_id, shopping_sync_state")
    .eq("id", mealPlanId)
    .maybeSingle();
  if (planErr) throw new Error(`Load plan failed: ${planErr.message}`);
  if (!plan || plan.user_id !== userId) {
    return {
      status: 404,
      response: {
        shoppingListId: null,
        warnings: ["PLAN_NOT_FOUND"],
      },
    };
  }

  // 2. Load active slots + recipe-sourced components.
  const { data: slots, error: slotsErr } = await supabase
    .from("meal_plan_slots")
    .select(
      "id, status, components:meal_plan_slot_components(id, recipe_id, source_kind)",
    )
    .eq("meal_plan_id", mealPlanId)
    .in("status", ["planned", "cooked"]);
  if (slotsErr) throw new Error(`Load slots failed: ${slotsErr.message}`);

  type SlotRow = {
    id: string;
    status: string;
    components: Array<{
      id: string;
      recipe_id: string | null;
      source_kind: string;
    }>;
  };
  const slotRows = (slots ?? []) as SlotRow[];

  // Map component → slot so we can set source FKs after consolidation.
  const componentToSlot = new Map<string, string>();
  const recipeComponents: Array<{
    componentId: string;
    slotId: string;
    recipeId: string;
  }> = [];
  for (const slot of slotRows) {
    for (const c of slot.components) {
      componentToSlot.set(c.id, slot.id);
      if (c.source_kind === "recipe" && c.recipe_id) {
        recipeComponents.push({
          componentId: c.id,
          slotId: slot.id,
          recipeId: c.recipe_id,
        });
      }
    }
  }

  // 3. Load all recipe ingredients for the referenced recipes.
  const recipeIds = Array.from(
    new Set(recipeComponents.map((c) => c.recipeId)),
  );
  type RecipeIngredientRow = {
    id: string;
    recipe_id: string;
    ingredient_id: string | null;
    quantity: number | string | null;
    measurement_unit_id: string | null;
    optional: boolean | null;
  };
  let recipeIngredients: RecipeIngredientRow[] = [];
  if (recipeIds.length > 0) {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select(
        "id, recipe_id, ingredient_id, quantity, measurement_unit_id, optional",
      )
      .in("recipe_id", recipeIds);
    if (error) {
      throw new Error(`Load recipe_ingredients failed: ${error.message}`);
    }
    recipeIngredients = (data ?? []) as RecipeIngredientRow[];
  }

  // Index recipe ingredients by recipe for quick lookup per component.
  const ingredientsByRecipe = new Map<string, RecipeIngredientRow[]>();
  for (const ri of recipeIngredients) {
    const list = ingredientsByRecipe.get(ri.recipe_id) ?? [];
    list.push(ri);
    ingredientsByRecipe.set(ri.recipe_id, list);
  }

  // Look up each ingredient's default shopping category in one batch.
  const uniqueIngredientIds = Array.from(
    new Set(
      recipeIngredients
        .map((ri) => ri.ingredient_id)
        .filter((id): id is string => id != null),
    ),
  );
  const ingredientCategory = new Map<string, string>();
  if (uniqueIngredientIds.length > 0) {
    const { data: ingRows, error: ingErr } = await supabase
      .from("ingredients")
      .select("id, default_category_id")
      .in("id", uniqueIngredientIds);
    if (ingErr) {
      throw new Error(`Load ingredient categories failed: ${ingErr.message}`);
    }
    for (const row of ingRows ?? []) {
      if (row.default_category_id) {
        ingredientCategory.set(
          row.id as string,
          row.default_category_id as string,
        );
      }
    }
  }

  // 4. Consolidate across all components. Key: ingredient_id + unit_id.
  // When ingredient_id is null (free-text), we don't try to dedupe.
  const consolidated = new Map<string, ConsolidatedItem>();
  let skippedFreeText = 0;
  for (const comp of recipeComponents) {
    const items = ingredientsByRecipe.get(comp.recipeId) ?? [];
    for (const ri of items) {
      if (!ri.ingredient_id) {
        skippedFreeText++;
        continue;
      }
      const qty = toNumber(ri.quantity);
      if (qty == null || qty <= 0) continue;
      const key = `${ri.ingredient_id}:${ri.measurement_unit_id ?? "null"}`;
      const existing = consolidated.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        consolidated.set(key, {
          ingredientId: ri.ingredient_id,
          nameCustom: null,
          measurementUnitId: ri.measurement_unit_id,
          quantity: qty,
          firstComponentId: comp.componentId,
          firstSlotId: comp.slotId,
          categoryId: ingredientCategory.get(ri.ingredient_id) ??
            DEFAULT_CATEGORY_ID,
        });
      }
    }
  }

  // 5. Find or create the linked shopping list.
  let shoppingListId = plan.shopping_list_id as string | null;
  if (shoppingListId) {
    // Confirm it still exists (could have been deleted by the user).
    const { data: list } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("id", shoppingListId)
      .maybeSingle();
    if (!list) shoppingListId = null;
  }
  if (!shoppingListId) {
    const { data: created, error: createErr } = await supabase
      .from("shopping_lists")
      .insert({ user_id: userId, name: LIST_NAME })
      .select("id")
      .single();
    if (createErr || !created) {
      throw new Error(
        `Create shopping list failed: ${createErr?.message ?? "no data"}`,
      );
    }
    shoppingListId = created.id as string;
    const { error: linkErr } = await supabase
      .from("meal_plans")
      .update({ shopping_list_id: shoppingListId })
      .eq("id", mealPlanId);
    if (linkErr) {
      throw new Error(`Link shopping list failed: ${linkErr.message}`);
    }
  }

  // 6. Delete existing plan-sourced items on this list. Items with
  // source_meal_plan_slot_id IS NULL (manually added) are preserved.
  const { error: deleteErr } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("shopping_list_id", shoppingListId)
    .not("source_meal_plan_slot_id", "is", null);
  if (deleteErr) {
    throw new Error(`Delete stale plan items failed: ${deleteErr.message}`);
  }

  // 7. Insert consolidated items.
  const rows = [...consolidated.values()].map((item, index) => ({
    shopping_list_id: shoppingListId,
    ingredient_id: item.ingredientId,
    name_custom: item.ingredientId ? null : item.nameCustom,
    category_id: item.categoryId,
    quantity: item.quantity,
    unit_id: item.measurementUnitId,
    is_checked: false,
    display_order: index,
    source_meal_plan_slot_id: item.firstSlotId,
    source_meal_plan_slot_component_id: item.firstComponentId,
  }));
  if (rows.length > 0) {
    const { error: insertErr } = await supabase
      .from("shopping_list_items")
      .insert(rows);
    if (insertErr) {
      throw new Error(`Insert shopping items failed: ${insertErr.message}`);
    }
  } else {
    warnings.push("NO_INGREDIENTS_FOUND");
  }
  if (skippedFreeText > 0) {
    warnings.push(`SKIPPED_FREE_TEXT_INGREDIENTS:${skippedFreeText}`);
  }

  // 8. Mark freshness as current on both the plan and its slots.
  const { error: planUpdateErr } = await supabase
    .from("meal_plans")
    .update({ shopping_sync_state: "current" })
    .eq("id", mealPlanId);
  if (planUpdateErr) {
    throw new Error(
      `Update plan sync state failed: ${planUpdateErr.message}`,
    );
  }
  if (slotRows.length > 0) {
    const slotIds = slotRows.map((s) => s.id);
    const { error: slotUpdateErr } = await supabase
      .from("meal_plan_slots")
      .update({ shopping_sync_state: "current" })
      .in("id", slotIds);
    if (slotUpdateErr) {
      throw new Error(
        `Update slot sync states failed: ${slotUpdateErr.message}`,
      );
    }
  }

  return {
    status: 200,
    response: {
      shoppingListId,
      warnings,
    },
  };
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
