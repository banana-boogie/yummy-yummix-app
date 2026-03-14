-- ============================================================
-- i18n cleanup: no cross-language fallback, drop unused views
-- ============================================================
-- Principle: es and en are separate user groups. Only within-family
-- fallback is valid (es-MX → es). No fallback between language families.
-- ============================================================

-- 1. Drop unused convenience views that hardcode a single locale.
-- Zero consumers outside migration files (no Edge Functions, services, or app code).
DROP VIEW IF EXISTS public.recipes_summary;
DROP VIEW IF EXISTS public.ingredients_summary;

-- 2. Update resolve_locale() to remove cross-language fallback.
-- Previously fell back to ARRAY['es'] for unknown locales.
-- Now returns NULL for unknown locales — callers must handle missing translations.
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

  -- No cross-language fallback. Return NULL for unknown locales.
  RETURN result;
END;
$$;

-- 3. Drop orphaned check_base_translation if it still exists.
-- The constraint triggers were dropped in 20260309182603. The function was
-- recreated in 20260311041506 and dropped in 20260312010000, but ensure
-- it's gone.
DROP FUNCTION IF EXISTS public.check_base_translation() CASCADE;
