-- Cooked recipe retrieval foundation
-- 1) Adds a user-scoped analytics index for cooked-history lookups
-- 2) Adds get_cooked_recipes RPC used by retrieve_cooked_recipes tool

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_user_events_user_event_type_created_at
ON public.user_events (user_id, event_type, created_at DESC);

DROP FUNCTION IF EXISTS public.get_cooked_recipes(
  text,
  text,
  timestamptz,
  timestamptz,
  integer
);

CREATE OR REPLACE FUNCTION public.get_cooked_recipes(
  p_language text,
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH params AS (
  SELECT
    CASE
      WHEN lower(coalesce(p_language, 'en')) = 'es' THEN 'es'
      ELSE 'en'
    END AS language,
    nullif(trim(coalesce(p_query, '')), '') AS query_text,
    least(greatest(coalesce(p_limit, 5), 1), 10) AS limit_rows
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
      CASE
        WHEN p.language = 'es' THEN nullif(r.name_es, '')
        ELSE nullif(r.name_en, '')
      END,
      nullif(r.name_en, ''),
      nullif(r.name_es, ''),
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
ORDER BY f.cooked_at DESC, f.match_score DESC
LIMIT p.limit_rows;
$$;

COMMENT ON FUNCTION public.get_cooked_recipes(text, text, timestamptz, timestamptz, integer)
IS 'Returns recent cooked recipes (catalog + user_recipes) for auth.uid(), with optional fuzzy name query and timeframe filters.';
