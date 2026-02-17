-- Add recipe_name to cooking_sessions for denormalized display
-- Avoids join on every resumable session check in context builder
alter table public.cooking_sessions
add column if not exists recipe_name text;
