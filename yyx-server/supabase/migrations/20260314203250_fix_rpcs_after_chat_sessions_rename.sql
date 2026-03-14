-- Fix RPC function bodies that still reference the old table name user_chat_sessions.
-- PostgreSQL plpgsql stores function bodies as text; after ALTER TABLE RENAME,
-- cached plans work via OID but re-compilation from text fails on the old name.
-- This migration recreates the 4 affected functions with ai_chat_sessions.

-- 1. admin_analytics (legacy monolith RPC)
CREATE OR REPLACE FUNCTION admin_analytics(action text, timeframe text DEFAULT '7d', "limit" int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  tf interval;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  tf := CASE timeframe
    WHEN '24h' THEN interval '24 hours'
    WHEN '7d' THEN interval '7 days'
    WHEN '30d' THEN interval '30 days'
    WHEN '90d' THEN interval '90 days'
    WHEN 'all' THEN interval '100 years'
    ELSE interval '7 days'
  END;

  IF action = 'overview' THEN
    WITH user_counts AS (
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_users,
        COUNT(*) FILTER (WHERE onboarding_complete = true)::int AS onboarded_users
      FROM user_profiles
    ),
    recipe_counts AS (
      SELECT
        COUNT(*)::int AS total_recipes,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_recipes
      FROM recipes
    ),
    session_counts AS (
      SELECT
        COUNT(*)::int AS total_sessions,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_sessions,
        COUNT(DISTINCT user_id) FILTER (WHERE created_at > now() - tf)::int AS active_users
      FROM ai_chat_sessions
    ),
    message_counts AS (
      SELECT
        COUNT(*)::int AS total_messages,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_messages
      FROM user_chat_messages
    )
    SELECT jsonb_build_object(
      'totalUsers', (SELECT total_users FROM user_counts),
      'newUsers', (SELECT new_users FROM user_counts),
      'onboardedUsers', (SELECT onboarded_users FROM user_counts),
      'totalRecipes', (SELECT total_recipes FROM recipe_counts),
      'newRecipes', (SELECT new_recipes FROM recipe_counts),
      'totalSessions', (SELECT total_sessions FROM session_counts),
      'newSessions', (SELECT new_sessions FROM session_counts),
      'activeUsers', (SELECT active_users FROM session_counts),
      'totalMessages', (SELECT total_messages FROM message_counts),
      'newMessages', (SELECT new_messages FROM message_counts)
    )
    INTO result;

  ELSIF action = 'engagement' THEN
    WITH active_users AS (
      SELECT jsonb_agg(jsonb_build_object(
        'name', up.name,
        'email', up.email,
        'messageCount', mc.msg_count,
        'sessionCount', mc.sess_count
      ) ORDER BY mc.msg_count DESC) AS data
      FROM (
        SELECT
          m.user_id,
          COUNT(*)::int AS msg_count,
          COUNT(DISTINCT m.session_id)::int AS sess_count
        FROM user_chat_messages m
        JOIN ai_chat_sessions s ON s.id = m.session_id
        WHERE m.created_at > now() - tf
        AND m.role = 'user'
        GROUP BY m.user_id
        ORDER BY msg_count DESC
        LIMIT "limit"
      ) mc
      JOIN user_profiles up ON up.id = mc.user_id
    )
    SELECT jsonb_build_object(
      'topRecipes', '[]'::jsonb,
      'activeUsers', COALESCE((SELECT data FROM active_users), '[]'::jsonb)
    )
    INTO result;

  ELSIF action = 'patterns' THEN
    WITH chat_by_hour AS (
      SELECT jsonb_agg(jsonb_build_object(
        'hour', hour,
        'count', count
      ) ORDER BY hour) AS data
      FROM (
        SELECT hours.hour, COALESCE(counts.count, 0)::int AS count
        FROM generate_series(0, 23) AS hours(hour)
        LEFT JOIN (
          SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
          FROM ai_chat_sessions
          WHERE created_at > now() - tf
          GROUP BY 1
        ) counts ON counts.hour = hours.hour
      ) hourly
    ),
    language_split AS (
      SELECT jsonb_agg(jsonb_build_object(
        'language', locale,
        'count', count
      ) ORDER BY count DESC) AS data
      FROM (
        SELECT COALESCE(locale, 'en') AS locale, COUNT(*)::int AS count
        FROM user_profiles
        GROUP BY 1
      ) langs
    )
    SELECT jsonb_build_object(
      'cookingByHour', COALESCE((SELECT data FROM chat_by_hour), '[]'::jsonb),
      'languageSplit', COALESCE((SELECT data FROM language_split), '[]'::jsonb)
    )
    INTO result;

  ELSE
    result := null;
  END IF;

  RETURN result;
END;
$$;

-- 2. admin_ai_chat_session_depth
CREATE OR REPLACE FUNCTION public.admin_ai_chat_session_depth(
  timeframe text DEFAULT '7_days'::text,
  filter_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  WITH session_stats AS (
    SELECT
      s.id AS session_id,
      s.user_id,
      COUNT(*)::int AS total_messages,
      COUNT(*) FILTER (WHERE m.role = 'user')::int AS user_messages,
      COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS assistant_messages,
      EXTRACT(EPOCH FROM (MAX(m.created_at) - MIN(m.created_at))) / 60.0 AS duration_min,
      COALESCE(BOOL_OR(m.role = 'assistant' AND m.tool_calls IS NOT NULL AND m.tool_calls ? 'recipes'), false) AS has_search,
      COALESCE(BOOL_OR(m.role = 'assistant' AND m.tool_calls IS NOT NULL AND m.tool_calls ? 'customRecipe'), false) AS has_generation
    FROM ai_chat_sessions s
    JOIN user_chat_messages m ON m.session_id = s.id
    WHERE (start_ts IS NULL OR s.created_at >= start_ts)
      AND s.created_at <= end_ts
      AND (filter_user_id IS NULL OR s.user_id = filter_user_id)
    GROUP BY s.id, s.user_id
    HAVING COUNT(*) >= 2
  ),
  top_users AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'userId', ranked.user_id,
        'displayName', COALESCE(up.name, up.email, 'Unknown'),
        'sessions', ranked.sessions,
        'totalMessages', ranked.total_msgs,
        'avgMessages', ranked.avg_msgs
      )
      ORDER BY ranked.sessions DESC, ranked.total_msgs DESC
    ), '[]'::jsonb) AS data
    FROM (
      SELECT
        user_id,
        COUNT(*)::int AS sessions,
        SUM(total_messages)::int AS total_msgs,
        ROUND(AVG(total_messages)::numeric, 1) AS avg_msgs
      FROM session_stats
      GROUP BY user_id
      ORDER BY sessions DESC, total_msgs DESC
      LIMIT 10
    ) ranked
    LEFT JOIN public.user_profiles up ON up.id = ranked.user_id
  ),
  daily_sessions AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('date', day, 'sessions', cnt)
      ORDER BY day ASC
    ), '[]'::jsonb) AS data
    FROM (
      SELECT
        date_trunc('day', s.created_at)::date AS day,
        COUNT(*)::int AS cnt
      FROM ai_chat_sessions s
      JOIN (SELECT DISTINCT session_id FROM session_stats) ss ON ss.session_id = s.id
      GROUP BY 1
    ) grouped
  )
  SELECT jsonb_build_object(
    'avgMessagesPerSession', COALESCE(ROUND(AVG(total_messages)::numeric, 1), 0),
    'avgUserMessagesPerSession', COALESCE(ROUND(AVG(user_messages)::numeric, 1), 0),
    'avgAssistantMessagesPerSession', COALESCE(ROUND(AVG(assistant_messages)::numeric, 1), 0),
    'avgSessionDurationMin', COALESCE(ROUND(AVG(duration_min)::numeric, 1), 0),
    'totalSessions', COUNT(*)::int,
    'messageDistribution', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', cnt) ORDER BY sort_order), '[]'::jsonb)
      FROM (
        SELECT '2-4' AS bucket, COUNT(*) FILTER (WHERE total_messages BETWEEN 2 AND 4)::int AS cnt, 1 AS sort_order FROM session_stats
        UNION ALL
        SELECT '5-10', COUNT(*) FILTER (WHERE total_messages BETWEEN 5 AND 10)::int, 2 FROM session_stats
        UNION ALL
        SELECT '11-20', COUNT(*) FILTER (WHERE total_messages BETWEEN 11 AND 20)::int, 3 FROM session_stats
        UNION ALL
        SELECT '21+', COUNT(*) FILTER (WHERE total_messages > 20)::int, 4 FROM session_stats
      ) buckets
    ),
    'toolUsage', jsonb_build_object(
      'withSearch', COUNT(*) FILTER (WHERE has_search AND NOT has_generation)::int,
      'withGeneration', COUNT(*) FILTER (WHERE has_generation AND NOT has_search)::int,
      'withBoth', COUNT(*) FILTER (WHERE has_search AND has_generation)::int,
      'chatOnly', COUNT(*) FILTER (WHERE NOT has_search AND NOT has_generation)::int
    ),
    'sessionsExceedingWindow', COUNT(*) FILTER (WHERE total_messages > 50)::int,
    'topUsers', (SELECT data FROM top_users),
    'dailySessions', (SELECT data FROM daily_sessions)
  )
  INTO result
  FROM session_stats;

  RETURN result;
END;
$function$;

-- 3. admin_daily_ai_users
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
      FROM ai_chat_sessions
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

-- 4. admin_ai_adoption
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
    FROM ai_chat_sessions
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
    FROM ai_chat_sessions
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
