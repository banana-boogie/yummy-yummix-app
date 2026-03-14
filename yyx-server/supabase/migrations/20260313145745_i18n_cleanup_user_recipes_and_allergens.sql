-- ============================================================
-- i18n cleanup: user_recipe tables + allergen_groups
-- ============================================================
-- User recipes are single-language (generated in user's locale).
-- Remove _en/_es suffixes — just use plain column names.
-- Allergen groups get a proper translations table.
-- ============================================================

-- 1. user_recipe_ingredients: rename name_en -> name, drop name_es
ALTER TABLE user_recipe_ingredients RENAME COLUMN name_en TO name;
ALTER TABLE user_recipe_ingredients DROP COLUMN IF EXISTS name_es;

-- 2. user_recipe_steps: rename instruction_en -> instruction, drop instruction_es
ALTER TABLE user_recipe_steps RENAME COLUMN instruction_en TO instruction;
ALTER TABLE user_recipe_steps DROP COLUMN IF EXISTS instruction_es;

-- 3. allergen_groups: create translations table
CREATE TABLE IF NOT EXISTS allergen_group_translations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  allergen_group_id uuid NOT NULL REFERENCES allergen_groups(id) ON DELETE CASCADE,
  locale text NOT NULL,
  name text NOT NULL,
  UNIQUE (allergen_group_id, locale)
);

-- Enable RLS (admin-only read, service-role write)
ALTER TABLE allergen_group_translations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (allergen data is public reference data)
CREATE POLICY "allergen_group_translations_read"
ON allergen_group_translations FOR SELECT
TO authenticated
USING (true);

-- 4. Migrate existing allergen_groups name_en/name_es into translations
INSERT INTO allergen_group_translations (allergen_group_id, locale, name)
SELECT id, 'en', name_en FROM allergen_groups WHERE name_en IS NOT NULL
ON CONFLICT (allergen_group_id, locale) DO NOTHING;

INSERT INTO allergen_group_translations (allergen_group_id, locale, name)
SELECT id, 'es', name_es FROM allergen_groups WHERE name_es IS NOT NULL
ON CONFLICT (allergen_group_id, locale) DO NOTHING;

-- 5. Drop legacy columns from allergen_groups
ALTER TABLE allergen_groups DROP COLUMN IF EXISTS name_en;
ALTER TABLE allergen_groups DROP COLUMN IF EXISTS name_es;
