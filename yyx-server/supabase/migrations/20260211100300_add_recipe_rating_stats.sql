-- Migration: Add rating stats columns and trigger
-- Created: 2026-02-11
-- Description: Add average_rating and rating_count to recipes, auto-updated by trigger

-- ============================================================================
-- 1. Add columns to recipes table
-- ============================================================================
ALTER TABLE public.recipes
    ADD COLUMN IF NOT EXISTS average_rating numeric,
    ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. Create trigger function to auto-update rating stats
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_recipe_rating_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Recalculate stats for the affected recipe
    UPDATE public.recipes
    SET
        average_rating = sub.avg_rating,
        rating_count = sub.cnt
    FROM (
        SELECT
            ROUND(AVG(rating)::numeric, 2) AS avg_rating,
            COUNT(*)::integer AS cnt
        FROM public.recipe_ratings
        WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
    ) sub
    WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- 3. Create trigger on recipe_ratings
-- ============================================================================
CREATE TRIGGER trg_update_recipe_rating_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_recipe_rating_stats();
