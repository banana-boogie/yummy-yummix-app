-- Fix membership tier trigger to allow admin users, and add unified cost summary view.

-- ============================================================
-- 1. Fix membership tier trigger
-- ============================================================
-- The old trigger only allowed service_role, blocking Dashboard and admin panel updates.
-- New version allows service_role OR admin users (via is_admin flag on user_profiles).

CREATE OR REPLACE FUNCTION public.prevent_client_membership_tier_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier THEN
    -- Allow service_role (edge functions, dashboard SQL editor)
    IF coalesce(auth.role(), '') = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Allow admin users
    IF EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'membership_tier can only be updated by admins'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Admin cost summary view
-- ============================================================
-- Unifies text (ai_budget_usage) + voice (ai_voice_usage) costs per user per month.
-- No RLS — queried by service role only (admin functions).

CREATE OR REPLACE VIEW public.ai_cost_summary AS
SELECT
  u.id AS user_id,
  u.email,
  COALESCE(t.month, v.month) AS month,
  COALESCE(t.total_cost_usd, 0) AS text_cost_usd,
  COALESCE(t.request_count, 0) AS text_requests,
  COALESCE(v.total_cost_usd, 0) AS voice_cost_usd,
  COALESCE(v.minutes_used, 0) AS voice_minutes,
  COALESCE(v.conversations_count, 0) AS voice_conversations,
  COALESCE(t.total_cost_usd, 0) + COALESCE(v.total_cost_usd, 0) AS total_cost_usd,
  p.membership_tier
FROM auth.users u
INNER JOIN public.user_profiles p ON p.id = u.id
LEFT JOIN public.ai_budget_usage t ON t.user_id = u.id
LEFT JOIN public.ai_voice_usage v ON v.user_id = u.id AND v.month = t.month
WHERE t.month IS NOT NULL OR v.month IS NOT NULL;
