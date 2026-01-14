-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- voice_usage table
CREATE TABLE IF NOT EXISTS voice_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  month TEXT NOT NULL, -- Format: "YYYY-MM"
  minutes_used DECIMAL(10, 2) DEFAULT 0,
  conversations_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- voice_sessions table
CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL, -- 'active', 'completed', 'error'
  duration_seconds DECIMAL(10, 2),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update usage after session
CREATE OR REPLACE FUNCTION update_voice_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds IS NOT NULL THEN
    INSERT INTO voice_usage (user_id, month, minutes_used, conversations_count)
    VALUES (
      NEW.user_id,
      TO_CHAR(NEW.started_at, 'YYYY-MM'),
      NEW.duration_seconds / 60.0,
      1
    )
    ON CONFLICT (user_id, month)
    DO UPDATE SET
      minutes_used = voice_usage.minutes_used + (NEW.duration_seconds / 60.0),
      conversations_count = voice_usage.conversations_count + 1,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update usage
DROP TRIGGER IF EXISTS voice_session_completed ON voice_sessions;
CREATE TRIGGER voice_session_completed
AFTER UPDATE ON voice_sessions
FOR EACH ROW
WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
EXECUTE FUNCTION update_voice_usage();
