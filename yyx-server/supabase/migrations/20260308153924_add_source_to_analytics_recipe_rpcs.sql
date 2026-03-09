-- Update analytics recipe RPCs to include source (catalog vs user) and user info.
-- Joins against both `recipes` and `user_recipes` to resolve the recipe origin.

-- ============================================================
-- admin_top_viewed_recipes — now includes source, userId, userName
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_top_viewed_recipes(
  timeframe text DEFAULT '7_days',
  limit_count integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts timestamptz;
  end_ts timestamptz;
  result jsonb;
  safe_limit integer := GREATEST(COALESCE(limit_count, 10), 1);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  end_ts := date_trunc('day', now()) + interval '1 day' - interval '1 millisecond';

  IF timeframe IS NULL OR timeframe = 'all_time' THEN
    start_ts := NULL;
  ELSIF timeframe = 'today' THEN
    start_ts := date_trunc('day', now());
  ELSIF timeframe = '7_days' THEN
    start_ts := now() - interval '7 days';
  ELSIF timeframe = '30_days' THEN
    start_ts := now() - interval '30 days';
  ELSE
    RAISE EXCEPTION 'Invalid timeframe: %', timeframe;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'recipeId', recipe_id,
    'recipeName', recipe_name,
    'count', count,
    'source', source,
    'userId', user_id,
    'userName', user_name
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      ranked.recipe_id,
      ranked.recipe_name,
      ranked.count,
      CASE WHEN r.id IS NOT NULL THEN 'catalog' ELSE 'user' END AS source,
      ur.user_id::text AS user_id,
      COALESCE(up.name, up.username) AS user_name
    FROM (
      SELECT
        payload->>'recipe_id' AS recipe_id,
        COALESCE(MAX(NULLIF(payload->>'recipe_name', '')), 'Unknown') AS recipe_name,
        COUNT(*)::int AS count
      FROM user_events
      WHERE event_type = 'view_recipe'
        AND payload ? 'recipe_id'
        AND (start_ts IS NULL OR created_at >= start_ts)
        AND created_at <= end_ts
      GROUP BY recipe_id
      ORDER BY count DESC
      LIMIT safe_limit
    ) ranked
    LEFT JOIN recipes r ON r.id::text = ranked.recipe_id
    LEFT JOIN user_recipes ur ON ur.id::text = ranked.recipe_id
    LEFT JOIN user_profiles up ON up.id = ur.user_id
  ) enriched;

  RETURN result;
END;
$$;

-- ============================================================
-- admin_top_cooked_recipes — now includes source, userId, userName
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_top_cooked_recipes(
  timeframe text DEFAULT '7_days',
  limit_count integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts timestamptz;
  end_ts timestamptz;
  result jsonb;
  safe_limit integer := GREATEST(COALESCE(limit_count, 10), 1);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  end_ts := date_trunc('day', now()) + interval '1 day' - interval '1 millisecond';

  IF timeframe IS NULL OR timeframe = 'all_time' THEN
    start_ts := NULL;
  ELSIF timeframe = 'today' THEN
    start_ts := date_trunc('day', now());
  ELSIF timeframe = '7_days' THEN
    start_ts := now() - interval '7 days';
  ELSIF timeframe = '30_days' THEN
    start_ts := now() - interval '30 days';
  ELSE
    RAISE EXCEPTION 'Invalid timeframe: %', timeframe;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'recipeId', recipe_id,
    'recipeName', recipe_name,
    'count', count,
    'source', source,
    'userId', user_id,
    'userName', user_name
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      ranked.recipe_id,
      ranked.recipe_name,
      ranked.count,
      CASE WHEN r.id IS NOT NULL THEN 'catalog' ELSE 'user' END AS source,
      ur.user_id::text AS user_id,
      COALESCE(up.name, up.username) AS user_name
    FROM (
      SELECT
        payload->>'recipe_id' AS recipe_id,
        COALESCE(MAX(NULLIF(payload->>'recipe_name', '')), 'Unknown') AS recipe_name,
        COUNT(*)::int AS count
      FROM user_events
      WHERE event_type = 'cook_complete'
        AND payload ? 'recipe_id'
        AND (start_ts IS NULL OR created_at >= start_ts)
        AND created_at <= end_ts
      GROUP BY recipe_id
      ORDER BY count DESC
      LIMIT safe_limit
    ) ranked
    LEFT JOIN recipes r ON r.id::text = ranked.recipe_id
    LEFT JOIN user_recipes ur ON ur.id::text = ranked.recipe_id
    LEFT JOIN user_profiles up ON up.id = ur.user_id
  ) enriched;

  RETURN result;
END;
$$;
