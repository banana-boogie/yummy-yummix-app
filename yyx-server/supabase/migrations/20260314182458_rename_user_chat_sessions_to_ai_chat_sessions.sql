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

-- 5. RPC functions do NOT need updating.
-- PostgreSQL ALTER TABLE RENAME updates table references internally via OIDs,
-- so existing functions that query user_chat_sessions will automatically
-- resolve to ai_chat_sessions.

-- 6. Update user_chat_messages RLS policy that references old table name
-- (RLS policies store table names as text in the USING clause, not OIDs,
-- so they DO need updating)
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
