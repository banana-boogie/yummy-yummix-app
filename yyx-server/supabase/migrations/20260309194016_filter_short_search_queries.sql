-- Filter out short search queries (< 3 chars) from top searches.
-- Single letters and 2-char fragments are keystroke noise, not meaningful searches.

CREATE OR REPLACE FUNCTION public.admin_top_searches(
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
    'query', query,
    'count', count
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      query,
      COUNT(*)::int AS count
    FROM (
      SELECT LOWER(TRIM(payload->>'query')) AS query
      FROM user_events
      WHERE event_type = 'search'
        AND payload ? 'query'
        AND (start_ts IS NULL OR created_at >= start_ts)
        AND created_at <= end_ts
    ) normalized
    WHERE query IS NOT NULL AND length(query) >= 3
    GROUP BY query
    ORDER BY count DESC
    LIMIT safe_limit
  ) ranked;

  RETURN result;
END;
$$;
