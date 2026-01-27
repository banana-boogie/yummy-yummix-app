-- ============================================================================
-- Migration: Fix Cookbook RLS Security Vulnerability
-- Description: Remove overly permissive RLS policies that allow any user to
--              read ALL cookbooks and cookbook_recipes. Share token access
--              is handled via SECURITY DEFINER functions with explicit
--              share_enabled checks.
-- Date: 2026-01-26
-- ============================================================================

-- Drop the overly permissive policies that use USING (true)
-- These policies allowed ANY user (including unauthenticated) to read ALL data

DROP POLICY IF EXISTS "Anyone can read cookbooks by share token" ON cookbooks;
DROP POLICY IF EXISTS "Anyone can read recipes in shared cookbooks" ON cookbook_recipes;

-- ============================================================================
-- Share Token Access Solution: SECURITY DEFINER Functions
-- ============================================================================
--
-- Instead of overly permissive RLS policies, we use SECURITY DEFINER functions
-- that bypass RLS in a controlled manner. This is secure because:
-- 1. Only the specific cookbook matching the token is returned
-- 2. The token must be a valid UUID and must match exactly
-- 3. Both authenticated and unauthenticated users can access via share token
-- 4. All other cookbooks remain protected by RLS
--
-- ============================================================================

-- Function to get a cookbook by share token
-- SECURITY DEFINER allows this to bypass RLS while remaining secure
CREATE OR REPLACE FUNCTION get_cookbook_by_share_token(p_share_token UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name_en TEXT,
  name_es TEXT,
  description_en TEXT,
  description_es TEXT,
  is_public BOOLEAN,
  is_default BOOLEAN,
  share_token UUID,
  share_enabled BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.name_en,
    c.name_es,
    c.description_en,
    c.description_es,
    c.is_public,
    c.is_default,
    c.share_token,
    c.share_enabled,
    c.created_at,
    c.updated_at
  FROM cookbooks c
  WHERE c.share_token = p_share_token
  AND c.share_enabled = true
  LIMIT 1;
END;
$$;

-- Function to get recipes from a shared cookbook
-- SECURITY DEFINER allows this to bypass RLS while remaining secure
CREATE OR REPLACE FUNCTION get_cookbook_recipes_by_share_token(p_share_token UUID)
RETURNS TABLE (
  cookbook_recipe_id UUID,
  cookbook_id UUID,
  recipe_id UUID,
  notes_en TEXT,
  notes_es TEXT,
  display_order INTEGER,
  added_at TIMESTAMPTZ,
  -- Recipe fields
  recipe_name_en TEXT,
  recipe_name_es TEXT,
  recipe_description_en TEXT,
  recipe_description_es TEXT,
  recipe_image_url TEXT,
  recipe_prep_time_minutes INTEGER,
  recipe_cook_time_minutes INTEGER,
  recipe_servings INTEGER,
  recipe_difficulty TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id as cookbook_recipe_id,
    cr.cookbook_id,
    cr.recipe_id,
    cr.notes_en,
    cr.notes_es,
    cr.display_order,
    cr.added_at,
    r.name_en as recipe_name_en,
    r.name_es as recipe_name_es,
    r.description_en as recipe_description_en,
    r.description_es as recipe_description_es,
    r.image_url as recipe_image_url,
    r.prep_time_minutes as recipe_prep_time_minutes,
    r.cook_time_minutes as recipe_cook_time_minutes,
    r.servings as recipe_servings,
    r.difficulty as recipe_difficulty
  FROM cookbook_recipes cr
  INNER JOIN cookbooks c ON c.id = cr.cookbook_id
  INNER JOIN recipes r ON r.id = cr.recipe_id
  WHERE c.share_token = p_share_token
  AND c.share_enabled = true
  ORDER BY cr.display_order ASC, cr.added_at DESC;
END;
$$;

-- Grant execute permissions to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_cookbook_by_share_token(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_cookbook_recipes_by_share_token(UUID) TO authenticated, anon;

-- Verify remaining policies are properly configured
-- (No changes needed to these - they are secure)
--
-- Cookbooks:
-- - "Users can read own cookbooks" - USING (auth.uid() = user_id)
-- - "Anyone can read public cookbooks" - USING (is_public = true)
-- - "Users can insert own cookbooks" - WITH CHECK (auth.uid() = user_id)
-- - "Users can update own cookbooks" - USING/WITH CHECK (auth.uid() = user_id)
-- - "Users can delete own cookbooks" - USING (auth.uid() = user_id AND is_default = false)
--
-- Cookbook Recipes:
-- - "Users can read recipes in own cookbooks" - EXISTS check on cookbook ownership
-- - "Anyone can read recipes in public cookbooks" - EXISTS check on is_public = true
-- - "Users can insert recipes into own cookbooks" - EXISTS check on cookbook ownership
-- - "Users can update recipes in own cookbooks" - EXISTS check on cookbook ownership
-- - "Users can delete recipes from own cookbooks" - EXISTS check on cookbook ownership

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE cookbooks IS 'User-owned recipe collections. Share token access is handled via SECURITY DEFINER functions with share_enabled checks.';
