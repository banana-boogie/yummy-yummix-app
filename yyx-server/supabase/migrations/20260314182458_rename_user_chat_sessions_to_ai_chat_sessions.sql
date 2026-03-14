-- Rename user_chat_sessions → ai_chat_sessions
-- The table stores AI chat sessions, not generic user sessions.

-- 1. Rename the table
ALTER TABLE public.user_chat_sessions RENAME TO ai_chat_sessions;

-- 2. Rename indexes
ALTER INDEX IF EXISTS idx_user_chat_sessions_user_id
  RENAME TO idx_ai_chat_sessions_user_id;

ALTER INDEX IF EXISTS idx_user_chat_sessions_source
  RENAME TO idx_ai_chat_sessions_source;

-- 3. Rename constraints
ALTER TABLE public.ai_chat_sessions
  RENAME CONSTRAINT user_chat_sessions_source_check
  TO ai_chat_sessions_source_check;

-- 4. Rename RLS policy
ALTER POLICY "user_chat_sessions_user_policy"
  ON public.ai_chat_sessions
  RENAME TO "ai_chat_sessions_user_policy";

-- 5. Update RPC functions that reference the old table name
-- These are CREATE OR REPLACE so they overwrite the existing functions.

-- admin_ai_usage
CREATE OR REPLACE FUNCTION public.admin_ai_usage(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'totalSessions', (
      SELECT COUNT(*)::int FROM ai_chat_sessions
      WHERE created_at >= p_start_date AND created_at < p_end_date + 1
    ),
    'uniqueUsers', (
      SELECT COUNT(DISTINCT user_id)::int
      FROM ai_chat_sessions
      WHERE created_at >= p_start_date AND created_at < p_end_date + 1
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- admin_daily_ai_users
CREATE OR REPLACE FUNCTION public.admin_daily_ai_users(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (day DATE, ai_chat_users BIGINT, ai_voice_users BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS d
  ),
  chat AS (
    SELECT created_at::date AS d, COUNT(DISTINCT user_id) AS cnt
    FROM ai_chat_sessions
    WHERE created_at >= p_start_date AND created_at < p_end_date + 1
    GROUP BY 1
  ),
  voice AS (
    SELECT created_at::date AS d, COUNT(DISTINCT user_id) AS cnt
    FROM ai_voice_sessions
    WHERE created_at >= p_start_date AND created_at < p_end_date + 1
    GROUP BY 1
  )
  SELECT days.d AS day,
         COALESCE(chat.cnt, 0) AS ai_chat_users,
         COALESCE(voice.cnt, 0) AS ai_voice_users
  FROM days
  LEFT JOIN chat ON chat.d = days.d
  LEFT JOIN voice ON voice.d = days.d
  ORDER BY days.d;
END;
$$;

-- admin_ai_chat_session_depth
CREATE OR REPLACE FUNCTION public.admin_ai_chat_session_depth(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  session_id UUID,
  display_name TEXT,
  message_count BIGINT,
  session_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS session_id,
    COALESCE(p.display_name, u.email, 'Unknown') AS display_name,
    COUNT(m.id) AS message_count,
    s.created_at AS session_date
  FROM ai_chat_sessions s
  JOIN user_chat_messages m ON m.session_id = s.id
  LEFT JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.user_profiles p ON p.user_id = s.user_id
  WHERE s.created_at >= p_start_date
    AND s.created_at < p_end_date + 1
  GROUP BY s.id, p.display_name, u.email, s.created_at
  ORDER BY COUNT(m.id) DESC
  LIMIT 100;
END;
$$;

-- admin_overview (update the ai_sessions subquery)
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'totalUsers', (SELECT COUNT(*)::int FROM auth.users),
    'totalRecipes', (SELECT COUNT(*)::int FROM recipes),
    'aiSessions', (SELECT COUNT(*)::int FROM ai_chat_sessions),
    'totalCookingSessions', (SELECT COUNT(*)::int FROM cooking_sessions)
  ) INTO result;

  RETURN result;
END;
$$;

-- Update user_chat_messages RLS policy that references old table
DROP POLICY IF EXISTS "user_chat_messages_user_policy" ON public.user_chat_messages;
CREATE POLICY "user_chat_messages_user_policy"
ON public.user_chat_messages FOR ALL
USING (
  session_id IN (
    SELECT id FROM ai_chat_sessions
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  session_id IN (
    SELECT id FROM ai_chat_sessions
    WHERE user_id = auth.uid()
  )
);
