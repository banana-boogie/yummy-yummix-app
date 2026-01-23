-- Fix token columns to separate input/output for accurate pricing
-- This migration fixes the columns added in 20260115000000

-- Drop the incorrectly structured columns
ALTER TABLE ai_voice_sessions
DROP COLUMN IF EXISTS text_tokens,
DROP COLUMN IF EXISTS audio_tokens;

-- Add the correctly separated columns
ALTER TABLE ai_voice_sessions
ADD COLUMN IF NOT EXISTS input_text_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS input_audio_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_text_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_audio_tokens INTEGER DEFAULT 0;

-- Add comment explaining the pricing structure
COMMENT ON COLUMN ai_voice_sessions.input_text_tokens IS 'Text input tokens - priced at $0.60 per 1M tokens';
COMMENT ON COLUMN ai_voice_sessions.input_audio_tokens IS 'Audio input tokens - priced at $10 per 1M tokens';
COMMENT ON COLUMN ai_voice_sessions.output_text_tokens IS 'Text output tokens - priced at $2.40 per 1M tokens';
COMMENT ON COLUMN ai_voice_sessions.output_audio_tokens IS 'Audio output tokens - priced at $20 per 1M tokens';
