-- Enable RLS on ai_voice_sessions and ai_voice_usage
ALTER TABLE ai_voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_voice_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
ON ai_voice_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
ON ai_voice_sessions
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Service role can insert sessions (for backend)
CREATE POLICY "Service role can insert sessions"
ON ai_voice_sessions
FOR INSERT
WITH CHECK (true);

-- Policy: Users can view their own usage
CREATE POLICY "Users can view their own usage"
ON ai_voice_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Allow trigger function to insert/update usage
-- This requires granting INSERT/UPDATE to authenticated users for the trigger to work
CREATE POLICY "Allow usage updates from triggers"
ON ai_voice_usage
FOR ALL
USING (true)
WITH CHECK (true);
