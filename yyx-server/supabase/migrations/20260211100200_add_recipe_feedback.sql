-- Migration: Add recipe feedback
-- Created: 2026-02-11
-- Description: Store user feedback text for admin review

-- ============================================================================
-- 1. Create recipe_feedback table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recipe_feedback (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    feedback text NOT NULL CHECK (char_length(feedback) >= 1 AND char_length(feedback) <= 2000),
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_recipe_id ON public.recipe_feedback(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_user_id ON public.recipe_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_created_at ON public.recipe_feedback(created_at DESC);

-- ============================================================================
-- 2. Enable RLS and create policies
-- ============================================================================
ALTER TABLE public.recipe_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
    ON public.recipe_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
    ON public.recipe_feedback FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can read all feedback (via service role or admin check)
-- Note: Admin access is handled via service role key in admin endpoints
