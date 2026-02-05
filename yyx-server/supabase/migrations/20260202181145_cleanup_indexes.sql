-- Remove unused indexes
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

DROP INDEX IF EXISTS recipe_steps_order_number_idx;
DROP INDEX IF EXISTS recipe_to_tag_recipe_id_idx;
DROP INDEX IF EXISTS recipe_to_tag_tag_id_idx;
DROP INDEX IF EXISTS recipe_useful_items_useful_item_id_idx;
DROP INDEX IF EXISTS useful_items_name_en_idx;
DROP INDEX IF EXISTS useful_items_name_es_idx;

-- Remove duplicate index (keep the primary key, drop the unique constraint index)
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index
ALTER TABLE recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_id_key;
