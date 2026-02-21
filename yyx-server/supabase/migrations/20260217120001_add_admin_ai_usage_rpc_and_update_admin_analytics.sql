-- Add dedicated AI usage/cost RPC and update admin_analytics for timeframe-aware AI adoption.

CREATE OR REPLACE FUNCTION public.admin_analytics(
  action text,
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

  IF action = 'overview' THEN
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
  ELSIF action = 'funnel' THEN
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
  ELSIF action = 'top_viewed_recipes' THEN
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
  ELSIF action = 'top_cooked_recipes' THEN
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
  ELSIF action = 'top_searches' THEN
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
  ELSIF action = 'ai' THEN
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
  ELSIF action = 'patterns' THEN
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
  ELSIF action = 'retention' THEN
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
  ELSIF action = 'recipe_generation' THEN
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
  ELSE
    RAISE EXCEPTION 'Invalid action: %', action;
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ai_usage(
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

  WITH text_usage AS (
    SELECT
      user_id,
      call_phase,
      status,
      model,
      COALESCE(input_tokens, 0) AS input_tokens,
      COALESCE(output_tokens, 0) AS output_tokens,
      COALESCE(estimated_cost_usd, 0)::numeric AS estimated_cost_usd,
      duration_ms,
      created_at
    FROM ai_usage_logs
    WHERE (start_ts IS NULL OR created_at >= start_ts)
      AND created_at <= end_ts
  ),
  voice_usage AS (
    SELECT
      user_id,
      COALESCE(duration_seconds, 0) AS duration_seconds,
      COALESCE(cost_usd, 0)::numeric AS cost_usd,
      COALESCE(completed_at, started_at) AS event_ts
    FROM ai_voice_sessions
    WHERE status = 'completed'
      AND (start_ts IS NULL OR COALESCE(completed_at, started_at) >= start_ts)
      AND COALESCE(completed_at, started_at) <= end_ts
  ),
  unique_users AS (
    SELECT COUNT(DISTINCT user_id)::int AS total
    FROM (
      SELECT user_id FROM text_usage
      UNION ALL
      SELECT user_id FROM voice_usage
    ) all_users
  ),
  text_summary AS (
    SELECT
      COUNT(*)::int AS text_requests,
      SUM(input_tokens + output_tokens)::bigint AS text_tokens,
      SUM(estimated_cost_usd)::numeric AS text_cost_usd,
      AVG(duration_ms)::numeric AS avg_latency_ms,
      COUNT(*) FILTER (WHERE status <> 'success')::int AS text_errors
    FROM text_usage
  ),
  voice_summary AS (
    SELECT
      COUNT(*)::int AS voice_sessions,
      SUM(duration_seconds)::numeric AS voice_seconds,
      SUM(cost_usd)::numeric AS voice_cost_usd
    FROM voice_usage
  ),
  model_breakdown AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'model', model_name,
        'requests', requests,
        'totalTokens', total_tokens,
        'totalCostUsd', total_cost_usd
      )
      ORDER BY total_cost_usd DESC, requests DESC
    ), '[]'::jsonb) AS data
    FROM (
      SELECT
        COALESCE(model, 'unknown') AS model_name,
        COUNT(*)::int AS requests,
        SUM(input_tokens + output_tokens)::bigint AS total_tokens,
        SUM(estimated_cost_usd)::numeric AS total_cost_usd
      FROM text_usage
      GROUP BY 1
    ) grouped
  ),
  phase_breakdown AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'phase', phase,
        'requests', requests,
        'avgTokens', avg_tokens,
        'errorRate', error_rate
      )
      ORDER BY requests DESC
    ), '[]'::jsonb) AS data
    FROM (
      SELECT
        call_phase AS phase,
        COUNT(*)::int AS requests,
        AVG((input_tokens + output_tokens)::numeric) AS avg_tokens,
        CASE
          WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE status <> 'success')::numeric / COUNT(*)::numeric * 100
          ELSE 0
        END AS error_rate
      FROM text_usage
      GROUP BY call_phase
    ) grouped
  ),
  daily_totals AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'date', day,
        'cost', total_cost,
        'requests', total_requests
      )
      ORDER BY day ASC
    ), '[]'::jsonb) AS data
    FROM (
      SELECT
        day,
        SUM(cost)::numeric AS total_cost,
        SUM(requests)::int AS total_requests
      FROM (
        SELECT
          date_trunc('day', created_at)::date AS day,
          SUM(estimated_cost_usd)::numeric AS cost,
          COUNT(*)::int AS requests
        FROM text_usage
        GROUP BY 1

        UNION ALL

        SELECT
          date_trunc('day', event_ts)::date AS day,
          SUM(cost_usd)::numeric AS cost,
          COUNT(*)::int AS requests
        FROM voice_usage
        GROUP BY 1
      ) merged
      GROUP BY day
    ) grouped
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'textRequests', COALESCE((SELECT text_requests FROM text_summary), 0),
      'textTokens', COALESCE((SELECT text_tokens FROM text_summary), 0),
      'textCostUsd', COALESCE((SELECT text_cost_usd FROM text_summary), 0),
      'voiceSessions', COALESCE((SELECT voice_sessions FROM voice_summary), 0),
      'voiceMinutes', ROUND(COALESCE((SELECT voice_seconds FROM voice_summary), 0) / 60.0, 2),
      'voiceCostUsd', COALESCE((SELECT voice_cost_usd FROM voice_summary), 0),
      'totalCostUsd', COALESCE((SELECT text_cost_usd FROM text_summary), 0) + COALESCE((SELECT voice_cost_usd FROM voice_summary), 0),
      'uniqueAiUsers', COALESCE((SELECT total FROM unique_users), 0),
      'avgTokensPerRequest', CASE
        WHEN COALESCE((SELECT text_requests FROM text_summary), 0) > 0
          THEN (SELECT text_tokens FROM text_summary)::numeric / (SELECT text_requests FROM text_summary)::numeric
        ELSE 0
      END,
      'avgCostPerRequest', CASE
        WHEN COALESCE((SELECT text_requests FROM text_summary), 0) > 0
          THEN (SELECT text_cost_usd FROM text_summary)::numeric / (SELECT text_requests FROM text_summary)::numeric
        ELSE 0
      END,
      'avgCostPerUser', CASE
        WHEN COALESCE((SELECT total FROM unique_users), 0) > 0
          THEN (
            COALESCE((SELECT text_cost_usd FROM text_summary), 0) + COALESCE((SELECT voice_cost_usd FROM voice_summary), 0)
          )::numeric / (SELECT total FROM unique_users)::numeric
        ELSE 0
      END,
      'avgLatencyMs', COALESCE((SELECT avg_latency_ms FROM text_summary), 0),
      'errorRate', CASE
        WHEN COALESCE((SELECT text_requests FROM text_summary), 0) > 0
          THEN (SELECT text_errors FROM text_summary)::numeric / (SELECT text_requests FROM text_summary)::numeric * 100
        ELSE 0
      END
    ),
    'modelBreakdown', COALESCE((SELECT data FROM model_breakdown), '[]'::jsonb),
    'dailyCost', COALESCE((SELECT data FROM daily_totals), '[]'::jsonb),
    'phaseBreakdown', COALESCE((SELECT data FROM phase_breakdown), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;
