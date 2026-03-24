-- Add explicit timer_seconds field to recipe steps.
-- Used for non-Thermomix steps that have a specific time duration
-- (e.g. "let dough rise 30 min" → 1800).
-- Thermomix steps use thermomix_time instead — never set both.

ALTER TABLE recipe_steps ADD COLUMN timer_seconds integer;
ALTER TABLE user_recipe_steps ADD COLUMN timer_seconds integer;
