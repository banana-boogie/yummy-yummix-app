-- Fix admin_set_membership_tier to work from Dashboard SQL Editor.
-- Dashboard has no auth context (auth.uid() = NULL), so we allow
-- calls with no auth context through — the function is SECURITY DEFINER
-- and not exposed via PostgREST (no anon/authenticated grant), so only
-- Dashboard and service_role can reach it.

CREATE OR REPLACE FUNCTION public.admin_set_membership_tier(
  target_user_id UUID,
  new_tier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When called from the app (auth.uid() is set), verify caller is admin.
  -- When called from Dashboard SQL Editor, auth.uid() is NULL — allow through
  -- since Dashboard access is already restricted to project owners.
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can change membership tiers'
      USING ERRCODE = '42501';
  END IF;

  -- Verify the tier is valid
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_membership_tiers WHERE tier = new_tier
  ) THEN
    RAISE EXCEPTION 'Invalid tier: %. Valid tiers: free, premium', new_tier
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_profiles
  SET membership_tier = new_tier
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;
