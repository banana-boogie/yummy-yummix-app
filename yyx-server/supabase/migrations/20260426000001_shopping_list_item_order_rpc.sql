-- RPC used by the client to atomically reorder shopping list items in a single
-- round-trip. Takes a JSON array of { id, display_order } pairs and applies
-- each update inside a single transaction.

-- Drop the previous single-arg signature in case it was applied somewhere
-- before the list-scoped redesign — Postgres treats different argument lists
-- as distinct functions, so CREATE OR REPLACE alone wouldn't supersede it.
DROP FUNCTION IF EXISTS public.update_shopping_list_item_orders(jsonb);

CREATE OR REPLACE FUNCTION public.update_shopping_list_item_orders(p_list_id uuid, updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE shopping_list_items AS sli
    SET display_order = u.display_order::integer
    FROM jsonb_to_recordset(updates) AS u(id uuid, display_order integer)
    WHERE sli.id = u.id
      AND sli.shopping_list_id = p_list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_shopping_list_item_orders(uuid, jsonb) TO authenticated;

-- Speed up "is this recipe already on a list?" queries.
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_recipe
    ON public.shopping_list_items (recipe_id)
    WHERE recipe_id IS NOT NULL;
