-- Drop unused shopping-list artifacts.
--
-- 1. update_shopping_list_item_orders RPC — orphaned after drag-to-reorder
--    was removed from the frontend in PR #49. Items now sort alphabetically
--    by name on read; no display_order writes are issued from the client.
--
-- 2. user_category_order table — only ever read, never written. Was intended
--    to back per-user category ordering (drag-to-reorder of category headers),
--    a feature that was never built and that the simplified row UX no longer
--    needs.
--
-- Both are dead in code as of this migration. Safe to drop.

DROP FUNCTION IF EXISTS public.update_shopping_list_item_orders(UUID, JSONB);

DROP TABLE IF EXISTS public.user_category_order;
