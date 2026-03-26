-- Ensure admin_set_membership_tier is NOT callable via PostgREST API.
-- Only Dashboard SQL Editor and service_role should be able to call it.
REVOKE ALL ON FUNCTION public.admin_set_membership_tier(UUID, TEXT) FROM anon, authenticated;
