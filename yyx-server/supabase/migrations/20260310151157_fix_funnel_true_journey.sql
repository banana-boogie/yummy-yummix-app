-- Restructure cooking funnel to track all recipe sources properly.
--
-- Previously counted raw events independently, missing AI-generated recipes
-- entirely (they have no view_recipe event). 13 of 20 unique recipe cooks
-- had no view event — most cooking happens outside the catalog browse flow.
--
-- New structure:
--   Cooking Completion (all sources): starts, completes, completion rate
--   Catalog Conversion (catalog only): views, starts-with-view, conversion rate

CREATE OR REPLACE FUNCTION public.admin_funnel(
  timeframe text DEFAULT '7_days'
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

  WITH recipe_stages AS (
    SELECT
      user_id,
      payload->>'recipe_id' AS recipe_id,
      bool_or(event_type = 'view_recipe') AS viewed,
      bool_or(event_type = 'cook_start') AS started,
      bool_or(event_type = 'cook_complete') AS completed
    FROM user_events
    WHERE event_type IN ('view_recipe', 'cook_start', 'cook_complete')
      AND payload ? 'recipe_id'
      AND (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
    GROUP BY user_id, payload->>'recipe_id'
  ),
  counts AS (
    SELECT
      -- All sources: starts and completes
      COUNT(*) FILTER (WHERE started)::int AS total_starts,
      COUNT(*) FILTER (WHERE completed)::int AS total_completes,
      -- Catalog only: viewed recipes that led to cooking
      COUNT(*) FILTER (WHERE viewed)::int AS catalog_views,
      COUNT(*) FILTER (WHERE viewed AND started)::int AS catalog_starts
    FROM recipe_stages
  )
  SELECT jsonb_build_object(
    'totalStarts', total_starts,
    'totalCompletes', total_completes,
    'completionRate', CASE WHEN total_starts > 0
      THEN ROUND(total_completes::numeric / total_starts::numeric * 100, 1)
      ELSE 0 END,
    'catalogViews', catalog_views,
    'catalogStarts', catalog_starts,
    'catalogConversionRate', CASE WHEN catalog_views > 0
      THEN ROUND(catalog_starts::numeric / catalog_views::numeric * 100, 1)
      ELSE 0 END
  )
  INTO result
  FROM counts;

  RETURN result;
END;
$$;
