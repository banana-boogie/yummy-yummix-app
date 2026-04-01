-- Re-grant authenticated access to admin_set_membership_tier so admin users
-- can call it from the app. The function itself enforces the admin check
-- via auth.uid() + is_admin, which is the real security gate.
GRANT EXECUTE ON FUNCTION public.admin_set_membership_tier(UUID, TEXT) TO authenticated;
