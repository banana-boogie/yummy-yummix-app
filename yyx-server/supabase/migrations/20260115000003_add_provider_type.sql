-- Add provider type tracking and cost breakdown for voice providers
-- OpenAI Realtime (premium) vs HearThinkSpeak (standard)

-- Add provider_type column
ALTER TABLE ai_voice_sessions
ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'openai-realtime';

-- Add HearThinkSpeak cost breakdown columns
ALTER TABLE ai_voice_sessions
ADD COLUMN stt_cost_usd DECIMAL(10, 6) DEFAULT 0.00,
ADD COLUMN llm_cost_usd DECIMAL(10, 6) DEFAULT 0.00,
ADD COLUMN tts_cost_usd DECIMAL(10, 6) DEFAULT 0.00,
ADD COLUMN llm_tokens_input INTEGER DEFAULT 0,
ADD COLUMN llm_tokens_output INTEGER DEFAULT 0,
ADD COLUMN tts_characters INTEGER DEFAULT 0;

-- Add provider-specific aggregation to ai_voice_usage
ALTER TABLE ai_voice_usage
ADD COLUMN openai_minutes DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN openai_cost DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN hts_minutes DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN hts_cost DECIMAL(10, 2) DEFAULT 0.00;

-- Update the trigger function to include provider-specific aggregation
CREATE OR REPLACE FUNCTION update_ai_voice_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds IS NOT NULL THEN
    INSERT INTO ai_voice_usage (
      user_id,
      month,
      minutes_used,
      conversations_count,
      total_cost_usd,
      openai_minutes,
      openai_cost,
      hts_minutes,
      hts_cost
    )
    VALUES (
      NEW.user_id,
      TO_CHAR(NEW.started_at, 'YYYY-MM'),
      NEW.duration_seconds / 60.0,
      1,
      COALESCE(NEW.cost_usd, 0.00),
      CASE WHEN NEW.provider_type = 'openai-realtime' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      CASE WHEN NEW.provider_type = 'openai-realtime' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END,
      CASE WHEN NEW.provider_type = 'hear-think-speak' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      CASE WHEN NEW.provider_type = 'hear-think-speak' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END
    )
    ON CONFLICT (user_id, month) DO UPDATE SET
      minutes_used = ai_voice_usage.minutes_used + (NEW.duration_seconds / 60.0),
      conversations_count = ai_voice_usage.conversations_count + 1,
      total_cost_usd = ai_voice_usage.total_cost_usd + COALESCE(NEW.cost_usd, 0.00),
      openai_minutes = ai_voice_usage.openai_minutes + CASE WHEN NEW.provider_type = 'openai-realtime' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      openai_cost = ai_voice_usage.openai_cost + CASE WHEN NEW.provider_type = 'openai-realtime' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END,
      hts_minutes = ai_voice_usage.hts_minutes + CASE WHEN NEW.provider_type = 'hear-think-speak' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      hts_cost = ai_voice_usage.hts_cost + CASE WHEN NEW.provider_type = 'hear-think-speak' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comments explaining the provider types
COMMENT ON COLUMN ai_voice_sessions.provider_type IS 'Voice provider: openai-realtime (premium) or hear-think-speak (standard)';
COMMENT ON COLUMN ai_voice_sessions.stt_cost_usd IS 'Speech-to-text cost (HearThinkSpeak only)';
COMMENT ON COLUMN ai_voice_sessions.llm_cost_usd IS 'LLM inference cost (HearThinkSpeak only)';
COMMENT ON COLUMN ai_voice_sessions.tts_cost_usd IS 'Text-to-speech cost (HearThinkSpeak only)';
