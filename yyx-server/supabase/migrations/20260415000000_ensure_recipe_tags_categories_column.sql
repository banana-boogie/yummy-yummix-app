-- Migration: Ensure `recipe_tags.categories` exists BEFORE the meal-type seed
-- migration runs.
--
-- Background: the `categories` column predates the committed migration history.
-- It was created on production manually and has never been declared in any
-- local migration file. Two later migrations on this branch reference it:
--
--   - 20260415000002_seed_meal_type_tags.sql        — does
--     `array_append(categories, 'MEAL_TYPE'::public.recipe_tag_category)`
--   - 20260425000001_backfill_recipe_tags_categories.sql — was a stop-gap
--     that added the column as TEXT[] AFTER the seed already needed it
--
-- A fresh `supabase db reset` would fail at the seed migration because the
-- column doesn't exist yet. This migration creates the column with the
-- correct enum-array type and guards with `IF NOT EXISTS` so it's safe
-- against:
--   - fresh local DBs (creates the column with the right type)
--   - cloud / existing dev DBs where the column already exists (no-op)
--
-- The later 20260425000001 migration is now redundant but kept in the repo
-- for cloud-history continuity (it has already been applied to production
-- via `supabase db push` on 2026-04-25). Both are no-ops in any environment
-- where the column already exists.
--
-- Date: 2026-04-15 (file timestamp chosen to run before the seed at
--                   20260415000002; the actual edit date is 2026-04-25)
-- Depends on: the `public.recipe_tag_category` enum (created outside the
--             local migration history)

ALTER TABLE public.recipe_tags
    ADD COLUMN IF NOT EXISTS categories public.recipe_tag_category[]
    NOT NULL DEFAULT '{}'::public.recipe_tag_category[];
