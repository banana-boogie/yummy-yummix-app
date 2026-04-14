-- Link shopping list items back to the meal plan they were generated from.
-- Both the slot and the specific component are tracked so consolidated items
-- (e.g., chicken used by two recipes) can still be attributed to their
-- contributing components, and regenerating the list can selectively replace
-- only plan-sourced items while preserving manually-added ones.

ALTER TABLE public.shopping_list_items
    ADD COLUMN source_meal_plan_slot_id UUID
        REFERENCES public.meal_plan_slots(id) ON DELETE SET NULL,
    ADD COLUMN source_meal_plan_slot_component_id UUID
        REFERENCES public.meal_plan_slot_components(id) ON DELETE SET NULL;

CREATE INDEX idx_shopping_list_items_slot_source
    ON public.shopping_list_items (source_meal_plan_slot_id)
    WHERE source_meal_plan_slot_id IS NOT NULL;

CREATE INDEX idx_shopping_list_items_component_source
    ON public.shopping_list_items (source_meal_plan_slot_component_id)
    WHERE source_meal_plan_slot_component_id IS NOT NULL;
