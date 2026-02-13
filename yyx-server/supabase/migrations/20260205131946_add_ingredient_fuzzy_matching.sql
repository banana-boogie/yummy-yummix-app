-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function: Find best matching ingredient with language preference
-- Prioritizes matches in the user's language, falls back to other language
--
-- Parameters:
--   search_name: ingredient name to search for
--   preferred_lang: 'en' or 'es' - user's language (prioritized in results)
--
-- Returns: id, name_en, name_es, image_url, match_score
CREATE OR REPLACE FUNCTION public.find_closest_ingredient(
  search_name text,
  preferred_lang text DEFAULT 'en'
)
RETURNS TABLE(id uuid, name_en text, name_es text, image_url text, match_score real)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First try exact match (case-insensitive) - prefer user's language
  IF preferred_lang = 'es' THEN
    RETURN QUERY
    SELECT i.id, i.name_en, i.name_es, i.image_url, 1.0::real
    FROM ingredients i
    WHERE lower(i.name_es) = lower(search_name)
       OR lower(i.name_en) = lower(search_name)
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT i.id, i.name_en, i.name_es, i.image_url, 1.0::real
    FROM ingredients i
    WHERE lower(i.name_en) = lower(search_name)
       OR lower(i.name_es) = lower(search_name)
    LIMIT 1;
  END IF;

  IF FOUND THEN RETURN; END IF;

  -- Trigram similarity fallback
  -- Score: preferred language similarity * 1.2 to give it priority
  RETURN QUERY
  SELECT
    i.id,
    i.name_en,
    i.name_es,
    i.image_url,
    CASE preferred_lang
      WHEN 'es' THEN GREATEST(similarity(i.name_es, search_name) * 1.2, similarity(i.name_en, search_name))
      ELSE GREATEST(similarity(i.name_en, search_name) * 1.2, similarity(i.name_es, search_name))
    END as match_score
  FROM ingredients i
  WHERE i.name_en % search_name  -- trigram operator (threshold 0.3)
     OR i.name_es % search_name
  ORDER BY match_score DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.find_closest_ingredient(text, text) IS
'Find best matching ingredient by name using trigram similarity.
Prioritizes matches in preferred_lang (''en'' or ''es'').
Returns: id, name_en, name_es, image_url, match_score (0-1.2)
Used by: generate-custom-recipe.ts for ingredient image matching';
