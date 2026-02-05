-- Add unique constraints on ordering columns and remove redundant recipe_id
--
-- This migration:
-- 1. Reassigns display_order values to be sequential (1, 2, 3...) per parent
-- 2. Adds unique constraints to prevent future duplicates
-- 3. Removes redundant recipe_id from recipe_step_ingredients

-- ============================================================================
-- STEP 1: Reassign display_order in recipe_ingredients (1, 2, 3... per recipe)
-- ============================================================================
UPDATE recipe_ingredients ri
SET display_order = sub.new_order
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY COALESCE(display_order, 999999), id) as new_order
  FROM recipe_ingredients
) sub
WHERE ri.id = sub.id;

-- ============================================================================
-- STEP 2: Reassign display_order in recipe_step_ingredients (1, 2, 3... per step)
-- ============================================================================
UPDATE recipe_step_ingredients rsi
SET display_order = sub.new_order
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY recipe_step_id ORDER BY COALESCE(display_order, 999999), id) as new_order
  FROM recipe_step_ingredients
) sub
WHERE rsi.id = sub.id;

-- ============================================================================
-- STEP 3: Reassign display_order in recipe_useful_items (1, 2, 3... per recipe)
-- ============================================================================
UPDATE recipe_useful_items rui
SET display_order = sub.new_order
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY COALESCE(display_order, 999999), id) as new_order
  FROM recipe_useful_items
) sub
WHERE rui.id = sub.id;

-- ============================================================================
-- STEP 4: Add unique constraints (idempotent)
-- ============================================================================
-- recipe_steps already has: UNIQUE (recipe_id, order)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_ingredients_recipe_id_display_order_key') THEN
    ALTER TABLE recipe_ingredients
      ADD CONSTRAINT recipe_ingredients_recipe_id_display_order_key
      UNIQUE (recipe_id, display_order);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_step_ingredients_step_id_display_order_key') THEN
    ALTER TABLE recipe_step_ingredients
      ADD CONSTRAINT recipe_step_ingredients_step_id_display_order_key
      UNIQUE (recipe_step_id, display_order);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_useful_items_recipe_id_display_order_key') THEN
    ALTER TABLE recipe_useful_items
      ADD CONSTRAINT recipe_useful_items_recipe_id_display_order_key
      UNIQUE (recipe_id, display_order);
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Remove redundant recipe_id from recipe_step_ingredients
-- ============================================================================
-- This column is redundant because recipe_id can be derived by joining through recipe_steps
-- Drop the index first (if it exists from earlier migration)
DROP INDEX IF EXISTS idx_recipe_step_ingredients_recipe_id;

ALTER TABLE recipe_step_ingredients
  DROP COLUMN IF EXISTS recipe_id;
