-- Consolidate user_context into user_profiles
-- Rationale: Having two tables for user data creates confusion and complexity.
-- All user preferences should live in user_profiles (auto-created on signup).

-- Step 1: Add columns from user_context to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS kitchen_equipment jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS skill_level text,
ADD COLUMN IF NOT EXISTS household_size integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS ingredient_dislikes text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS taste_profile jsonb DEFAULT '{}'::jsonb;

-- Add constraint for skill_level (same as user_context had)
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_skill_level_check
CHECK (skill_level IS NULL OR skill_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]));

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.kitchen_equipment IS 'Array of kitchen equipment. Examples: ["thermomix_TM6", "air_fryer"]. Used to personalize recipes with equipment-specific instructions.';
COMMENT ON COLUMN user_profiles.skill_level IS 'User cooking skill level: beginner, intermediate, or advanced';
COMMENT ON COLUMN user_profiles.household_size IS 'Number of people the user typically cooks for';
COMMENT ON COLUMN user_profiles.ingredient_dislikes IS 'Ingredients the user wants to avoid';
COMMENT ON COLUMN user_profiles.taste_profile IS 'User taste preferences (spiciness, sweetness, etc.)';

-- Create index for faster equipment queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_kitchen_equipment
ON user_profiles USING gin (kitchen_equipment);

-- Step 2: Migrate any existing data from user_context to user_profiles
-- This handles the case where user_context has data that user_profiles doesn't
UPDATE user_profiles up
SET
    kitchen_equipment = COALESCE(
        (SELECT to_jsonb(uc.kitchen_equipment) FROM user_context uc WHERE uc.user_id = up.id),
        up.kitchen_equipment
    ),
    skill_level = COALESCE(
        (SELECT uc.skill_level FROM user_context uc WHERE uc.user_id = up.id),
        up.skill_level
    ),
    household_size = COALESCE(
        (SELECT uc.household_size FROM user_context uc WHERE uc.user_id = up.id),
        up.household_size
    ),
    ingredient_dislikes = COALESCE(
        (SELECT uc.ingredient_dislikes FROM user_context uc WHERE uc.user_id = up.id),
        up.ingredient_dislikes
    ),
    taste_profile = COALESCE(
        (SELECT uc.taste_profile FROM user_context uc WHERE uc.user_id = up.id),
        up.taste_profile
    )
WHERE EXISTS (SELECT 1 FROM user_context uc WHERE uc.user_id = up.id);

-- Step 3: Drop the user_context table (no longer needed)
DROP TABLE IF EXISTS user_context;

-- Note: The duplicate dietary_restrictions in user_context (text[]) is intentionally
-- NOT migrated because user_profiles already has dietary_restrictions (enum[]).
-- The enum version is the source of truth.
