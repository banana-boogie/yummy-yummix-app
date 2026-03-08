-- Migration: i18n locale infrastructure
-- Author: database-agent
-- Date: 2026-03-08
-- Description: Creates locales table, locale resolution RPC, 8 translation tables,
--              base translation constraint triggers, RLS policies, convenience views, and indexes.
--              100% backward-compatible — no existing tables/columns/RPCs modified.

BEGIN;

-- ============================================================
-- 1A. Locales table
-- ============================================================

CREATE TABLE public.locales (
  code text PRIMARY KEY,
  parent_code text REFERENCES public.locales(code),
  display_name text NOT NULL,
  is_active boolean DEFAULT true,
  CHECK (code != parent_code)
);

INSERT INTO public.locales (code, parent_code, display_name, is_active) VALUES
  ('en', NULL, 'English', true),
  ('es', 'en', 'Español', true),
  ('es-MX', 'es', 'Español (México)', true),
  ('es-ES', 'es', 'Español (España)', true);

-- RLS: readable by everyone, writable by admins only
ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read locales"
  ON public.locales FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write locales"
  ON public.locales FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 1B. Locale resolution RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_locale(requested text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result text[];
BEGIN
  WITH RECURSIVE chain AS (
    SELECT code, parent_code, 1 as depth
    FROM locales
    WHERE code = requested AND is_active = true
    UNION ALL
    SELECT l.code, l.parent_code, c.depth + 1
    FROM locales l
    JOIN chain c ON l.code = c.parent_code
    WHERE c.depth < 5 AND l.is_active = true
  )
  SELECT array_agg(code ORDER BY depth) INTO result FROM chain;

  -- If no match and locale has a region suffix, try the base language
  IF result IS NULL AND requested LIKE '%-%' THEN
    RETURN resolve_locale(split_part(requested, '-', 1));
  END IF;

  -- Ultimate fallback to English
  IF result IS NULL THEN
    RETURN ARRAY['en'];
  END IF;

  RETURN result;
END;
$$;

-- ============================================================
-- 1C. Eight translation tables
-- ============================================================

-- recipe_translations
CREATE TABLE public.recipe_translations (
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  name text NOT NULL,
  tips_and_tricks text,
  PRIMARY KEY (recipe_id, locale)
);

-- recipe_step_translations
CREATE TABLE public.recipe_step_translations (
  recipe_step_id uuid REFERENCES public.recipe_steps(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  instruction text NOT NULL,
  recipe_section text,
  tip text,
  PRIMARY KEY (recipe_step_id, locale)
);

-- ingredient_translations
CREATE TABLE public.ingredient_translations (
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  name text NOT NULL,
  plural_name text,
  PRIMARY KEY (ingredient_id, locale)
);

-- recipe_ingredient_translations
CREATE TABLE public.recipe_ingredient_translations (
  recipe_ingredient_id uuid REFERENCES public.recipe_ingredients(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  recipe_section text NOT NULL DEFAULT 'Main',
  notes text,
  tip text,
  PRIMARY KEY (recipe_ingredient_id, locale)
);

-- measurement_unit_translations (PK is text, not uuid)
CREATE TABLE public.measurement_unit_translations (
  measurement_unit_id text REFERENCES public.measurement_units(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  name text NOT NULL,
  name_plural text NOT NULL,
  symbol text NOT NULL,
  symbol_plural text,
  PRIMARY KEY (measurement_unit_id, locale)
);

-- recipe_tag_translations
CREATE TABLE public.recipe_tag_translations (
  recipe_tag_id uuid REFERENCES public.recipe_tags(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  name text NOT NULL,
  PRIMARY KEY (recipe_tag_id, locale)
);

-- useful_item_translations
CREATE TABLE public.useful_item_translations (
  useful_item_id uuid REFERENCES public.useful_items(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  name text NOT NULL,
  PRIMARY KEY (useful_item_id, locale)
);

-- recipe_useful_item_translations
CREATE TABLE public.recipe_useful_item_translations (
  recipe_useful_item_id uuid REFERENCES public.recipe_useful_items(id) ON DELETE CASCADE,
  locale text REFERENCES public.locales(code),
  notes text,
  PRIMARY KEY (recipe_useful_item_id, locale)
);

-- ============================================================
-- 1D. Base translation constraint trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_base_translation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  translation_table text := TG_ARGV[0];
  fk_column text := TG_ARGV[1];
  has_base boolean;
BEGIN
  EXECUTE format(
    'SELECT EXISTS(SELECT 1 FROM %I WHERE %I = $1 AND locale = ''en'')',
    translation_table, fk_column
  ) INTO has_base USING NEW.id;

  IF NOT has_base THEN
    RAISE EXCEPTION '% % must have a base (en) translation in %',
      TG_TABLE_NAME, NEW.id, translation_table;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach to all 8 parent tables
CREATE CONSTRAINT TRIGGER check_recipe_base_translation
  AFTER INSERT OR UPDATE ON public.recipes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_translations', 'recipe_id');

CREATE CONSTRAINT TRIGGER check_recipe_step_base_translation
  AFTER INSERT OR UPDATE ON public.recipe_steps
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_step_translations', 'recipe_step_id');

CREATE CONSTRAINT TRIGGER check_ingredient_base_translation
  AFTER INSERT OR UPDATE ON public.ingredients
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('ingredient_translations', 'ingredient_id');

CREATE CONSTRAINT TRIGGER check_recipe_ingredient_base_translation
  AFTER INSERT OR UPDATE ON public.recipe_ingredients
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_ingredient_translations', 'recipe_ingredient_id');

CREATE CONSTRAINT TRIGGER check_measurement_unit_base_translation
  AFTER INSERT OR UPDATE ON public.measurement_units
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('measurement_unit_translations', 'measurement_unit_id');

CREATE CONSTRAINT TRIGGER check_recipe_tag_base_translation
  AFTER INSERT OR UPDATE ON public.recipe_tags
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_tag_translations', 'recipe_tag_id');

CREATE CONSTRAINT TRIGGER check_useful_item_base_translation
  AFTER INSERT OR UPDATE ON public.useful_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('useful_item_translations', 'useful_item_id');

CREATE CONSTRAINT TRIGGER check_recipe_useful_item_base_translation
  AFTER INSERT OR UPDATE ON public.recipe_useful_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_useful_item_translations', 'recipe_useful_item_id');

-- ============================================================
-- 1E. RLS on translation tables
-- ============================================================

-- recipe_translations: enforce parent's published check, include anon
ALTER TABLE public.recipe_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published recipe translations"
  ON public.recipe_translations FOR SELECT TO anon, authenticated
  USING (recipe_id IN (SELECT id FROM public.recipes WHERE is_published = true));

CREATE POLICY "Admins can read all recipe translations"
  ON public.recipe_translations FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin write recipe translations"
  ON public.recipe_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- recipe_step_translations
ALTER TABLE public.recipe_step_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipe step translations"
  ON public.recipe_step_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write recipe step translations"
  ON public.recipe_step_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ingredient_translations
ALTER TABLE public.ingredient_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ingredient translations"
  ON public.ingredient_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write ingredient translations"
  ON public.ingredient_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- recipe_ingredient_translations
ALTER TABLE public.recipe_ingredient_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipe ingredient translations"
  ON public.recipe_ingredient_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write recipe ingredient translations"
  ON public.recipe_ingredient_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- measurement_unit_translations
ALTER TABLE public.measurement_unit_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read measurement unit translations"
  ON public.measurement_unit_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write measurement unit translations"
  ON public.measurement_unit_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- recipe_tag_translations
ALTER TABLE public.recipe_tag_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipe tag translations"
  ON public.recipe_tag_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write recipe tag translations"
  ON public.recipe_tag_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- useful_item_translations
ALTER TABLE public.useful_item_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read useful item translations"
  ON public.useful_item_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write useful item translations"
  ON public.useful_item_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- recipe_useful_item_translations
ALTER TABLE public.recipe_useful_item_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipe useful item translations"
  ON public.recipe_useful_item_translations FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin write recipe useful item translations"
  ON public.recipe_useful_item_translations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 1F. Convenience VIEWs
-- ============================================================

CREATE VIEW public.recipes_summary AS
SELECT r.*, t.name, t.tips_and_tricks
FROM public.recipes r
LEFT JOIN public.recipe_translations t ON t.recipe_id = r.id AND t.locale = 'en';

CREATE VIEW public.ingredients_summary AS
SELECT i.*, t.name, t.plural_name
FROM public.ingredients i
LEFT JOIN public.ingredient_translations t ON t.ingredient_id = i.id AND t.locale = 'en';

-- ============================================================
-- 1G. Indexes on translation tables
-- ============================================================

-- Locale indexes (for filtering by locale)
CREATE INDEX idx_recipe_translations_locale ON public.recipe_translations(locale);
CREATE INDEX idx_recipe_step_translations_locale ON public.recipe_step_translations(locale);
CREATE INDEX idx_ingredient_translations_locale ON public.ingredient_translations(locale);
CREATE INDEX idx_recipe_ingredient_translations_locale ON public.recipe_ingredient_translations(locale);
CREATE INDEX idx_measurement_unit_translations_locale ON public.measurement_unit_translations(locale);
CREATE INDEX idx_recipe_tag_translations_locale ON public.recipe_tag_translations(locale);
CREATE INDEX idx_useful_item_translations_locale ON public.useful_item_translations(locale);
CREATE INDEX idx_recipe_useful_item_translations_locale ON public.recipe_useful_item_translations(locale);

-- Text search indexes for commonly queried columns
CREATE INDEX idx_ingredient_translations_name ON public.ingredient_translations(name);
CREATE INDEX idx_recipe_translations_name ON public.recipe_translations(name);
CREATE INDEX idx_recipe_tag_translations_name ON public.recipe_tag_translations(name);

-- Locales active index
CREATE INDEX idx_locales_is_active ON public.locales(is_active) WHERE is_active = true;

COMMIT;
