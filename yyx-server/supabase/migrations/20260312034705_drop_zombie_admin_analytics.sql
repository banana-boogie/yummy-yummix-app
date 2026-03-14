-- Drop the legacy admin_analytics dispatcher function.
-- It was recreated in 20260312010000 but is no longer called —
-- the frontend now uses individual RPCs (admin_overview, admin_funnel, etc.).
DROP FUNCTION IF EXISTS public.admin_analytics(text, text, int);
