-- Migration: Add AI User Data Tables
-- Description: Creates tables for user personalization, chat history, and personal recipes

-- ==================================================
-- 1. User Context (Preferences & Equipment)
-- ==================================================
CREATE TABLE IF NOT EXISTS user_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Household info
    household_size INTEGER DEFAULT 1,
    skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
    
    -- Equipment (what they own)
    kitchen_equipment TEXT[] DEFAULT '{}',
    
    -- Dietary info
    dietary_restrictions TEXT[] DEFAULT '{}',
    ingredient_dislikes TEXT[] DEFAULT '{}',
    
    -- AI-generated taste profile (updated by background jobs)
    taste_profile JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- ==================================================
-- 2. User Events (Activity Log for Learning)
-- ==================================================
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL CHECK (event_type IN (
        'view_recipe', 
        'cook_start', 
        'cook_complete', 
        'rate_recipe',
        'search',
        'chat_message',
        'save_recipe'
    )),
    
    -- Flexible payload for event-specific data
    payload JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient user activity queries
CREATE INDEX IF NOT EXISTS idx_user_events_user_created 
    ON user_events(user_id, created_at DESC);

-- ==================================================
-- 3. Chat Sessions & Messages
-- ==================================================
CREATE TABLE IF NOT EXISTS user_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    title TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES user_chat_sessions(id) ON DELETE CASCADE,
    
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- For tool calls
    tool_calls JSONB,
    tool_call_id TEXT,
    
    -- Token usage tracking
    input_tokens INTEGER,
    output_tokens INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient message retrieval
CREATE INDEX IF NOT EXISTS idx_chat_messages_session 
    ON user_chat_messages(session_id, created_at ASC);

-- ==================================================
-- 4. User Personal Recipes (AI-Generated Variations)
-- ==================================================
CREATE TABLE IF NOT EXISTS user_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Optional link to original recipe
    original_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    
    -- Recipe data (similar structure to main recipes)
    name TEXT NOT NULL,
    description TEXT,
    
    -- Full recipe content as JSON
    recipe_data JSONB NOT NULL,
    
    -- How it was created
    source TEXT CHECK (source IN ('ai_generated', 'ai_modified', 'user_created')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's personal recipes
CREATE INDEX IF NOT EXISTS idx_user_recipes_user 
    ON user_recipes(user_id, created_at DESC);

-- ==================================================
-- Row Level Security Policies
-- ==================================================

-- Enable RLS on all tables
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY user_context_user_policy ON user_context
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY user_events_user_policy ON user_events
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY user_chat_sessions_user_policy ON user_chat_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY user_chat_messages_user_policy ON user_chat_messages
    FOR ALL USING (
        session_id IN (
            SELECT id FROM user_chat_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY user_recipes_user_policy ON user_recipes
    FOR ALL USING (auth.uid() = user_id);

-- ==================================================
-- Updated At Triggers
-- ==================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_context_updated_at
    BEFORE UPDATE ON user_context
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_chat_sessions_updated_at
    BEFORE UPDATE ON user_chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_recipes_updated_at
    BEFORE UPDATE ON user_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
