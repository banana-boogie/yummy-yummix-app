-- Drop cooking session progress tracking
-- Cooking progress ("resume from step X") is no longer tracked.
-- Recipe completion analytics are tracked separately via user_events table.

DROP FUNCTION IF EXISTS public.upsert_cooking_session_progress;
DROP TABLE IF EXISTS public.cooking_sessions CASCADE;
