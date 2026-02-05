-- Add index for analytics queries that filter by event_type and created_at
-- This improves performance for top_viewed_recipes, top_cooked_recipes,
-- top_searches, and cooking patterns queries

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_event_type_created
ON user_events(event_type, created_at DESC);
