-- Migration: Add recipe ratings
-- Created: 2026-02-11
-- Description: Store user ratings (1-5 stars) for published recipes

-- ============================================================================
-- 1. Create recipe_ratings table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recipe_ratings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, recipe_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe_id ON public.recipe_ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user_id ON public.recipe_ratings(user_id);

-- ============================================================================
-- 2. Enable RLS and create policies
-- ============================================================================
ALTER TABLE public.recipe_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings (public display)
CREATE POLICY "Anyone can view ratings"
    ON public.recipe_ratings FOR SELECT
    USING (true);

-- Authenticated users can insert their own ratings
CREATE POLICY "Users can insert own ratings"
    ON public.recipe_ratings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
    ON public.recipe_ratings FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
    ON public.recipe_ratings FOR DELETE
    USING (auth.uid() = user_id);
