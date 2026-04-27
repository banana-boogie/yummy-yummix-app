-- Migration: Ensure `recipe_tags.categories` and its enum exist BEFORE the
-- meal-type seed migration runs.
--
-- Background: the `categories` column and `recipe_tag_category` enum predate
-- the committed migration history. They were created on production manually
-- and have never been declared in any local migration file. Two later
-- migrations on this branch reference them:
--
--   - 20260415000002_seed_meal_type_tags.sql        — does
--     `array_append(categories, 'MEAL_TYPE'::public.recipe_tag_category)`
--   - 20260425000001_backfill_recipe_tags_categories.sql — was a stop-gap
--     that added the column as TEXT[] AFTER the seed already needed it
--
-- A fresh `supabase db reset` would fail at the seed migration because the
-- enum/column don't exist yet. This migration creates the enum plus column
-- with the correct enum-array type and also repairs the stop-gap TEXT[] column
-- shape if it already exists.
--
-- The later 20260425000001 migration is now redundant but kept in the repo
-- for cloud-history continuity (it has already been applied to production
-- via `supabase db push` on 2026-04-25). It is a no-op in environments where
-- this migration has already created the correct column.
--
-- Date: 2026-04-15 (file timestamp chosen to run before the seed at
--                   20260415000002; the actual edit date is 2026-04-25)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'recipe_tag_category'
  ) THEN
    CREATE TYPE public.recipe_tag_category AS ENUM (
      'GENERAL',
      'CULTURAL_CUISINE',
      'MEAL_TYPE'
    );
  END IF;
END $$;

DO $$
DECLARE
  categories_udt_name text;
BEGIN
  SELECT udt_name INTO categories_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'recipe_tags'
    AND column_name = 'categories';

  IF categories_udt_name IS NULL THEN
    ALTER TABLE public.recipe_tags
      ADD COLUMN categories public.recipe_tag_category[]
      NOT NULL DEFAULT '{}'::public.recipe_tag_category[];
  ELSIF categories_udt_name = '_text' THEN
    ALTER TABLE public.recipe_tags
      ALTER COLUMN categories DROP DEFAULT,
      ALTER COLUMN categories TYPE public.recipe_tag_category[]
        USING categories::public.recipe_tag_category[];

    UPDATE public.recipe_tags
    SET categories = '{}'::public.recipe_tag_category[]
    WHERE categories IS NULL;

    ALTER TABLE public.recipe_tags
      ALTER COLUMN categories SET DEFAULT '{}'::public.recipe_tag_category[],
      ALTER COLUMN categories SET NOT NULL;
  ELSE
    UPDATE public.recipe_tags
    SET categories = '{}'::public.recipe_tag_category[]
    WHERE categories IS NULL;

    ALTER TABLE public.recipe_tags
      ALTER COLUMN categories SET DEFAULT '{}'::public.recipe_tag_category[],
      ALTER COLUMN categories SET NOT NULL;
  END IF;
END $$;
