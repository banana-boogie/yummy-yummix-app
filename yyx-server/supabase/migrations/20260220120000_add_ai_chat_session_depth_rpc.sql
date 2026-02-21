-- AI Chat Session Depth analytics RPC
-- Provides conversation depth metrics for the admin dashboard AI tab:
-- session averages, message distribution, tool usage, daily trend, top users

CREATE OR REPLACE FUNCTION public.admin_ai_chat_session_depth(
  timeframe text DEFAULT '7_days',
  filter_user_id uuid DEFAULT NULL
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

  WITH session_stats AS (
    SELECT
      s.id AS session_id,
      s.user_id,
      COUNT(*)::int AS total_messages,
      COUNT(*) FILTER (WHERE m.role = 'user')::int AS user_messages,
      COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS assistant_messages,
      EXTRACT(EPOCH FROM (MAX(m.created_at) - MIN(m.created_at))) / 60.0 AS duration_min,
      -- Tool detection: only check assistant rows, NULL-safe
      COALESCE(BOOL_OR(m.role = 'assistant' AND m.tool_calls ? 'recipes'), false) AS has_search,
      COALESCE(BOOL_OR(m.role = 'assistant' AND m.tool_calls ? 'customRecipe'), false) AS has_generation
    FROM user_chat_sessions s
    JOIN user_chat_messages m ON m.session_id = s.id
    WHERE (start_ts IS NULL OR s.created_at >= start_ts)
      AND s.created_at <= end_ts
      AND (filter_user_id IS NULL OR s.user_id = filter_user_id)
    GROUP BY s.id, s.user_id
    HAVING COUNT(*) >= 2  -- Exclude abandoned single-message sessions
  ),
  top_users AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'sessions', sessions,
        'totalMessages', total_msgs,
        'avgMessages', avg_msgs
      )
      ORDER BY sessions DESC, total_msgs DESC
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
      FROM user_chat_sessions s
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
$$;
