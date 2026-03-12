-- Migration: Remove dead LEFT JOIN user_recipes from admin_content_source_split
-- Author: database-agent
-- Date: 2026-03-11

-- ============================================================
-- admin_content_source_split — remove unused LEFT JOIN user_recipes
-- The join was never referenced in SELECT or WHERE; it only added
-- cost without affecting results.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_content_source_split(
  timeframe text DEFAULT 'all_time'
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

  SELECT jsonb_build_object(
    'catalog', COALESCE(SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int,
    'userGenerated', COALESCE(SUM(CASE WHEN r.id IS NULL THEN 1 ELSE 0 END), 0)::int
  )
  INTO result
  FROM (
    SELECT
      payload->>'recipe_id' AS recipe_id
    FROM user_events
    WHERE event_type = 'cook_complete'
      AND payload ? 'recipe_id'
      AND (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
  ) events
  LEFT JOIN recipes r ON r.id::text = events.recipe_id;

  RETURN result;
END;
$$;
