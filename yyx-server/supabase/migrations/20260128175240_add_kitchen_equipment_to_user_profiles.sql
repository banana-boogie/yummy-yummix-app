-- Add kitchen_equipment column to user_profiles table
-- This stores an array of equipment the user has (e.g., ["thermomix_TM6", "air_fryer"])

-- Add the column
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS kitchen_equipment jsonb DEFAULT '[]'::jsonb;

-- Add a comment for documentation
COMMENT ON COLUMN user_profiles.kitchen_equipment IS 'Array of kitchen equipment strings. Examples: ["thermomix_TM6", "thermomix_TM7", "air_fryer"]. Used to personalize recipe generation with equipment-specific instructions (especially Thermomix cooking parameters).';

-- Create an index for faster queries on equipment
CREATE INDEX IF NOT EXISTS idx_user_profiles_kitchen_equipment
ON user_profiles USING gin (kitchen_equipment);

-- Example data structure:
-- kitchen_equipment: ["thermomix_TM6", "air_fryer"]
-- or
-- kitchen_equipment: ["thermomix_TM7"]
-- or
-- kitchen_equipment: []
