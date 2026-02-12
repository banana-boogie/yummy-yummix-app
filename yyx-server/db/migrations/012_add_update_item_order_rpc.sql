-- Batch update shopping list item order using a single RPC call
CREATE OR REPLACE FUNCTION update_shopping_list_item_orders(updates jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE shopping_list_items AS sli
  SET display_order = u.display_order
  FROM jsonb_to_recordset(updates) AS u(id uuid, display_order integer)
  WHERE sli.id = u.id
    AND sli.shopping_list_id IN (
      SELECT id FROM shopping_lists WHERE user_id = auth.uid()
    );
$$;
