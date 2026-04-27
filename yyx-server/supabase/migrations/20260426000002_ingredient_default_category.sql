-- Add an optional default_category_id to ingredients so the shopping list can
-- group recipe-sourced and planner-sourced items into Produce / Dairy / Meat
-- etc. instead of dumping everything into "Other". Nullable: ingredients
-- without a default still fall back to 'other'.

ALTER TABLE public.ingredients
    ADD COLUMN default_category_id TEXT
        REFERENCES public.shopping_list_categories(id);

CREATE INDEX IF NOT EXISTS idx_ingredients_default_category
    ON public.ingredients (default_category_id)
    WHERE default_category_id IS NOT NULL;
