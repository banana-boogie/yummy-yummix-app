-- Migration: Backfill the `categories` column on `recipe_tags`
--
-- The column already exists in the production cloud schema (and is read by
-- `search-recipes.ts`, `hybrid-search.ts`, and now `candidate-retrieval.ts`
-- via the `recipe_to_tag(recipe_tags(categories, ...))` embedded select),
-- but it predates the committed migration history and was never included in
-- a local migration. Anyone running `supabase db reset` against a fresh
-- database hits a planner that throws "column categories does not exist"
-- on every `generate_plan` call.
--
-- `ADD COLUMN IF NOT EXISTS` makes this safe against both:
--   - a fresh local DB that's never seen the column (column gets created)
--   - the production cloud DB where the column already exists (no-op)
--
-- Date: 2026-04-15
-- Depends on: base recipe_tags table (remote schema)

ALTER TABLE public.recipe_tags
    ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';
