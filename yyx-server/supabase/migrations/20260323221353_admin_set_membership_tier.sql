-- Admin RPC to update a user's membership tier.
-- Runs as SECURITY DEFINER so it bypasses the trigger's auth checks.
-- Only callable by admin users (enforced inside the function).

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
  -- Verify caller is an admin or running from Dashboard SQL Editor (no auth context).
  -- Dashboard runs as postgres with no auth.uid(), so we allow that.
  -- App clients must be admin users.
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

-- Update trigger to also allow SECURITY DEFINER functions (session_user = 'postgres')
-- so the admin RPC above passes through cleanly.
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

    -- Allow SECURITY DEFINER functions (running as postgres)
    IF session_user = 'postgres' THEN
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
