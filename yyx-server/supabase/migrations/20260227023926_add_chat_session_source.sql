-- Add source column to track whether a chat session originated from text or voice

ALTER TABLE public.user_chat_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'text';

ALTER TABLE public.user_chat_sessions
  ADD CONSTRAINT user_chat_sessions_source_check
    CHECK (source IN ('text', 'voice'));

CREATE INDEX IF NOT EXISTS idx_user_chat_sessions_source
  ON public.user_chat_sessions (user_id, source, created_at DESC);
