-- Cleanup legacy voice-provider-specific fields.
--
-- Legacy provider-specific voice paths are no longer used.
-- Keep core voice quota/session tracking for OpenAI Realtime.

-- 1) Simplify usage aggregation trigger function to provider-agnostic totals.
CREATE OR REPLACE FUNCTION public.update_ai_voice_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds IS NOT NULL THEN
    INSERT INTO ai_voice_usage (
      user_id,
      month,
      minutes_used,
      conversations_count,
      total_cost_usd
    )
    VALUES (
      NEW.user_id,
      TO_CHAR(NEW.started_at, 'YYYY-MM'),
      NEW.duration_seconds / 60.0,
      1,
      COALESCE(NEW.cost_usd, 0.00)
    )
    ON CONFLICT (user_id, month) DO UPDATE SET
      minutes_used = ai_voice_usage.minutes_used + (NEW.duration_seconds / 60.0),
      conversations_count = ai_voice_usage.conversations_count + 1,
      total_cost_usd = ai_voice_usage.total_cost_usd + COALESCE(NEW.cost_usd, 0.00),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Drop legacy per-provider/cost-breakdown fields written only by deprecated providers.
ALTER TABLE public.ai_voice_sessions
  DROP COLUMN IF EXISTS stt_cost_usd,
  DROP COLUMN IF EXISTS llm_cost_usd,
  DROP COLUMN IF EXISTS tts_cost_usd,
  DROP COLUMN IF EXISTS llm_tokens_input,
  DROP COLUMN IF EXISTS llm_tokens_output,
  DROP COLUMN IF EXISTS tts_characters;

ALTER TABLE public.ai_voice_usage
  DROP COLUMN IF EXISTS openai_minutes,
  DROP COLUMN IF EXISTS openai_cost,
  DROP COLUMN IF EXISTS hts_minutes,
  DROP COLUMN IF EXISTS hts_cost;
