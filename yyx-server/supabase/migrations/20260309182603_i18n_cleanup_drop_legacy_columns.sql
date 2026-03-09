-- PR5 Cleanup: Drop legacy _en/_es columns, sync triggers, and indexes
-- All reads/writes now use translation tables directly.

-- ============================================================
-- 1. Drop sync triggers (depend on columns)
-- ============================================================

DROP TRIGGER IF EXISTS sync_recipe_translations ON recipes;
DROP TRIGGER IF EXISTS sync_recipe_step_translations ON recipe_steps;
DROP TRIGGER IF EXISTS sync_ingredient_translations ON ingredients;
DROP TRIGGER IF EXISTS sync_recipe_ingredient_translations ON recipe_ingredients;
DROP TRIGGER IF EXISTS sync_measurement_unit_translations ON measurement_units;
DROP TRIGGER IF EXISTS sync_recipe_tag_translations ON recipe_tags;
DROP TRIGGER IF EXISTS sync_useful_item_translations ON useful_items;
DROP TRIGGER IF EXISTS sync_recipe_useful_item_translations ON recipe_useful_items;

-- ============================================================
-- 1b. Drop base translation constraint triggers
--     These require en translation at INSERT time within the same transaction.
--     With PostgREST (each request = separate transaction), we can't insert
--     entity + translations atomically. Validation is enforced by the services.
-- ============================================================

DROP TRIGGER IF EXISTS ensure_base_translation ON recipes;
DROP TRIGGER IF EXISTS ensure_base_translation ON recipe_steps;
DROP TRIGGER IF EXISTS ensure_base_translation ON ingredients;
DROP TRIGGER IF EXISTS ensure_base_translation ON recipe_ingredients;
DROP TRIGGER IF EXISTS ensure_base_translation ON measurement_units;
DROP TRIGGER IF EXISTS ensure_base_translation ON recipe_tags;
DROP TRIGGER IF EXISTS ensure_base_translation ON useful_items;
DROP TRIGGER IF EXISTS ensure_base_translation ON recipe_useful_items;

DROP FUNCTION IF EXISTS check_base_translation();

-- ============================================================
-- 2. Drop sync functions
-- ============================================================

DROP FUNCTION IF EXISTS sync_recipe_to_translations();
DROP FUNCTION IF EXISTS sync_recipe_step_to_translations();
DROP FUNCTION IF EXISTS sync_ingredient_to_translations();
DROP FUNCTION IF EXISTS sync_recipe_ingredient_to_translations();
DROP FUNCTION IF EXISTS sync_measurement_unit_to_translations();
DROP FUNCTION IF EXISTS sync_recipe_tag_to_translations();
DROP FUNCTION IF EXISTS sync_useful_item_to_translations();
DROP FUNCTION IF EXISTS sync_recipe_useful_item_to_translations();

-- ============================================================
-- 3. Drop legacy unique indexes
-- ============================================================

DROP INDEX IF EXISTS idx_ingredients_name_en_unique;
DROP INDEX IF EXISTS idx_ingredients_name_es_unique;
DROP INDEX IF EXISTS idx_recipe_tags_name_en_unique;
DROP INDEX IF EXISTS idx_recipe_tags_name_es_unique;
DROP INDEX IF EXISTS idx_useful_items_name_en_unique;
DROP INDEX IF EXISTS idx_useful_items_name_es_unique;

-- ============================================================
-- 4. Drop legacy _en/_es columns
-- ============================================================

ALTER TABLE recipes
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_es,
  DROP COLUMN IF EXISTS tips_and_tricks_en,
  DROP COLUMN IF EXISTS tips_and_tricks_es;

ALTER TABLE recipe_steps
  DROP COLUMN IF EXISTS instruction_en,
  DROP COLUMN IF EXISTS instruction_es,
  DROP COLUMN IF EXISTS recipe_section_en,
  DROP COLUMN IF EXISTS recipe_section_es,
  DROP COLUMN IF EXISTS tip_en,
  DROP COLUMN IF EXISTS tip_es;

ALTER TABLE ingredients
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_es,
  DROP COLUMN IF EXISTS plural_name_en,
  DROP COLUMN IF EXISTS plural_name_es;

ALTER TABLE recipe_ingredients
  DROP COLUMN IF EXISTS recipe_section_en,
  DROP COLUMN IF EXISTS recipe_section_es,
  DROP COLUMN IF EXISTS notes_en,
  DROP COLUMN IF EXISTS notes_es,
  DROP COLUMN IF EXISTS tip_en,
  DROP COLUMN IF EXISTS tip_es;

ALTER TABLE measurement_units
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_es,
  DROP COLUMN IF EXISTS name_en_plural,
  DROP COLUMN IF EXISTS name_es_plural,
  DROP COLUMN IF EXISTS symbol_en,
  DROP COLUMN IF EXISTS symbol_es,
  DROP COLUMN IF EXISTS symbol_en_plural,
  DROP COLUMN IF EXISTS symbol_es_plural;

ALTER TABLE recipe_tags
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_es;

ALTER TABLE useful_items
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_es;

ALTER TABLE recipe_useful_items
  DROP COLUMN IF EXISTS notes_en,
  DROP COLUMN IF EXISTS notes_es;

-- ============================================================
-- 5. Recreate convenience views (old definitions used r.* which included dropped columns)
-- ============================================================

CREATE OR REPLACE VIEW public.recipes_summary AS
SELECT r.*, t.name, t.tips_and_tricks
FROM public.recipes r
LEFT JOIN public.recipe_translations t ON t.recipe_id = r.id AND t.locale = 'en';

CREATE OR REPLACE VIEW public.ingredients_summary AS
SELECT i.*, t.name, t.plural_name
FROM public.ingredients i
LEFT JOIN public.ingredient_translations t ON t.ingredient_id = i.id AND t.locale = 'en';

-- ============================================================
-- 6. Add unique indexes on translation tables
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_translations_name_locale
  ON ingredient_translations (locale, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_tag_translations_name_locale
  ON recipe_tag_translations (locale, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_useful_item_translations_name_locale
  ON useful_item_translations (locale, lower(name));
