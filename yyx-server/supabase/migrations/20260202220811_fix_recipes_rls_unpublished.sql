-- Fix RLS policy to hide unpublished recipes from non-admin users
-- Previously, all recipes were visible regardless of is_published status

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view recipes" ON recipes;
DROP POLICY IF EXISTS "Anyone can view published recipes" ON recipes;

-- Create new policy that only shows published recipes to regular users
-- Admins can still see all recipes
CREATE POLICY "Anyone can view published recipes" ON recipes
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true OR is_admin());
