-- Migration: Add `setup_completed_at` to `user_meal_planning_preferences`
--
-- The frontend "first time setup" flag was stuck because the client had no
-- server-side signal for whether the user has completed setup. Adding a
-- nullable timestamp lets the client distinguish "never completed setup"
-- (null) from "completed at <time>" without an extra schema or RPC.
--
-- Semantics:
--   - First successful `update_preferences` call sets the column to now().
--   - Subsequent calls leave the column unchanged (first save wins).
--   - Existing rows are backfilled to `now()` because anyone who already
--     has a preferences row necessarily completed setup at least once.
--   - The `get_preferences` and `update_preferences` responses surface the
--     value as `setupCompletedAt` (camelCase ISO string, or null).
--
-- Date: 2026-04-29
-- Depends on: 20260410000001_add_meal_plans.sql (table created here)

ALTER TABLE public.user_meal_planning_preferences
    ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz NULL;

-- Backfill: any user with an existing preferences row has, by definition,
-- already completed setup. Stamp them so the client doesn't show the
-- onboarding flow again on next launch.
UPDATE public.user_meal_planning_preferences
SET setup_completed_at = COALESCE(updated_at, created_at, now())
WHERE setup_completed_at IS NULL;
