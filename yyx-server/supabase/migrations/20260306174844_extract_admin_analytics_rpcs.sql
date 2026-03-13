-- Extract admin_analytics branches into dedicated RPC functions.
-- Each function follows the pattern established by admin_ai_usage and admin_ai_chat_session_depth.
-- The original admin_analytics function is NOT dropped here for safety.

-- ============================================================
-- 1. admin_overview() — no parameters (uses fixed windows)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'dau', (SELECT COUNT(DISTINCT user_id)::int FROM user_events WHERE created_at >= date_trunc('day', now())),
    'wau', (SELECT COUNT(DISTINCT user_id)::int FROM user_events WHERE created_at >= now() - interval '7 days'),
    'mau', (SELECT COUNT(DISTINCT user_id)::int FROM user_events WHERE created_at >= now() - interval '30 days'),
    'totalSignups', (SELECT COUNT(*)::int FROM user_profiles),
    'onboardingRate', (
      SELECT CASE
        WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE onboarding_complete))::numeric / COUNT(*)::numeric * 100
        ELSE 0
      END
      FROM user_profiles
    )
  )
  INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 2. admin_funnel(timeframe)
-- ============================================================
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

  WITH counts AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'view_recipe')::int AS views,
      COUNT(*) FILTER (WHERE event_type = 'cook_start')::int AS starts,
      COUNT(*) FILTER (WHERE event_type = 'cook_complete')::int AS completes
    FROM user_events
    WHERE (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
  )
  SELECT jsonb_build_object(
    'totalViews', views,
    'totalStarts', starts,
    'totalCompletes', completes,
    'viewToStartRate', CASE WHEN views > 0 THEN starts::numeric / views::numeric * 100 ELSE 0 END,
    'startToCompleteRate', CASE WHEN starts > 0 THEN completes::numeric / starts::numeric * 100 ELSE 0 END,
    'overallConversionRate', CASE WHEN views > 0 THEN completes::numeric / views::numeric * 100 ELSE 0 END
  )
  INTO result
  FROM counts;

  RETURN result;
END;
$$;

-- ============================================================
-- 3. admin_top_viewed_recipes(timeframe, limit_count)
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
    'count', count
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO result
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
  ) ranked;

  RETURN result;
END;
$$;

-- ============================================================
-- 4. admin_top_cooked_recipes(timeframe, limit_count)
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
    'count', count
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO result
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
  ) ranked;

  RETURN result;
END;
$$;

-- ============================================================
-- 5. admin_top_searches(timeframe, limit_count)
-- ============================================================
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
    WHERE query IS NOT NULL AND query <> ''
    GROUP BY query
    ORDER BY count DESC
    LIMIT safe_limit
  ) ranked;

  RETURN result;
END;
$$;

-- ============================================================
-- 6. admin_ai_adoption(timeframe) — renamed from 'ai' action
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_ai_adoption(
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

  WITH totals AS (
    SELECT COUNT(*)::int AS total_users FROM user_profiles
  ),
  chat_sessions AS (
    SELECT COUNT(*)::int AS total
    FROM user_chat_sessions
    WHERE (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
  ),
  voice_sessions AS (
    SELECT COUNT(*)::int AS total
    FROM ai_voice_sessions
    WHERE (start_ts IS NULL OR COALESCE(completed_at, started_at) >= start_ts)
      AND COALESCE(completed_at, started_at) <= end_ts
  ),
  ai_sessions AS (
    SELECT user_id
    FROM user_chat_sessions
    WHERE (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
    UNION ALL
    SELECT user_id
    FROM ai_voice_sessions
    WHERE (start_ts IS NULL OR COALESCE(completed_at, started_at) >= start_ts)
      AND COALESCE(completed_at, started_at) <= end_ts
  ),
  ai_users AS (
    SELECT COUNT(DISTINCT user_id)::int AS total FROM ai_sessions
  ),
  return_users AS (
    SELECT COUNT(*)::int AS total FROM (
      SELECT user_id, COUNT(*) AS session_count
      FROM ai_sessions
      GROUP BY user_id
      HAVING COUNT(*) >= 2
    ) counted
  )
  SELECT jsonb_build_object(
    'aiAdoptionRate', CASE
      WHEN (SELECT total_users FROM totals) > 0 THEN (SELECT total FROM ai_users)::numeric / (SELECT total_users FROM totals)::numeric * 100
      ELSE 0
    END,
    'totalChatSessions', (SELECT total FROM chat_sessions),
    'totalVoiceSessions', (SELECT total FROM voice_sessions),
    'aiUserCount', (SELECT total FROM ai_users),
    'returnAIUsers', (SELECT total FROM return_users)
  )
  INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 7. admin_patterns() — no parameters
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_patterns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH hours AS (
    SELECT generate_series(0, 23) AS hour
  ),
  counts AS (
    SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
    FROM user_events
    WHERE event_type = 'cook_start'
    GROUP BY 1
  ),
  cooking_by_hour AS (
    SELECT jsonb_agg(jsonb_build_object(
      'hour', hours.hour,
      'count', COALESCE(counts.count, 0)
    ) ORDER BY hours.hour) AS data
    FROM hours
    LEFT JOIN counts ON counts.hour = hours.hour
  ),
  language_split AS (
    SELECT jsonb_agg(jsonb_build_object(
      'language', language,
      'count', count
    ) ORDER BY count DESC) AS data
    FROM (
      SELECT COALESCE(language, 'en') AS language, COUNT(*)::int AS count
      FROM user_profiles
      GROUP BY 1
    ) grouped
  )
  SELECT jsonb_build_object(
    'cookingByHour', COALESCE((SELECT data FROM cooking_by_hour), '[]'::jsonb),
    'languageSplit', COALESCE((SELECT data FROM language_split), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 8. admin_retention() — no parameters
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH users AS (
    SELECT id, created_at
    FROM user_profiles
  ),
  events_with_day AS (
    SELECT
      e.user_id,
      e.event_type,
      e.created_at,
      FLOOR(EXTRACT(EPOCH FROM (e.created_at - u.created_at)) / 86400)::int AS days_since_signup_event
    FROM user_events e
    JOIN users u ON u.id = e.user_id
  ),
  user_metrics AS (
    SELECT
      u.id,
      u.created_at AS signup_at,
      FLOOR(EXTRACT(EPOCH FROM (now() - u.created_at)) / 86400)::int AS days_since_signup,
      MAX(CASE WHEN e.days_since_signup_event >= 1 AND e.days_since_signup_event < 2 THEN 1 ELSE 0 END) AS retained_day1,
      MAX(CASE WHEN e.days_since_signup_event >= 1 AND e.days_since_signup_event <= 7 THEN 1 ELSE 0 END) AS retained_day7,
      MAX(CASE WHEN e.days_since_signup_event >= 1 AND e.days_since_signup_event <= 30 THEN 1 ELSE 0 END) AS retained_day30,
      MIN(CASE WHEN e.event_type = 'cook_complete' THEN e.created_at END) AS first_cook_at
    FROM users u
    LEFT JOIN events_with_day e ON e.user_id = u.id
    GROUP BY u.id, u.created_at
  ),
  retention AS (
    SELECT
      SUM(CASE WHEN days_since_signup >= 1 THEN 1 ELSE 0 END)::int AS day1_eligible,
      SUM(CASE WHEN days_since_signup >= 1 AND retained_day1 = 1 THEN 1 ELSE 0 END)::int AS day1_retained,
      SUM(CASE WHEN days_since_signup >= 7 THEN 1 ELSE 0 END)::int AS day7_eligible,
      SUM(CASE WHEN days_since_signup >= 7 AND retained_day7 = 1 THEN 1 ELSE 0 END)::int AS day7_retained,
      SUM(CASE WHEN days_since_signup >= 30 THEN 1 ELSE 0 END)::int AS day30_eligible,
      SUM(CASE WHEN days_since_signup >= 30 AND retained_day30 = 1 THEN 1 ELSE 0 END)::int AS day30_retained,
      AVG(CASE
        WHEN first_cook_at IS NOT NULL THEN FLOOR(EXTRACT(EPOCH FROM (first_cook_at - signup_at)) / 86400)::numeric
        ELSE NULL
      END) AS avg_time_to_first_cook
    FROM user_metrics
  ),
  weekly AS (
    SELECT
      COUNT(*)::int AS total_completes,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM user_events
    WHERE event_type = 'cook_complete'
      AND created_at >= now() - interval '7 days'
  )
  SELECT jsonb_build_object(
    'day1Retention', CASE WHEN day1_eligible > 0 THEN day1_retained::numeric / day1_eligible::numeric * 100 ELSE 0 END,
    'day7Retention', CASE WHEN day7_eligible > 0 THEN day7_retained::numeric / day7_eligible::numeric * 100 ELSE 0 END,
    'day30Retention', CASE WHEN day30_eligible > 0 THEN day30_retained::numeric / day30_eligible::numeric * 100 ELSE 0 END,
    'avgTimeToFirstCook', avg_time_to_first_cook,
    'weeklyCookRate', CASE WHEN active_users > 0 THEN total_completes::numeric / active_users::numeric ELSE 0 END
  )
  INTO result
  FROM retention, weekly;

  RETURN result;
END;
$$;

-- ============================================================
-- 9. admin_recipe_generation(timeframe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_recipe_generation(
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

  WITH generation_events AS (
    SELECT
      CASE
        WHEN LOWER(COALESCE(payload->>'success', 'false')) IN ('true', 'false')
          THEN (payload->>'success')::boolean
        ELSE false
      END AS success,
      NULLIF(payload->>'duration_ms', '')::numeric AS duration_ms
    FROM user_events
    WHERE event_type = 'recipe_generate'
      AND (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
  ),
  summary AS (
    SELECT
      COUNT(*)::int AS total_generated,
      COUNT(*) FILTER (WHERE success = false)::int AS total_failed,
      AVG(duration_ms) AS avg_duration_ms
    FROM generation_events
  )
  SELECT jsonb_build_object(
    'totalGenerated', total_generated,
    'totalFailed', total_failed,
    'successRate', CASE
      WHEN total_generated > 0 THEN (total_generated - total_failed)::numeric / total_generated::numeric * 100
      ELSE 0
    END,
    'avgDurationMs', avg_duration_ms
  )
  INTO result
  FROM summary;

  RETURN result;
END;
$$;
