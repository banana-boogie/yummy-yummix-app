-- Migration: SUPERSEDED stop-gap backfill of `recipe_tags.categories`.
--
-- This migration is kept in the repo for cloud-history continuity (it was
-- applied to production on 2026-04-25 via `supabase db push`) but its work
-- has been superseded by 20260415000000_ensure_recipe_tags_categories_column.sql,
-- which runs BEFORE the seed migration that needs the column AND uses the
-- correct enum-array type (`public.recipe_tag_category[]`) to match the seed's
-- `array_append(categories, 'MEAL_TYPE'::public.recipe_tag_category)` call.
--
-- The original problem: `categories` was added to production manually outside
-- the migration history. A fresh `supabase db reset` would fail at the seed
-- migration. This file's TEXT[] declaration was a stop-gap, but it ran AFTER
-- the seed (timestamp ordering) so it never actually fixed the reset path.
--
-- The replacement migration is now responsible for creating the enum, creating
-- the column, or upgrading this stop-gap TEXT[] column to the enum-array shape.
-- This file remains an `IF NOT EXISTS` no-op after that repair has run.
--
-- Date: 2026-04-15 (originally) / superseded note added 2026-04-25

ALTER TABLE public.recipe_tags
    ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';
