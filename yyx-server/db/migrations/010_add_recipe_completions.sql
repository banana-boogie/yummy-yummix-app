-- Migration: Add recipe completions tracking
-- Created: 2026-01-12
-- Description: Track when users complete recipes for AI learning and rating gating

-- ============================================================================
-- 1. Create recipe_completions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recipe_completions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    completion_count integer NOT NULL DEFAULT 1,
    first_completed_at timestamptz DEFAULT now() NOT NULL,
    last_completed_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, recipe_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_recipe_completions_user_id ON public.recipe_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_completions_recipe_id ON public.recipe_completions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_completions_last_completed ON public.recipe_completions(last_completed_at DESC);

-- ============================================================================
-- 2. Enable RLS and create policies
-- ============================================================================
ALTER TABLE public.recipe_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view own completions"
    ON public.recipe_completions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own completions
CREATE POLICY "Users can insert own completions"
    ON public.recipe_completions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own completions
CREATE POLICY "Users can update own completions"
    ON public.recipe_completions FOR UPDATE
    USING (auth.uid() = user_id);
