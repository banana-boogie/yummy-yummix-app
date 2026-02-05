-- Fix RLS performance by using (SELECT auth.uid()) pattern
-- This prevents re-evaluation of auth functions for each row
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

-- =====================================================
-- FIX user_profiles
-- =====================================================
-- Drop old and new policy names to make migration idempotent
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can delete own profile"
ON user_profiles FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = id);

-- =====================================================
-- FIX measurement_units - use is_admin() helper
-- =====================================================
DROP POLICY IF EXISTS "Only authenticated users can delete measurement units" ON measurement_units;
DROP POLICY IF EXISTS "Only authenticated users can insert measurement units" ON measurement_units;
DROP POLICY IF EXISTS "Only authenticated users can update measurement units" ON measurement_units;
DROP POLICY IF EXISTS "Only admins can delete measurement units" ON measurement_units;
DROP POLICY IF EXISTS "Only admins can insert measurement units" ON measurement_units;
DROP POLICY IF EXISTS "Only admins can update measurement units" ON measurement_units;

CREATE POLICY "Only admins can delete measurement units"
ON measurement_units FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can insert measurement units"
ON measurement_units FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update measurement units"
ON measurement_units FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- FIX useful_items - use is_admin() helper
-- =====================================================
-- Drop to make idempotent (these are the policies we're creating)
DROP POLICY IF EXISTS "Only admins can delete useful items" ON useful_items;
DROP POLICY IF EXISTS "Only admins can insert useful items" ON useful_items;
DROP POLICY IF EXISTS "Only admins can update useful items" ON useful_items;

CREATE POLICY "Only admins can delete useful items"
ON useful_items FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can insert useful items"
ON useful_items FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update useful items"
ON useful_items FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- FIX recipe_useful_items - use is_admin() helper
-- =====================================================
DROP POLICY IF EXISTS "Only admins can delete recipe useful items" ON recipe_useful_items;
DROP POLICY IF EXISTS "Only admins can insert into recipe useful items" ON recipe_useful_items;
DROP POLICY IF EXISTS "Only admins can update recipe useful items" ON recipe_useful_items;
DROP POLICY IF EXISTS "Only admins can insert recipe useful items" ON recipe_useful_items;

CREATE POLICY "Only admins can delete recipe useful items"
ON recipe_useful_items FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can insert recipe useful items"
ON recipe_useful_items FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update recipe useful items"
ON recipe_useful_items FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- FIX user_context - SKIPPED: table doesn't exist
-- =====================================================

-- =====================================================
-- FIX user_events
-- =====================================================
DROP POLICY IF EXISTS "user_events_user_policy" ON user_events;

CREATE POLICY "user_events_user_policy"
ON user_events FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- =====================================================
-- FIX user_chat_sessions
-- =====================================================
DROP POLICY IF EXISTS "user_chat_sessions_user_policy" ON user_chat_sessions;

CREATE POLICY "user_chat_sessions_user_policy"
ON user_chat_sessions FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- =====================================================
-- FIX user_chat_messages
-- =====================================================
DROP POLICY IF EXISTS "user_chat_messages_user_policy" ON user_chat_messages;

CREATE POLICY "user_chat_messages_user_policy"
ON user_chat_messages FOR ALL
TO authenticated
USING (session_id IN (
  SELECT id FROM user_chat_sessions
  WHERE user_id = (SELECT auth.uid())
))
WITH CHECK (session_id IN (
  SELECT id FROM user_chat_sessions
  WHERE user_id = (SELECT auth.uid())
));

-- =====================================================
-- FIX user_recipes
-- =====================================================
DROP POLICY IF EXISTS "user_recipes_user_policy" ON user_recipes;

CREATE POLICY "user_recipes_user_policy"
ON user_recipes FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- =====================================================
-- FIX ai_voice_sessions
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own sessions" ON ai_voice_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON ai_voice_sessions;

CREATE POLICY "Users can view their own sessions"
ON ai_voice_sessions FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own sessions"
ON ai_voice_sessions FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- FIX ai_voice_usage
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own usage" ON ai_voice_usage;

CREATE POLICY "Users can view their own usage"
ON ai_voice_usage FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);
