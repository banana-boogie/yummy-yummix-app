-- RPC used by the client to atomically reorder shopping list items in a single
-- round-trip. Takes a JSON array of { id, display_order } pairs and applies
-- each update inside a single transaction.

CREATE OR REPLACE FUNCTION public.update_shopping_list_item_orders(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE shopping_list_items AS sli
    SET display_order = u.display_order::integer
    FROM jsonb_to_recordset(updates) AS u(id uuid, display_order integer)
    WHERE sli.id = u.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_shopping_list_item_orders(jsonb) TO authenticated;

-- Speed up "is this recipe already on a list?" queries.
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_recipe
    ON public.shopping_list_items (recipe_id)
    WHERE recipe_id IS NOT NULL;
