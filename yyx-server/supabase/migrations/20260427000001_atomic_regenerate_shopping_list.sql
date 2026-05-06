-- Atomically replace planner-sourced shopping list rows and mark sync current.
-- List creation/linking stays in the edge function; this function owns the
-- destructive regeneration step so partial failures cannot empty a list.

CREATE OR REPLACE FUNCTION public.regenerate_plan_shopping_list_items(
    p_plan_id UUID,
    p_list_id UUID,
    p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    DELETE FROM shopping_list_items
    WHERE shopping_list_id = p_list_id
      AND source_meal_plan_slot_id IS NOT NULL;

    INSERT INTO shopping_list_items (
        shopping_list_id,
        ingredient_id,
        name_custom,
        category_id,
        quantity,
        unit_id,
        is_checked,
        display_order,
        source_meal_plan_slot_id,
        source_meal_plan_slot_component_id
    )
    SELECT
        p_list_id,
        ingredient_id,
        name_custom,
        category_id,
        quantity,
        unit_id,
        FALSE,
        display_order,
        source_meal_plan_slot_id,
        source_meal_plan_slot_component_id
    FROM jsonb_to_recordset(p_items) AS x(
        ingredient_id UUID,
        name_custom TEXT,
        category_id TEXT,
        quantity NUMERIC,
        unit_id TEXT,
        display_order INTEGER,
        source_meal_plan_slot_id UUID,
        source_meal_plan_slot_component_id UUID
    );

    UPDATE meal_plans
    SET shopping_sync_state = 'current'
    WHERE id = p_plan_id;

    UPDATE meal_plan_slots
    SET shopping_sync_state = 'current'
    WHERE meal_plan_id = p_plan_id
      AND status IN ('planned', 'cooked');
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_plan_shopping_list_items(UUID, UUID, JSONB) TO authenticated;
