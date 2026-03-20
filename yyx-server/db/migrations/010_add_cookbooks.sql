-- ============================================================================
-- Migration: Add Cookbooks Feature
-- Description: Create tables for user-owned recipe collections (cookbooks)
-- Date: 2026-01-13
-- ============================================================================

-- Create cookbooks table
CREATE TABLE IF NOT EXISTS cookbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_es TEXT,
  description_en TEXT,
  description_es TEXT,
  is_public BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,  -- true for auto-created "Favorites"
  share_token UUID DEFAULT gen_random_uuid(),
  share_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cookbooks_user_id ON cookbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_cookbooks_share_token ON cookbooks(share_token);
CREATE INDEX IF NOT EXISTS idx_cookbooks_is_public ON cookbooks(is_public);
CREATE INDEX IF NOT EXISTS idx_cookbooks_share_enabled ON cookbooks(share_enabled);

-- Ensure only one default cookbook per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_cookbooks_user_default
  ON cookbooks(user_id, is_default)
  WHERE is_default = true;

-- Create cookbook_recipes junction table
CREATE TABLE IF NOT EXISTS cookbook_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id UUID NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  notes_en TEXT,
  notes_es TEXT,
  display_order INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cookbook_id, recipe_id)
);

-- Create indexes for junction table
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_cookbook_id ON cookbook_recipes(cookbook_id);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_recipe_id ON cookbook_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_display_order ON cookbook_recipes(cookbook_id, display_order);

-- Add updated_at trigger for cookbooks
CREATE OR REPLACE FUNCTION update_cookbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cookbooks_updated_at
  BEFORE UPDATE ON cookbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_cookbooks_updated_at();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE cookbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookbook_recipes ENABLE ROW LEVEL SECURITY;

-- Cookbooks policies
-- 1. Users can read their own cookbooks
CREATE POLICY "Users can read own cookbooks"
  ON cookbooks FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Users can read public cookbooks
CREATE POLICY "Anyone can read public cookbooks"
  ON cookbooks FOR SELECT
  USING (is_public = true);

-- 3. Users can insert their own cookbooks
CREATE POLICY "Users can insert own cookbooks"
  ON cookbooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Users can update their own cookbooks
CREATE POLICY "Users can update own cookbooks"
  ON cookbooks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Users can delete their own cookbooks (except default)
CREATE POLICY "Users can delete own cookbooks"
  ON cookbooks FOR DELETE
  USING (auth.uid() = user_id AND is_default = false);

-- Cookbook recipes policies
-- 1. Users can read recipes in their own cookbooks
CREATE POLICY "Users can read recipes in own cookbooks"
  ON cookbook_recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- 2. Anyone can read recipes in public cookbooks
CREATE POLICY "Anyone can read recipes in public cookbooks"
  ON cookbook_recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_recipes.cookbook_id
      AND cookbooks.is_public = true
    )
  );

-- 3. Users can insert recipes into their own cookbooks
CREATE POLICY "Users can insert recipes into own cookbooks"
  ON cookbook_recipes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- 4. Users can update recipes in their own cookbooks
CREATE POLICY "Users can update recipes in own cookbooks"
  ON cookbook_recipes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- 5. Users can delete recipes from their own cookbooks
CREATE POLICY "Users can delete recipes from own cookbooks"
  ON cookbook_recipes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = cookbook_recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to regenerate share token
CREATE OR REPLACE FUNCTION regenerate_cookbook_share_token(cookbook_id UUID)
RETURNS UUID AS $$
DECLARE
  new_token UUID;
BEGIN
  new_token := gen_random_uuid();

  UPDATE cookbooks
  SET share_token = new_token, share_enabled = true, updated_at = NOW()
  WHERE id = cookbook_id
  AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cookbook not found';
  END IF;

  RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE cookbooks IS 'User-owned recipe collections';
COMMENT ON TABLE cookbook_recipes IS 'Junction table linking recipes to cookbooks';
COMMENT ON COLUMN cookbooks.is_default IS 'True for auto-created "Favorites" cookbook';
COMMENT ON COLUMN cookbooks.share_token IS 'UUID token for sharing cookbook via link';
COMMENT ON COLUMN cookbooks.share_enabled IS 'If true, sharing via link is enabled';
COMMENT ON COLUMN cookbooks.is_public IS 'If true, cookbook is publicly discoverable';
COMMENT ON COLUMN cookbook_recipes.display_order IS 'Order in which recipes appear in cookbook';
