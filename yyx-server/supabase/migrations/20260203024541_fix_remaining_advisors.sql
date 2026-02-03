-- Fix remaining advisor warnings:
-- 1. RLS policies on user_recipe_* tables need (SELECT auth.uid()) pattern
-- 2. Missing FK indexes on user_recipe_ingredients and user_recipe_useful_items
-- 3. Remove duplicate index on recipe_step_ingredients

-- ============================================================================
-- STEP 1: Fix RLS policies to use (SELECT auth.uid()) pattern
-- ============================================================================

-- user_recipe_ingredients
DROP POLICY IF EXISTS "user_recipe_ingredients_policy" ON user_recipe_ingredients;
CREATE POLICY "user_recipe_ingredients_policy"
ON user_recipe_ingredients FOR ALL
TO authenticated
USING (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
))
WITH CHECK (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
));

-- user_recipe_steps
DROP POLICY IF EXISTS "user_recipe_steps_policy" ON user_recipe_steps;
CREATE POLICY "user_recipe_steps_policy"
ON user_recipe_steps FOR ALL
TO authenticated
USING (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
))
WITH CHECK (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
));

-- user_recipe_step_ingredients
DROP POLICY IF EXISTS "user_recipe_step_ingredients_policy" ON user_recipe_step_ingredients;
CREATE POLICY "user_recipe_step_ingredients_policy"
ON user_recipe_step_ingredients FOR ALL
TO authenticated
USING (user_recipe_step_id IN (
  SELECT urs.id FROM user_recipe_steps urs
  JOIN user_recipes ur ON ur.id = urs.user_recipe_id
  WHERE ur.user_id = (SELECT auth.uid())
))
WITH CHECK (user_recipe_step_id IN (
  SELECT urs.id FROM user_recipe_steps urs
  JOIN user_recipes ur ON ur.id = urs.user_recipe_id
  WHERE ur.user_id = (SELECT auth.uid())
));

-- user_recipe_tags
DROP POLICY IF EXISTS "user_recipe_tags_policy" ON user_recipe_tags;
CREATE POLICY "user_recipe_tags_policy"
ON user_recipe_tags FOR ALL
TO authenticated
USING (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
))
WITH CHECK (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
));

-- user_recipe_useful_items
DROP POLICY IF EXISTS "user_recipe_useful_items_policy" ON user_recipe_useful_items;
CREATE POLICY "user_recipe_useful_items_policy"
ON user_recipe_useful_items FOR ALL
TO authenticated
USING (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
))
WITH CHECK (user_recipe_id IN (
  SELECT id FROM user_recipes WHERE user_id = (SELECT auth.uid())
));

-- ============================================================================
-- STEP 2: Add missing FK indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_recipe_ingredients_measurement_unit_id
ON user_recipe_ingredients(measurement_unit_id);

CREATE INDEX IF NOT EXISTS idx_user_recipe_useful_items_useful_item_id
ON user_recipe_useful_items(useful_item_id);

-- ============================================================================
-- STEP 3: Remove duplicate index
-- ============================================================================
-- idx_recipe_step_ingredients_recipe_step_id duplicates recipe_step_ingredients_step_id_idx

DROP INDEX IF EXISTS idx_recipe_step_ingredients_recipe_step_id;
