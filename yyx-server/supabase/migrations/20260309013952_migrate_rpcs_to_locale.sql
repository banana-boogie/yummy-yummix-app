-- Migrate RPCs and tables from language to locale-based i18n
-- Part of PR3: Backend Migration to Translation Tables

-- ============================================================
-- 1. ingredient_aliases: rename 'language' column to 'locale'
-- ============================================================

ALTER TABLE public.ingredient_aliases
  RENAME COLUMN language TO locale;

-- Update CHECK constraint (drop old, add new)
ALTER TABLE public.ingredient_aliases
  DROP CONSTRAINT IF EXISTS ingredient_aliases_language_check;

ALTER TABLE public.ingredient_aliases
  ADD CONSTRAINT ingredient_aliases_locale_check
  CHECK (locale IN ('en', 'es'));

-- Recreate index with new column name
DROP INDEX IF EXISTS idx_ingredient_aliases_alias_lang;
CREATE INDEX idx_ingredient_aliases_alias_locale
  ON public.ingredient_aliases (lower(alias), locale);

-- ============================================================
-- 2. batch_find_ingredients: preferred_lang -> preferred_locale
--    Drop matched_name_es from return type (callers only use matched_name)
--    Join ingredient_translations for name resolution
-- ============================================================

CREATE OR REPLACE FUNCTION public.batch_find_ingredients(
  ingredient_names text[],
  preferred_locale text DEFAULT 'en'
)
RETURNS TABLE(
  input_name text,
  matched_name text,
  image_url text,
  match_score real
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  similarity_threshold CONSTANT real := 0.7;
  base_lang text;
BEGIN
  -- Guard: return empty if no input
  IF ingredient_names IS NULL OR array_length(ingredient_names, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Extract base language from locale (e.g., 'es-MX' -> 'es')
  base_lang := split_part(preferred_locale, '-', 1);

  RETURN QUERY
  WITH input_ingredients AS (
    SELECT unnest(ingredient_names) AS name
  ),
  -- First pass: exact matches via translation table (case-insensitive)
  exact_matches AS (
    SELECT DISTINCT ON (inp.name)
      inp.name AS input_name,
      coalesce(
        pref_t.name,
        fallback_t.name,
        any_t.name
      ) AS matched_name,
      i.image_url,
      1.0::real AS match_score
    FROM input_ingredients inp
    JOIN ingredient_translations it ON lower(it.name) = lower(inp.name)
    JOIN ingredients i ON i.id = it.ingredient_id
    LEFT JOIN ingredient_translations pref_t
      ON pref_t.ingredient_id = i.id AND pref_t.locale = base_lang
    LEFT JOIN ingredient_translations fallback_t
      ON fallback_t.ingredient_id = i.id AND fallback_t.locale = 'en'
    LEFT JOIN LATERAL (
      SELECT it2.name FROM ingredient_translations it2
      WHERE it2.ingredient_id = i.id
      ORDER BY it2.locale
      LIMIT 1
    ) any_t ON true
    ORDER BY inp.name,
      CASE WHEN lower(it.name) = lower(inp.name) AND it.locale = base_lang THEN 0 ELSE 1 END
  ),
  -- Second pass: fuzzy matches for ingredients without exact match
  fuzzy_matches AS (
    SELECT DISTINCT ON (inp.name)
      inp.name AS input_name,
      coalesce(
        pref_t.name,
        fallback_t.name,
        any_t.name
      ) AS matched_name,
      i.image_url,
      greatest(
        max(similarity(it.name, inp.name)),
        0
      )::real AS match_score
    FROM input_ingredients inp
    LEFT JOIN exact_matches em ON em.input_name = inp.name
    JOIN ingredient_translations it ON (
      em.input_name IS NULL AND
      similarity(it.name, inp.name) >= similarity_threshold
    )
    JOIN ingredients i ON i.id = it.ingredient_id
    LEFT JOIN ingredient_translations pref_t
      ON pref_t.ingredient_id = i.id AND pref_t.locale = base_lang
    LEFT JOIN ingredient_translations fallback_t
      ON fallback_t.ingredient_id = i.id AND fallback_t.locale = 'en'
    LEFT JOIN LATERAL (
      SELECT it2.name FROM ingredient_translations it2
      WHERE it2.ingredient_id = i.id
      ORDER BY it2.locale
      LIMIT 1
    ) any_t ON true
    GROUP BY inp.name, i.id, i.image_url, pref_t.name, fallback_t.name, any_t.name
    ORDER BY inp.name, match_score DESC
  )
  -- Combine: start from inputs, left join matches
  SELECT
    inp.name AS input_name,
    COALESCE(em.matched_name, fm.matched_name) AS matched_name,
    COALESCE(em.image_url, fm.image_url) AS image_url,
    COALESCE(em.match_score, fm.match_score) AS match_score
  FROM input_ingredients inp
  LEFT JOIN exact_matches em ON em.input_name = inp.name
  LEFT JOIN fuzzy_matches fm ON fm.input_name = inp.name;
END;
$$;

COMMENT ON FUNCTION public.batch_find_ingredients IS
  'Batch find ingredient matches using translation tables.
   Returns ALL input ingredients (with NULLs for unmatched).
   Exact matches first, fuzzy fallback for unmatched.
   Threshold of 0.7 to reduce false positive matches.';

-- ============================================================
-- 3. get_cooked_recipes: p_language -> p_locale
--    Join recipe_translations for localized name resolution
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cooked_recipes(
  p_locale text,
  p_query text DEFAULT NULL,
  p_after timestamptz DEFAULT NULL,
  p_before timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  recipe_id uuid,
  recipe_table text,
  name text,
  image_url text,
  total_time integer,
  difficulty text,
  portions integer,
  last_cooked_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  base_lang text;
BEGIN
  -- Extract base language from locale (e.g., 'es-MX' -> 'es')
  base_lang := split_part(coalesce(p_locale, 'en'), '-', 1);

RETURN QUERY
WITH params AS (
  SELECT
    base_lang AS lang,
    nullif(trim(coalesce(p_query, '')), '') AS query_text
),
normalized_events AS (
  SELECT
    (e.payload->>'recipe_id')::uuid AS recipe_id,
    CASE
      WHEN coalesce(e.payload->>'recipe_table', '') = 'user_recipes'
        OR coalesce(e.payload->>'recipe_source', '') IN ('irmixy', 'custom')
      THEN 'user_recipes'
      ELSE 'recipes'
    END AS recipe_table,
    e.created_at
  FROM public.user_events e
  WHERE
    e.user_id = auth.uid()
    AND e.event_type = 'cook_complete'
    AND e.payload ? 'recipe_id'
    AND (e.payload->>'recipe_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (p_after IS NULL OR e.created_at >= p_after)
    AND (p_before IS NULL OR e.created_at <= p_before)
),
catalog_rows AS (
  SELECT
    ne.recipe_id,
    'recipes'::text AS recipe_table,
    coalesce(
      nullif(pref_t.name, ''),
      nullif(en_t.name, ''),
      nullif(es_t.name, ''),
      'Untitled'
    ) AS name,
    r.image_url,
    coalesce(r.total_time, 0)::integer AS total_time,
    coalesce(r.difficulty::text, 'easy') AS difficulty,
    greatest(coalesce(r.portions, 1), 1)::integer AS portions,
    ne.created_at AS cooked_at
  FROM normalized_events ne
  JOIN public.recipes r
    ON r.id = ne.recipe_id
   AND r.is_published = true
  CROSS JOIN params p
  LEFT JOIN recipe_translations pref_t
    ON pref_t.recipe_id = r.id AND pref_t.locale = p.lang
  LEFT JOIN recipe_translations en_t
    ON en_t.recipe_id = r.id AND en_t.locale = 'en'
  LEFT JOIN recipe_translations es_t
    ON es_t.recipe_id = r.id AND es_t.locale = 'es'
  WHERE ne.recipe_table = 'recipes'
),
user_recipe_rows AS (
  SELECT
    ne.recipe_id,
    'user_recipes'::text AS recipe_table,
    coalesce(nullif(ur.name, ''), 'Untitled') AS name,
    ur.image_url,
    greatest(
      coalesce(ur.total_time, nullif(ur.recipe_data->>'totalTime', '')::integer, 0),
      0
    )::integer AS total_time,
    CASE
      WHEN coalesce(ur.difficulty::text, nullif(ur.recipe_data->>'difficulty', ''), '') IN ('easy', 'medium', 'hard')
      THEN coalesce(ur.difficulty::text, nullif(ur.recipe_data->>'difficulty', ''))
      ELSE 'easy'
    END AS difficulty,
    greatest(
      coalesce(ur.portions, nullif(ur.recipe_data->>'portions', '')::integer, 1),
      1
    )::integer AS portions,
    ne.created_at AS cooked_at
  FROM normalized_events ne
  JOIN public.user_recipes ur
    ON ur.id = ne.recipe_id
   AND ur.user_id = auth.uid()
  WHERE ne.recipe_table = 'user_recipes'
),
combined AS (
  SELECT * FROM catalog_rows
  UNION ALL
  SELECT * FROM user_recipe_rows
),
scored AS (
  SELECT
    c.*,
    row_number() OVER (
      PARTITION BY c.recipe_table, c.recipe_id
      ORDER BY c.cooked_at DESC
    ) AS recipe_rank,
    CASE
      WHEN p.query_text IS NULL THEN 0.0::double precision
      ELSE
        (CASE WHEN lower(c.name) LIKE '%' || lower(p.query_text) || '%' THEN 1.0 ELSE 0.0 END)
        + similarity(lower(c.name), lower(p.query_text))
    END AS match_score
  FROM combined c
  CROSS JOIN params p
),
filtered AS (
  SELECT s.*
  FROM scored s
  CROSS JOIN params p
  WHERE
    s.recipe_rank = 1
    AND (
      p.query_text IS NULL
      OR lower(s.name) LIKE '%' || lower(p.query_text) || '%'
      OR similarity(lower(s.name), lower(p.query_text)) >= 0.16
    )
)
SELECT
  f.recipe_id,
  f.recipe_table,
  f.name,
  f.image_url,
  f.total_time,
  f.difficulty,
  f.portions,
  f.cooked_at AS last_cooked_at
FROM filtered f
CROSS JOIN params p
ORDER BY
  CASE WHEN p.query_text IS NOT NULL THEN f.match_score END DESC NULLS LAST,
  f.cooked_at DESC
LIMIT least(greatest(coalesce(p_limit, 5), 1), 10);
END;
$$;

COMMENT ON FUNCTION public.get_cooked_recipes IS
  'Retrieve recipes the current user has cooked, with locale-based name resolution.
   Uses recipe_translations for catalog recipes, falls back through locale chain.';
