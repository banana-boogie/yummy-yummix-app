-- Add analytics chart RPC functions for admin dashboard.
-- Daily signups, daily active users, daily AI users, and content source split.

-- ============================================================
-- admin_daily_signups — daily signup and onboarding counts
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_daily_signups(
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
    'signups', signups,
    'onboarded', onboarded
  ) ORDER BY d ASC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      date_trunc('day', created_at)::date AS d,
      COUNT(*)::int AS signups,
      COUNT(*) FILTER (WHERE onboarding_complete = true)::int AS onboarded
    FROM user_profiles
    WHERE (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
    GROUP BY d
    ORDER BY d ASC
  ) daily;

  RETURN result;
END;
$$;

-- ============================================================
-- admin_daily_active_users — daily unique active user counts
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_daily_active_users(
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
      date_trunc('day', created_at)::date AS d,
      COUNT(DISTINCT user_id)::int AS users
    FROM user_events
    WHERE (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
    GROUP BY d
    ORDER BY d ASC
  ) daily;

  RETURN result;
END;
$$;

-- ============================================================
-- admin_daily_ai_users — daily unique AI users (chat + voice)
-- ============================================================
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
        date_trunc('day', created_at)::date AS d,
        user_id
      FROM ai_voice_sessions
      WHERE (start_ts IS NULL OR created_at >= start_ts)
        AND created_at <= end_ts
    ) combined
    GROUP BY d
    ORDER BY d ASC
  ) daily;

  RETURN result;
END;
$$;

-- ============================================================
-- admin_content_source_split — catalog vs user-generated cook counts
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
  LEFT JOIN recipes r ON r.id::text = events.recipe_id
  LEFT JOIN user_recipes ur ON ur.id::text = events.recipe_id;

  RETURN result;
END;
$$;
