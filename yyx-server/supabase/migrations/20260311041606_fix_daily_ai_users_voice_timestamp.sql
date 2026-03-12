-- Fix: align ai_voice_sessions timestamp in admin_daily_ai_users
-- to use COALESCE(completed_at, started_at), matching the convention
-- used by admin_ai_usage and other AI RPCs.

CREATE OR REPLACE FUNCTION public.admin_daily_ai_users(
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', d,
    'users', users
  ) ORDER BY d ASC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      d,
      COUNT(DISTINCT user_id)::int AS users
    FROM (
      SELECT
        date_trunc('day', created_at)::date AS d,
        user_id
      FROM user_chat_sessions
      WHERE (start_ts IS NULL OR created_at >= start_ts)
        AND created_at <= end_ts
      UNION
      SELECT
        date_trunc('day', COALESCE(completed_at, started_at))::date AS d,
        user_id
      FROM ai_voice_sessions
      WHERE (start_ts IS NULL OR COALESCE(completed_at, started_at) >= start_ts)
        AND COALESCE(completed_at, started_at) <= end_ts
    ) combined
    GROUP BY d
    ORDER BY d ASC
  ) daily;

  RETURN result;
END;
$$;
