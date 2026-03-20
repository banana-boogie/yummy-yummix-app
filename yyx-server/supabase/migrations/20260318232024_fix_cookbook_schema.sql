-- ============================================================================
-- Migration: Fix Cookbook Schema
-- Description: Align cookbooks with project i18n pattern (translation tables),
--              drop anon public-read RLS, add atomic display_order helper,
--              restrict regenerate_cookbook_share_token to authenticated,
--              drop low-value boolean index, update SECURITY DEFINER functions
-- Date: 2026-03-18
-- ============================================================================

-- ============================================================================
-- 1. Create translation tables (align with project i18n pattern)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cookbook_translations (
  cookbook_id UUID NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  locale TEXT NOT NULL REFERENCES locales(code),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (cookbook_id, locale)
);

CREATE TABLE IF NOT EXISTS cookbook_recipe_translations (
  cookbook_recipe_id UUID NOT NULL REFERENCES cookbook_recipes(id) ON DELETE CASCADE,
  locale TEXT NOT NULL REFERENCES locales(code),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (cookbook_recipe_id, locale)
);

-- Indexes for translation lookups
CREATE INDEX IF NOT EXISTS idx_cookbook_translations_locale
  ON cookbook_translations(locale);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipe_translations_locale
  ON cookbook_recipe_translations(locale);

-- ============================================================================
-- 2. Migrate existing data from inline columns to translation rows
-- ============================================================================

-- Migrate cookbook names/descriptions
INSERT INTO cookbook_translations (cookbook_id, locale, name, description)
SELECT id, 'en', name_en, description_en
FROM cookbooks
WHERE name_en IS NOT NULL
ON CONFLICT (cookbook_id, locale) DO NOTHING;

INSERT INTO cookbook_translations (cookbook_id, locale, name, description)
SELECT id, 'es', name_es, description_es
FROM cookbooks
WHERE name_es IS NOT NULL
ON CONFLICT (cookbook_id, locale) DO NOTHING;

-- Migrate cookbook recipe notes
INSERT INTO cookbook_recipe_translations (cookbook_recipe_id, locale, notes)
SELECT id, 'en', notes_en
FROM cookbook_recipes
WHERE notes_en IS NOT NULL
ON CONFLICT (cookbook_recipe_id, locale) DO NOTHING;

INSERT INTO cookbook_recipe_translations (cookbook_recipe_id, locale, notes)
SELECT id, 'es', notes_es
FROM cookbook_recipes
WHERE notes_es IS NOT NULL
ON CONFLICT (cookbook_recipe_id, locale) DO NOTHING;

-- ============================================================================
-- 3. Drop legacy inline columns
-- ============================================================================

ALTER TABLE cookbooks
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_es,
  DROP COLUMN IF EXISTS description_en,
  DROP COLUMN IF EXISTS description_es;

ALTER TABLE cookbook_recipes
  DROP COLUMN IF EXISTS notes_en,
  DROP COLUMN IF EXISTS notes_es;

-- ============================================================================
-- 4. RLS policies for translation tables
-- ============================================================================

ALTER TABLE cookbook_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookbook_recipe_translations ENABLE ROW LEVEL SECURITY;

-- Cookbook translations: owner can CRUD
CREATE POLICY "Users can read own cookbook translations"
  ON cookbook_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_translations.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own cookbook translations"
  ON cookbook_translations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_translations.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own cookbook translations"
  ON cookbook_translations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_translations.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_translations.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own cookbook translations"
  ON cookbook_translations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_translations.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Cookbook recipe translations: owner can CRUD
CREATE POLICY "Users can read own cookbook recipe translations"
  ON cookbook_recipe_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cookbook_recipes cr
      JOIN cookbooks c ON c.id = cr.cookbook_id
      WHERE cr.id = cookbook_recipe_translations.cookbook_recipe_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own cookbook recipe translations"
  ON cookbook_recipe_translations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbook_recipes cr
      JOIN cookbooks c ON c.id = cr.cookbook_id
      WHERE cr.id = cookbook_recipe_translations.cookbook_recipe_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own cookbook recipe translations"
  ON cookbook_recipe_translations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cookbook_recipes cr
      JOIN cookbooks c ON c.id = cr.cookbook_id
      WHERE cr.id = cookbook_recipe_translations.cookbook_recipe_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbook_recipes cr
      JOIN cookbooks c ON c.id = cr.cookbook_id
      WHERE cr.id = cookbook_recipe_translations.cookbook_recipe_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own cookbook recipe translations"
  ON cookbook_recipe_translations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cookbook_recipes cr
      JOIN cookbooks c ON c.id = cr.cookbook_id
      WHERE cr.id = cookbook_recipe_translations.cookbook_recipe_id
      AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Drop anon public-read RLS policies (sharing UI disabled for MVP)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read public cookbooks" ON cookbooks;
DROP POLICY IF EXISTS "Anyone can read recipes in public cookbooks" ON cookbook_recipes;

-- ============================================================================
-- 6. Atomic display_order helper function
-- ============================================================================

CREATE OR REPLACE FUNCTION next_cookbook_recipe_order(p_cookbook_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(MAX(display_order), -1) + 1
  FROM cookbook_recipes
  WHERE cookbook_id = p_cookbook_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- 7. Restrict regenerate_cookbook_share_token to authenticated only
-- ============================================================================

REVOKE ALL ON FUNCTION regenerate_cookbook_share_token(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION regenerate_cookbook_share_token(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION regenerate_cookbook_share_token(UUID) TO authenticated;

-- ============================================================================
-- 8. Drop low-value boolean indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_cookbooks_share_enabled;
DROP INDEX IF EXISTS idx_cookbooks_is_public;

-- ============================================================================
-- 9. Update SECURITY DEFINER functions for new schema
--    (old versions reference name_en/name_es columns that no longer exist)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cookbook_by_share_token(p_share_token UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  is_public BOOLEAN,
  is_default BOOLEAN,
  share_token UUID,
  share_enabled BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.is_public,
    c.is_default,
    c.share_token,
    c.share_enabled,
    c.created_at,
    c.updated_at
  FROM cookbooks c
  WHERE c.share_token = p_share_token
  AND c.share_enabled = true
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION get_cookbook_recipes_by_share_token(p_share_token UUID)
RETURNS TABLE (
  cookbook_recipe_id UUID,
  cookbook_id UUID,
  recipe_id UUID,
  display_order INTEGER,
  added_at TIMESTAMPTZ,
  recipe_image_url TEXT,
  recipe_prep_time_minutes INTEGER,
  recipe_cook_time_minutes INTEGER,
  recipe_servings INTEGER,
  recipe_difficulty TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id as cookbook_recipe_id,
    cr.cookbook_id,
    cr.recipe_id,
    cr.display_order,
    cr.added_at,
    r.image_url as recipe_image_url,
    r.prep_time_minutes as recipe_prep_time_minutes,
    r.cook_time_minutes as recipe_cook_time_minutes,
    r.servings as recipe_servings,
    r.difficulty as recipe_difficulty
  FROM cookbook_recipes cr
  INNER JOIN cookbooks c ON c.id = cr.cookbook_id
  INNER JOIN recipes r ON r.id = cr.recipe_id
  WHERE c.share_token = p_share_token
  AND c.share_enabled = true
  ORDER BY cr.display_order ASC, cr.added_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cookbook_by_share_token(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_cookbook_recipes_by_share_token(UUID) TO authenticated, anon;

-- ============================================================================
-- 10. Updated_at triggers for translation tables
-- ============================================================================

CREATE TRIGGER trigger_cookbook_translations_updated_at
  BEFORE UPDATE ON cookbook_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_cookbooks_updated_at();

CREATE TRIGGER trigger_cookbook_recipe_translations_updated_at
  BEFORE UPDATE ON cookbook_recipe_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_cookbooks_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE cookbook_translations IS 'Locale-specific content for cookbooks (name, description)';
COMMENT ON TABLE cookbook_recipe_translations IS 'Locale-specific content for cookbook recipe entries (notes)';
COMMENT ON FUNCTION next_cookbook_recipe_order(UUID) IS 'Returns next available display_order for a cookbook (atomic)';
