ALTER TABLE public.user_chat_sessions
  DROP CONSTRAINT IF EXISTS user_chat_sessions_source_check;

ALTER TABLE public.user_chat_sessions
  ADD CONSTRAINT user_chat_sessions_source_check
    CHECK (source IN ('text', 'voice'));
