-- ============================================================
-- Change base locale from 'en' to 'es' (Mexico-first app)
-- ============================================================
-- Spanish is our primary target market. All entities must have
-- an 'es' base translation. English is auto-translated on save.
-- ============================================================

-- 1. Update check_base_translation to require 'es' instead of 'en'
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
    'SELECT EXISTS(SELECT 1 FROM %I WHERE %I = $1 AND locale = ''es'')',
    translation_table, fk_column
  ) INTO has_base USING NEW.id;

  IF NOT has_base THEN
    RAISE EXCEPTION '% % must have a base (es) translation in %',
      TG_TABLE_NAME, NEW.id, translation_table;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update resolve_locale fallback from 'en' to 'es'
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

  -- Ultimate fallback to Spanish (primary market)
  IF result IS NULL THEN
    RETURN ARRAY['es'];
  END IF;

  RETURN result;
END;
$$;

-- 3. Update convenience views to join on 'es' instead of 'en'
CREATE OR REPLACE VIEW public.recipes_summary AS
SELECT r.*, t.name, t.tips_and_tricks
FROM public.recipes r
LEFT JOIN public.recipe_translations t ON t.recipe_id = r.id AND t.locale = 'es';

CREATE OR REPLACE VIEW public.ingredients_summary AS
SELECT i.*, t.name, t.plural_name
FROM public.ingredients i
LEFT JOIN public.ingredient_translations t ON t.ingredient_id = i.id AND t.locale = 'es';
