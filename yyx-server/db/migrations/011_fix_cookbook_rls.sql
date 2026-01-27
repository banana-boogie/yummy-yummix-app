-- ============================================================================
-- Migration: Fix Cookbook RLS Security Vulnerability
-- Description: Remove overly permissive RLS policies that allow any user to
--              read ALL cookbooks and cookbook_recipes. Share token access
--              is handled at the application layer via getCookbookByShareToken().
-- Date: 2026-01-26
-- ============================================================================

-- Drop the overly permissive policies that use USING (true)
-- These policies allowed ANY user (including unauthenticated) to read ALL data

DROP POLICY IF EXISTS "Anyone can read cookbooks by share token" ON cookbooks;
DROP POLICY IF EXISTS "Anyone can read recipes in shared cookbooks" ON cookbook_recipes;

-- ============================================================================
-- Share Token Access Strategy
-- ============================================================================
--
-- For share token-based access, we rely on:
-- 1. The application-level filtering in cookbookService.getCookbookByShareToken()
--    which queries by the specific share_token
-- 2. The existing "Anyone can read public cookbooks" policy for public cookbooks
-- 3. The existing "Users can read own cookbooks" policy for authenticated users
--
-- This approach is secure because:
-- - Without the RLS bypass, users can only access:
--   a) Their own cookbooks (authenticated)
--   b) Public cookbooks (anyone)
-- - Share token access requires knowing the specific UUID token
-- - The service function handles token validation at the application layer
--
-- If a more restrictive RLS approach is needed in the future, consider:
-- Option A: Create a database function with SECURITY DEFINER that validates
--           the share token and returns only the matching cookbook
-- Option B: Use a separate "shared_cookbook_access" table to track who has
--           been granted access to which cookbooks via tokens
-- ============================================================================

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

COMMENT ON TABLE cookbooks IS 'User-owned recipe collections. Share token access is handled at application layer.';
