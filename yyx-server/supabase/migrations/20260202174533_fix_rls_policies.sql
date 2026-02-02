-- Fix RLS policies that use USING(true) or WITH CHECK(true)
-- Replace with proper admin checks for master data tables
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = (SELECT auth.uid())),
    false
  );
$$;

-- =====================================================
-- FIX ai_voice_sessions - Remove service role policy
-- Edge functions use service role key which bypasses RLS
-- =====================================================
DROP POLICY IF EXISTS "Service role can insert sessions" ON ai_voice_sessions;

-- =====================================================
-- FIX ai_voice_usage - Remove trigger policy
-- Triggers run with SECURITY DEFINER or as superuser
-- =====================================================
DROP POLICY IF EXISTS "Allow usage updates from triggers" ON ai_voice_usage;

-- =====================================================
-- FIX recipes - Only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert recipes" ON recipes;
DROP POLICY IF EXISTS "Authenticated users can update recipes" ON recipes;
DROP POLICY IF EXISTS "Authenticated users can delete recipes" ON recipes;

CREATE POLICY "Only admins can insert recipes"
ON recipes FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update recipes"
ON recipes FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete recipes"
ON recipes FOR DELETE
TO authenticated
USING (public.is_admin());

-- =====================================================
-- FIX ingredients - Only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "Only authenticated users can insert ingredients" ON ingredients;
DROP POLICY IF EXISTS "Only authenticated users can update ingredients" ON ingredients;
DROP POLICY IF EXISTS "Only authenticated users can delete ingredients" ON ingredients;

CREATE POLICY "Only admins can insert ingredients"
ON ingredients FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update ingredients"
ON ingredients FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete ingredients"
ON ingredients FOR DELETE
TO authenticated
USING (public.is_admin());

-- =====================================================
-- FIX recipe_ingredients - Only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "Only authenticated users can add recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Only authenticated users can update recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Only authenticated users can delete recipe ingredients" ON recipe_ingredients;

CREATE POLICY "Only admins can insert recipe ingredients"
ON recipe_ingredients FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update recipe ingredients"
ON recipe_ingredients FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete recipe ingredients"
ON recipe_ingredients FOR DELETE
TO authenticated
USING (public.is_admin());

-- =====================================================
-- FIX recipe_steps - Only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "Only authenticated users can insert recipe steps" ON recipe_steps;
DROP POLICY IF EXISTS "Only authenticated users can update recipe steps" ON recipe_steps;
DROP POLICY IF EXISTS "Only authenticated users can delete recipe steps" ON recipe_steps;

CREATE POLICY "Only admins can insert recipe steps"
ON recipe_steps FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update recipe steps"
ON recipe_steps FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete recipe steps"
ON recipe_steps FOR DELETE
TO authenticated
USING (public.is_admin());

-- =====================================================
-- FIX recipe_step_ingredients - Only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "Only authenticated users can insert recipe step ingredients" ON recipe_step_ingredients;
DROP POLICY IF EXISTS "Only authenticated users can update recipe step ingredients" ON recipe_step_ingredients;
DROP POLICY IF EXISTS "Only authenticated users can delete recipe step ingredients" ON recipe_step_ingredients;

CREATE POLICY "Only admins can insert recipe step ingredients"
ON recipe_step_ingredients FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update recipe step ingredients"
ON recipe_step_ingredients FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete recipe step ingredients"
ON recipe_step_ingredients FOR DELETE
TO authenticated
USING (public.is_admin());

-- =====================================================
-- FIX recipe_tags - Only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "Only authenticated can insert recipe tags" ON recipe_tags;
DROP POLICY IF EXISTS "Only authenticated can update recipe tags" ON recipe_tags;
DROP POLICY IF EXISTS "Only authenticated can delete recipe tags" ON recipe_tags;

CREATE POLICY "Only admins can insert recipe tags"
ON recipe_tags FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update recipe tags"
ON recipe_tags FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete recipe tags"
ON recipe_tags FOR DELETE
TO authenticated
USING (public.is_admin());

-- =====================================================
-- FIX recipe_to_tag - Only admins can modify
-- =====================================================
DROP POLICY IF EXISTS "Only authenticated can insert into recipe_to_tag" ON recipe_to_tag;
DROP POLICY IF EXISTS "Only authenticated can update recipe_to_tag" ON recipe_to_tag;
DROP POLICY IF EXISTS "Only authenticated can delete from recipe_to_tag" ON recipe_to_tag;

CREATE POLICY "Only admins can insert into recipe_to_tag"
ON recipe_to_tag FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update recipe_to_tag"
ON recipe_to_tag FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete from recipe_to_tag"
ON recipe_to_tag FOR DELETE
TO authenticated
USING (public.is_admin());
