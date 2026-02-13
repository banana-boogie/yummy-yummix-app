-- ============================================================
-- Normalize Food Preferences Data Model
-- ============================================================
--
-- Problem: The current data model mixes different concepts:
-- - dietary_restriction enum mixes allergies with intolerances
-- - diet_type enum mixes diets (vegan, keto) with cuisines (mediterranean)
-- - Frontend uses hardcoded constants instead of database tables
--
-- Solution: Three separate database-driven tables:
-- 1. food_allergies - Allergen categories (HARD constraint - can't eat)
-- 2. diet_types - Eating approaches (MEDIUM constraint - affects ingredients)
-- 3. cuisine_preferences - Cooking styles (SOFT constraint - affects style)
--
-- ============================================================

-- ============================================================
-- Phase 1: Create new lookup tables
-- ============================================================

-- Food allergies table (replaces dietary_restriction enum for frontend)
CREATE TABLE IF NOT EXISTS food_allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  icon_name text,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE food_allergies IS 'Lookup table for food allergen categories. Used in onboarding and profile settings.';
COMMENT ON COLUMN food_allergies.slug IS 'Unique identifier used in code (e.g., nuts, dairy, gluten)';
COMMENT ON COLUMN food_allergies.icon_name IS 'Icon identifier for frontend mapping (e.g., nut-allergy)';

-- Diet types table (replaces diet_type enum for frontend)
CREATE TABLE IF NOT EXISTS diet_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  icon_name text,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE diet_types IS 'Lookup table for diet types/eating approaches. Does NOT include cuisines.';
COMMENT ON COLUMN diet_types.slug IS 'Unique identifier used in code (e.g., vegan, keto, paleo)';

-- Cuisine preferences table (NEW - for cooking style preferences)
CREATE TABLE IF NOT EXISTS cuisine_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  icon_name text,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE cuisine_preferences IS 'Lookup table for cuisine/cooking style preferences. These are SOFT preferences that inspire recipes.';
COMMENT ON COLUMN cuisine_preferences.slug IS 'Unique identifier used in code (e.g., italian, mexican, mediterranean)';

-- ============================================================
-- Phase 2: Seed data
-- ============================================================

-- Seed food_allergies (from existing dietary_restriction enum, excluding 'none' and 'other')
INSERT INTO food_allergies (slug, name_en, name_es, icon_name, display_order) VALUES
  ('nuts', 'Nuts', 'Nueces', 'nut-allergy', 1),
  ('dairy', 'Dairy', 'Lácteos', 'dairy-allergy', 2),
  ('eggs', 'Eggs', 'Huevos', 'egg-allergy', 3),
  ('seafood', 'Seafood', 'Mariscos', 'seafood-allergy', 4),
  ('gluten', 'Gluten', 'Gluten', 'gluten-allergy', 5)
ON CONFLICT (slug) DO NOTHING;

-- Seed diet_types (from existing diet_type enum, EXCLUDING mediterranean - that's a cuisine)
INSERT INTO diet_types (slug, name_en, name_es, icon_name, display_order) VALUES
  ('vegan', 'Vegan', 'Vegana', 'vegan-diet', 1),
  ('vegetarian', 'Vegetarian', 'Vegetariana', 'vegetarian-diet', 2),
  ('lactoVegetarian', 'Lacto-vegetarian', 'Lacto vegetariana', 'lacto-vegetarian-diet', 3),
  ('ovoVegetarian', 'Ovo-vegetarian', 'Ovo vegetariana', 'ovo-vegetarian-diet', 4),
  ('pescatarian', 'Pescatarian', 'Pescatariana', 'pescatarian-diet', 5),
  ('keto', 'Keto', 'Keto', 'keto-diet', 6),
  ('paleo', 'Paleo', 'Paleo', 'paleo-diet', 7),
  ('sugarFree', 'Sugar-free', 'Sin azúcar', 'sugar-free-diet', 8)
ON CONFLICT (slug) DO NOTHING;

-- Seed cuisine_preferences (NEW - includes mediterranean which was moved from diet_types)
INSERT INTO cuisine_preferences (slug, name_en, name_es, icon_name, display_order) VALUES
  ('mediterranean', 'Mediterranean', 'Mediterránea', 'mediterranean', 1),
  ('italian', 'Italian', 'Italiana', 'italian', 2),
  ('mexican', 'Mexican', 'Mexicana', 'mexican', 3),
  ('asian', 'Asian', 'Asiática', 'asian', 4),
  ('japanese', 'Japanese', 'Japonesa', 'japanese', 5),
  ('chinese', 'Chinese', 'China', 'chinese', 6),
  ('thai', 'Thai', 'Tailandesa', 'thai', 7),
  ('indian', 'Indian', 'India', 'indian', 8),
  ('middle_eastern', 'Middle Eastern', 'Medio Oriente', 'middle-eastern', 9),
  ('greek', 'Greek', 'Griega', 'greek', 10),
  ('spanish', 'Spanish', 'Española', 'spanish', 11),
  ('french', 'French', 'Francesa', 'french', 12),
  ('american', 'American', 'Americana', 'american', 13)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Phase 3: Add cuisine_preferences column to user_profiles
-- ============================================================

-- Add cuisine_preferences column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS cuisine_preferences text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN user_profiles.cuisine_preferences IS 'Array of cuisine preference slugs (e.g., italian, mexican). Used to inspire AI recipe generation.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_cuisine_preferences
ON user_profiles USING gin (cuisine_preferences);

-- ============================================================
-- Phase 4: Migrate existing user data
-- ============================================================

-- Migrate users who have 'mediterranean' in diet_types to cuisine_preferences
UPDATE user_profiles
SET cuisine_preferences = array_append(cuisine_preferences, 'mediterranean')
WHERE 'mediterranean' = ANY(diet_types)
  AND NOT ('mediterranean' = ANY(cuisine_preferences));

-- Remove 'mediterranean' from diet_types for existing users
UPDATE user_profiles
SET diet_types = array_remove(diet_types, 'mediterranean')
WHERE 'mediterranean' = ANY(diet_types);

-- ============================================================
-- Phase 5: Enable RLS on new tables
-- ============================================================

-- Enable RLS (these are read-only lookup tables)
ALTER TABLE food_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuisine_preferences ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (lookup tables are public data)
CREATE POLICY "Allow authenticated users to read food_allergies"
  ON food_allergies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read diet_types"
  ON diet_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read cuisine_preferences"
  ON cuisine_preferences FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anon for potential use in public-facing features
CREATE POLICY "Allow anon users to read food_allergies"
  ON food_allergies FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon users to read diet_types"
  ON diet_types FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon users to read cuisine_preferences"
  ON cuisine_preferences FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- Note: Existing enums (dietary_restriction, diet_type) are NOT removed.
-- They continue to work for backwards compatibility.
-- The new tables are used for the frontend UI, while the enums
-- can still be used for database validation if needed.
-- ============================================================
