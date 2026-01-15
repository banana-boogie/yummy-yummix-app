-- Add token and cost tracking to ai_voice_sessions
-- Separate text/audio by input/output for accurate cost calculation
-- Text pricing: $0.60/1M input, $2.40/1M output
-- Audio pricing: $10/1M input, $20/1M output
ALTER TABLE ai_voice_sessions
ADD COLUMN input_tokens INTEGER DEFAULT 0,
ADD COLUMN output_tokens INTEGER DEFAULT 0,
ADD COLUMN input_text_tokens INTEGER DEFAULT 0,
ADD COLUMN input_audio_tokens INTEGER DEFAULT 0,
ADD COLUMN output_text_tokens INTEGER DEFAULT 0,
ADD COLUMN output_audio_tokens INTEGER DEFAULT 0,
ADD COLUMN cost_usd DECIMAL(10, 6) DEFAULT 0.00;

-- Add cost tracking to ai_voice_usage (monthly aggregation)
ALTER TABLE ai_voice_usage
ADD COLUMN total_cost_usd DECIMAL(10, 2) DEFAULT 0.00;

-- Update the trigger function to include cost aggregation
CREATE OR REPLACE FUNCTION update_ai_voice_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds IS NOT NULL THEN
    INSERT INTO ai_voice_usage (user_id, month, minutes_used, conversations_count, total_cost_usd)
    VALUES (
      NEW.user_id,
      TO_CHAR(NEW.started_at, 'YYYY-MM'),
      NEW.duration_seconds / 60.0,
      1,
      COALESCE(NEW.cost_usd, 0.00)
    )
    ON CONFLICT (user_id, month)
    DO UPDATE SET
      minutes_used = ai_voice_usage.minutes_used + (NEW.duration_seconds / 60.0),
      conversations_count = ai_voice_usage.conversations_count + 1,
      total_cost_usd = ai_voice_usage.total_cost_usd + COALESCE(NEW.cost_usd, 0.00),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
