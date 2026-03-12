-- Drop legacy admin analytics functions that have been replaced by dedicated RPCs.
-- admin_analytics() was the original monolithic dispatcher; all actions are now separate functions.
-- admin_patterns() is unused in the current UI.

DROP FUNCTION IF EXISTS public.admin_analytics(text, text, integer);
DROP FUNCTION IF EXISTS public.admin_patterns();
