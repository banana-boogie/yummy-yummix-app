-- Fix ai_cost_summary to include voice-only months and lock down access.

-- ============================================================
-- 1. Correct month coverage in ai_cost_summary
-- ============================================================
-- Build a unified set of (user_id, month) keys from both text and voice usage
-- so months with only voice or only text activity are included.

CREATE OR REPLACE VIEW public.ai_cost_summary AS
WITH monthly_usage AS (
  SELECT user_id, month
  FROM public.ai_budget_usage
  UNION
  SELECT user_id, month
  FROM public.ai_voice_usage
)
SELECT
  u.id AS user_id,
  u.email,
  mu.month,
  COALESCE(t.total_cost_usd, 0) AS text_cost_usd,
  COALESCE(t.request_count, 0) AS text_requests,
  COALESCE(v.total_cost_usd, 0) AS voice_cost_usd,
  COALESCE(v.minutes_used, 0) AS voice_minutes,
  COALESCE(v.conversations_count, 0) AS voice_conversations,
  COALESCE(t.total_cost_usd, 0) + COALESCE(v.total_cost_usd, 0) AS total_cost_usd,
  p.membership_tier
FROM monthly_usage mu
INNER JOIN auth.users u ON u.id = mu.user_id
INNER JOIN public.user_profiles p ON p.id = mu.user_id
LEFT JOIN public.ai_budget_usage t
  ON t.user_id = mu.user_id
 AND t.month = mu.month
LEFT JOIN public.ai_voice_usage v
  ON v.user_id = mu.user_id
 AND v.month = mu.month;

-- ============================================================
-- 2. Explicit privilege hardening
-- ============================================================
-- This view includes user email and spend data, so it should only be readable
-- by service_role paths.

REVOKE ALL ON TABLE public.ai_cost_summary FROM PUBLIC;
REVOKE SELECT ON TABLE public.ai_cost_summary FROM anon, authenticated;
GRANT SELECT ON TABLE public.ai_cost_summary TO service_role;
