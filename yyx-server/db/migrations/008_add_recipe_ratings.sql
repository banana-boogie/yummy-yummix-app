-- Migration: Add recipe ratings and feedback tables
-- Created: 2026-01-12

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
-- 2. Create recipe_feedback table (for admin review)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recipe_feedback (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    feedback text NOT NULL CHECK (length(feedback) > 0 AND length(feedback) <= 2000),
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_recipe_id ON public.recipe_feedback(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_created_at ON public.recipe_feedback(created_at DESC);

-- ============================================================================
-- 3. Add cached rating fields to recipes table
-- ============================================================================
ALTER TABLE public.recipes 
ADD COLUMN IF NOT EXISTS average_rating numeric(2,1) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

-- ============================================================================
-- 4. Create function to update cached rating stats
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_recipe_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the recipe's cached rating stats
    UPDATE public.recipes
    SET 
        average_rating = (
            SELECT ROUND(AVG(rating)::numeric, 1)
            FROM public.recipe_ratings
            WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM public.recipe_ratings
            WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
        )
    WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Create triggers to keep cached stats updated
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_rating_stats_insert ON public.recipe_ratings;
CREATE TRIGGER trigger_update_rating_stats_insert
    AFTER INSERT ON public.recipe_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_recipe_rating_stats();

DROP TRIGGER IF EXISTS trigger_update_rating_stats_update ON public.recipe_ratings;
CREATE TRIGGER trigger_update_rating_stats_update
    AFTER UPDATE ON public.recipe_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_recipe_rating_stats();

DROP TRIGGER IF EXISTS trigger_update_rating_stats_delete ON public.recipe_ratings;
CREATE TRIGGER trigger_update_rating_stats_delete
    AFTER DELETE ON public.recipe_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_recipe_rating_stats();

-- Add updated_at trigger for ratings
DROP TRIGGER IF EXISTS handle_ratings_updated_at ON public.recipe_ratings;
CREATE TRIGGER handle_ratings_updated_at
    BEFORE UPDATE ON public.recipe_ratings
    FOR EACH ROW
    EXECUTE PROCEDURE moddatetime(updated_at);

-- ============================================================================
-- 6. Enable RLS and create policies
-- ============================================================================

-- Enable RLS on recipe_ratings
ALTER TABLE public.recipe_ratings ENABLE ROW LEVEL SECURITY;

-- Users can view all ratings (needed for display)
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

-- Enable RLS on recipe_feedback
ALTER TABLE public.recipe_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
    ON public.recipe_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
    ON public.recipe_feedback FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all feedback (using is_admin from user_profiles)
CREATE POLICY "Admins can view all feedback"
    ON public.recipe_feedback FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );
