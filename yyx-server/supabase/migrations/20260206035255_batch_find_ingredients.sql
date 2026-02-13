-- [Ingredient Matching 2/4] Batch find ingredients for performance optimization
-- Related: 20260206025947 (threshold), 20260206043000 (aliases), 20260206050655 (batch fix)
-- Reduces N+1 queries in enrichIngredientsWithImages() to a single query
-- Each ingredient gets exact match OR fuzzy fallback

CREATE OR REPLACE FUNCTION public.batch_find_ingredients(
  ingredient_names text[],
  preferred_lang text DEFAULT 'en'
)
RETURNS TABLE(
  input_name text,
  matched_name text,
  matched_name_es text,
  image_url text,
  match_score real
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  similarity_threshold CONSTANT real := 0.5;
BEGIN
  RETURN QUERY
  WITH input_ingredients AS (
    SELECT unnest(ingredient_names) AS name
  ),
  -- First pass: exact matches (case-insensitive)
  exact_matches AS (
    SELECT DISTINCT ON (inp.name)
      inp.name AS input_name,
      i.name_en AS matched_name,
      i.name_es AS matched_name_es,
      i.image_url,
      1.0::real AS match_score
    FROM input_ingredients inp
    JOIN ingredients i ON (
      lower(i.name_en) = lower(inp.name) OR
      lower(i.name_es) = lower(inp.name)
    )
    ORDER BY inp.name,
      -- Prefer language-specific match
      CASE preferred_lang
        WHEN 'es' THEN CASE WHEN lower(i.name_es) = lower(inp.name) THEN 0 ELSE 1 END
        ELSE CASE WHEN lower(i.name_en) = lower(inp.name) THEN 0 ELSE 1 END
      END
  ),
  -- Second pass: fuzzy matches for ingredients without exact match
  fuzzy_matches AS (
    SELECT DISTINCT ON (inp.name)
      inp.name AS input_name,
      i.name_en AS matched_name,
      i.name_es AS matched_name_es,
      i.image_url,
      (CASE preferred_lang
        WHEN 'es' THEN GREATEST(similarity(i.name_es, inp.name) * 1.2, similarity(i.name_en, inp.name))
        ELSE GREATEST(similarity(i.name_en, inp.name) * 1.2, similarity(i.name_es, inp.name))
      END)::real AS match_score
    FROM input_ingredients inp
    LEFT JOIN exact_matches em ON em.input_name = inp.name
    JOIN ingredients i ON (
      em.input_name IS NULL AND (
        similarity(i.name_en, inp.name) >= similarity_threshold OR
        similarity(i.name_es, inp.name) >= similarity_threshold
      )
    )
    ORDER BY inp.name, match_score DESC
  )
  -- Combine: exact matches take priority, then fuzzy
  SELECT
    COALESCE(em.input_name, fm.input_name) AS input_name,
    COALESCE(em.matched_name, fm.matched_name) AS matched_name,
    COALESCE(em.matched_name_es, fm.matched_name_es) AS matched_name_es,
    COALESCE(em.image_url, fm.image_url) AS image_url,
    COALESCE(em.match_score, fm.match_score) AS match_score
  FROM exact_matches em
  FULL OUTER JOIN fuzzy_matches fm ON em.input_name = fm.input_name;
END;
$$;

COMMENT ON FUNCTION public.batch_find_ingredients IS
  'Batch find ingredient matches for multiple names in a single query.
   Returns exact matches first, fuzzy fallback for unmatched.
   Threshold of 0.5 prevents false positives.';
