-- Atomic generation budget check-and-increment + cooked recipes fixes
--
-- 1) Atomic RPC to prevent TOCTOU race in generation budget
-- 2) Fix sort order in get_cooked_recipes (match_score primary when searching)
-- 3) Add GRANT EXECUTE for get_cooked_recipes to authenticated role

-- ============================================================
-- 1. Atomic generation budget RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_generation_usage(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 120
)
RETURNS TABLE (allowed BOOLEAN, used INTEGER, was_80_warning_sent BOOLEAN, was_90_warning_sent BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start DATE := date_trunc('month', now())::date;
  v_count INTEGER;
  v_w80 BOOLEAN;
  v_w90 BOOLEAN;
BEGIN
  -- Ensure row exists
  INSERT INTO ai_monthly_generation_usage (user_id, month_start, generation_count)
  VALUES (p_user_id, v_month_start, 0)
  ON CONFLICT (user_id, month_start) DO NOTHING;

  -- Lock the row and read current count
  SELECT generation_count INTO v_count
  FROM ai_monthly_generation_usage
  WHERE user_id = p_user_id AND month_start = v_month_start
  FOR UPDATE;

  -- If at or over limit, reject without incrementing
  IF v_count >= p_limit THEN
    RETURN QUERY SELECT FALSE, v_count, TRUE::BOOLEAN, TRUE::BOOLEAN;
    RETURN;
  END IF;

  -- Increment and return new count + warning state
  UPDATE ai_monthly_generation_usage
  SET generation_count = generation_count + 1, updated_at = now()
  WHERE user_id = p_user_id AND month_start = v_month_start
  RETURNING
    generation_count,
    (warning_80_sent_at IS NOT NULL),
    (warning_90_sent_at IS NOT NULL)
  INTO v_count, v_w80, v_w90;

  RETURN QUERY SELECT TRUE, v_count, v_w80, v_w90;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_generation_usage(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_generation_usage(UUID, INTEGER) TO service_role;

-- ============================================================
-- 2. Fix get_cooked_recipes sort order
-- ============================================================
-- When a query is provided, match_score should be the primary sort key.
-- Previously: ORDER BY cooked_at DESC, match_score DESC (query matches buried)

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
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
RETURN QUERY
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
ORDER BY
  CASE WHEN p.query_text IS NOT NULL THEN f.match_score END DESC NULLS LAST,
  f.cooked_at DESC
LIMIT p.limit_rows;
END;
$$;

-- ============================================================
-- 3. Grant EXECUTE on get_cooked_recipes to authenticated
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_cooked_recipes(text, text, timestamptz, timestamptz, integer) TO authenticated;
