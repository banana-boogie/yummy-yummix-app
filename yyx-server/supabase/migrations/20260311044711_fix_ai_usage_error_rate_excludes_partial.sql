-- Fix: error rate should only count status = 'error', not 'partial'.
-- 'partial' means the request succeeded but usage telemetry was incomplete
-- (e.g., provider didn't return token counts). Counting partial as errors
-- inflates the dashboard error rate.

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
      COUNT(*) FILTER (WHERE status = 'error')::int AS text_errors
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
          WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE status = 'error')::numeric / COUNT(*)::numeric * 100
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
