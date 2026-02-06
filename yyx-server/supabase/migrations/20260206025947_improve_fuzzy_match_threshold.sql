-- Improve fuzzy match threshold to prevent false positives
-- Example: "chili powder" was matching "cinnamon powder" with score 0.46
-- Raising threshold from 0.3 to 0.5 requires at least 50% similarity

CREATE OR REPLACE FUNCTION public.find_closest_ingredient(
  search_name text,
  preferred_lang text DEFAULT 'en'
)
RETURNS TABLE(id uuid, name_en text, name_es text, image_url text, match_score real)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  similarity_threshold CONSTANT real := 0.5;  -- Raised from default 0.3
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

  -- Trigram similarity fallback with higher threshold
  -- Score: preferred language similarity * 1.2 to give it priority
  RETURN QUERY
  SELECT
    i.id,
    i.name_en,
    i.name_es,
    i.image_url,
    (CASE preferred_lang
      WHEN 'es' THEN GREATEST(similarity(i.name_es, search_name) * 1.2, similarity(i.name_en, search_name))
      ELSE GREATEST(similarity(i.name_en, search_name) * 1.2, similarity(i.name_es, search_name))
    END)::real as match_score
  FROM ingredients i
  WHERE (
    -- Only match if similarity is above threshold
    similarity(i.name_en, search_name) >= similarity_threshold
    OR similarity(i.name_es, search_name) >= similarity_threshold
  )
  ORDER BY match_score DESC
  LIMIT 1;
END;
$$;

-- Add comment explaining the threshold choice
COMMENT ON FUNCTION public.find_closest_ingredient IS
  'Find closest ingredient match using trigram similarity.
   Threshold of 0.5 prevents false positives like "chili powder" matching "cinnamon powder".';
