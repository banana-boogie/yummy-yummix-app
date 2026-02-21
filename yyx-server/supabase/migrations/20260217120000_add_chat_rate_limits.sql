-- Chat request rate limiting (per-user, per-minute)

CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_chat_rate_limits_window_start
  ON public.chat_rate_limits(window_start);

ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat rate limits"
  ON public.chat_rate_limits;
CREATE POLICY "Users can view own chat rate limits"
  ON public.chat_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_and_increment_chat_rate_limit(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (allowed BOOLEAN, retry_after_ms INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ := date_trunc('minute', v_now);
  v_request_count INTEGER;
  v_retry_after_ms INTEGER;
BEGIN
  -- Keep table small with rolling cleanup.
  DELETE FROM public.chat_rate_limits
  WHERE window_start < v_now - INTERVAL '1 hour';

  INSERT INTO public.chat_rate_limits (user_id, window_start, request_count)
  VALUES (p_user_id, v_window_start, 0)
  ON CONFLICT (user_id, window_start) DO NOTHING;

  UPDATE public.chat_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id
    AND window_start = v_window_start
  RETURNING request_count INTO v_request_count;

  IF v_request_count <= p_limit THEN
    RETURN QUERY SELECT TRUE, NULL::INTEGER;
    RETURN;
  END IF;

  v_retry_after_ms := GREATEST(
    1,
    (
      EXTRACT(
        EPOCH FROM ((v_window_start + make_interval(secs => p_window_seconds)) - v_now)
      ) * 1000
    )::INTEGER
  );

  RETURN QUERY SELECT FALSE, v_retry_after_ms;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_chat_rate_limit(UUID, INTEGER, INTEGER)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_chat_rate_limit(UUID, INTEGER, INTEGER)
  TO service_role;
