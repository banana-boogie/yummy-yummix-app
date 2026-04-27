-- Migration: Remove the `no_cook` concept from the meal planner schema
-- PR #47 follow-up: busy days without leftover sources are now plain cook_slots
-- with a strong ranking bias toward easy + fast recipes, rather than a special
-- `no_cook_fallback_slot` with `no_cook` placeholder components.
-- Canonical rationale: "there's no such thing as 'no cook' — even a sandwich is
-- cooking. Busy-day fallback = leftovers first, then easy/quick recipes."
-- Date: 2026-04-13
-- Depends on: 20260410000001_add_meal_plans.sql

-- ============================================================
-- Clean out any data the removed options might have produced during feature
-- testing. This is pre-launch so there should be no real user data, but a
-- dev environment that exercised the no_cook paths needs to shed those rows
-- or the new CHECK constraints would reject them.
-- ============================================================

DELETE FROM public.meal_plan_slot_components
    WHERE source_kind = 'no_cook';

UPDATE public.meal_plan_slots
    SET slot_type = 'cook_slot'
    WHERE slot_type = 'no_cook_fallback_slot';

-- ============================================================
-- Drop + re-add CHECKs without the no_cook options
-- ============================================================

ALTER TABLE public.meal_plan_slots
    DROP CONSTRAINT slots_slot_type_check;

ALTER TABLE public.meal_plan_slots
    ADD CONSTRAINT slots_slot_type_check CHECK (
        slot_type IN ('cook_slot', 'leftover_target_slot', 'weekend_flexible_slot')
    );

ALTER TABLE public.meal_plan_slot_components
    DROP CONSTRAINT components_source_kind_check;

ALTER TABLE public.meal_plan_slot_components
    ADD CONSTRAINT components_source_kind_check CHECK (
        source_kind IN ('recipe', 'leftover', 'custom')
    );

-- The lineage CHECK referenced `no_cook` in its third branch; collapse that
-- branch so only `custom` can have both recipe_id and source_component_id null.
ALTER TABLE public.meal_plan_slot_components
    DROP CONSTRAINT components_source_lineage_check;

ALTER TABLE public.meal_plan_slot_components
    ADD CONSTRAINT components_source_lineage_check CHECK (
        (source_kind = 'recipe'
            AND recipe_id IS NOT NULL
            AND source_component_id IS NULL)
        OR (source_kind = 'leftover'
            AND source_component_id IS NOT NULL
            AND recipe_id IS NULL)
        OR (source_kind = 'custom'
            AND recipe_id IS NULL
            AND source_component_id IS NULL)
    );
