-- Migration: Add updated_at trigger for recipe_ratings
-- Created: 2026-02-12
-- Description: Auto-set updated_at on row updates so the column stays fresh

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recipe_ratings_updated_at
    BEFORE UPDATE ON public.recipe_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
