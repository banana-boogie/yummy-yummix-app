-- Add remaining foreign key indexes that were missed
-- These were previously unused indexes that we deleted, but they serve as FK indexes

CREATE INDEX IF NOT EXISTS idx_recipe_to_tag_tag_id
ON recipe_to_tag(tag_id);

CREATE INDEX IF NOT EXISTS idx_recipe_useful_items_useful_item_id
ON recipe_useful_items(useful_item_id);
