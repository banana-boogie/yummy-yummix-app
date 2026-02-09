-- Remove duplicate columns from recipes table
-- These columns duplicate data that is stored in normalized tables:
--   - steps_en, steps_es, steps -> duplicates recipe_steps table
--   - useful_items_en, useful_items_es -> duplicates recipe_useful_items junction table
--
-- Note: tips_and_tricks_en and tips_and_tricks_es are NOT removed
-- because they are not duplicated elsewhere

ALTER TABLE recipes
  DROP COLUMN IF EXISTS steps_en,
  DROP COLUMN IF EXISTS steps_es,
  DROP COLUMN IF EXISTS steps,
  DROP COLUMN IF EXISTS useful_items_en,
  DROP COLUMN IF EXISTS useful_items_es;
