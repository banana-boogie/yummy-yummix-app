-- Migration: Add `apply_meal_plan_slot_swap` RPC
--
-- Background: when a user picks a swap alternative, the planner has to update
-- three rows across two tables in a consistent state:
--   1. `meal_plan_slot_components` — refresh the primary's snapshot to the
--       chosen recipe (and reset the lineage triple to `recipe`).
--   2. `meal_plan_slots` — bump `swap_count`, stamp `last_swapped_at`, mark
--       `shopping_sync_state = 'stale'`.
--   3. `meal_plans` — mark the parent plan's `shopping_sync_state = 'stale'`.
--
-- The previous edge-function path issued these as parallel PostgREST calls,
-- which is fast but non-atomic: a partial failure (e.g. component succeeds,
-- slot fails) leaves the user looking at the new recipe with a stale
-- swap_count and out-of-sync freshness flags. Wrapping the writes in a single
-- Postgres function gives us transactional consistency for free.
--
-- Rejection insert is intentionally OUT OF SCOPE here. The handler keeps that
-- as best-effort after the RPC returns — losing a rejection row only causes
-- the same recipe to reappear in the next browse, which is annoying but not
-- corrupting.
--
-- SECURITY INVOKER so RLS still applies: the caller must own the plan/slot/
-- component for the writes to succeed. We do NOT use SECURITY DEFINER — it
-- would bypass RLS and require duplicate ownership checks here.
--
-- Date: 2026-05-04
-- Depends on: 20260410000001_add_meal_plans.sql (creates the three tables)
--             20260427135807_add_swap_pairing_basis.sql (adds `swap` enum)

CREATE OR REPLACE FUNCTION public.apply_meal_plan_slot_swap(
    p_component_id           uuid,
    p_recipe_id              uuid,
    p_title_snapshot         text,
    p_image_url_snapshot     text,
    p_total_time_snapshot    integer,
    p_difficulty_snapshot    text,
    p_portions_snapshot      integer,
    p_equipment_tags_snapshot text[],
    p_meal_components_snapshot text[],
    p_slot_id                uuid,
    p_plan_id                uuid,
    p_now                    timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_component_rows int;
    v_slot_rows      int;
    v_plan_rows      int;
BEGIN
    UPDATE public.meal_plan_slot_components
       SET source_kind              = 'recipe',
           source_component_id      = NULL,
           recipe_id                = p_recipe_id,
           title_snapshot           = p_title_snapshot,
           image_url_snapshot       = p_image_url_snapshot,
           total_time_snapshot      = p_total_time_snapshot,
           difficulty_snapshot      = p_difficulty_snapshot,
           portions_snapshot        = p_portions_snapshot,
           equipment_tags_snapshot  = COALESCE(p_equipment_tags_snapshot, '{}'),
           meal_components_snapshot = COALESCE(p_meal_components_snapshot, '{}'),
           pairing_basis            = 'swap'
     WHERE id = p_component_id;
    GET DIAGNOSTICS v_component_rows = ROW_COUNT;
    IF v_component_rows = 0 THEN
        -- RLS-scoped: 0 rows means the component doesn't exist or the caller
        -- doesn't own it. Either way, abort the whole transaction.
        RAISE EXCEPTION 'apply_meal_plan_slot_swap: component % not found or not owned', p_component_id
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.meal_plan_slots
       SET swap_count          = COALESCE(swap_count, 0) + 1,
           last_swapped_at     = p_now,
           shopping_sync_state = 'stale'
     WHERE id = p_slot_id;
    GET DIAGNOSTICS v_slot_rows = ROW_COUNT;
    IF v_slot_rows = 0 THEN
        RAISE EXCEPTION 'apply_meal_plan_slot_swap: slot % not found or not owned', p_slot_id
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.meal_plans
       SET shopping_sync_state = 'stale'
     WHERE id = p_plan_id;
    GET DIAGNOSTICS v_plan_rows = ROW_COUNT;
    IF v_plan_rows = 0 THEN
        RAISE EXCEPTION 'apply_meal_plan_slot_swap: plan % not found or not owned', p_plan_id
            USING ERRCODE = 'P0002';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_meal_plan_slot_swap(
    uuid, uuid, text, text, integer, text, integer, text[], text[], uuid, uuid, timestamptz
) TO authenticated;
