-- Migration to convert thermomix_speed column from FLOAT to thermomix_speed_type enum

-- Step 2: Add a temporary column with the new type
ALTER TABLE recipe_steps ADD COLUMN thermomix_speed_new thermomix_speed_type;

-- Step 3: Convert existing data and populate the new column
UPDATE recipe_steps
SET thermomix_speed_new = 
    CASE 
        WHEN thermomix_speed IS NULL THEN NULL
        WHEN thermomix_speed = 0 THEN '0.5'::thermomix_speed_type  -- Default to minimum value
        WHEN thermomix_speed = 0.5 THEN '0.5'::thermomix_speed_type
        WHEN thermomix_speed = 1 THEN '1'::thermomix_speed_type
        WHEN thermomix_speed = 1.5 THEN '1.5'::thermomix_speed_type
        WHEN thermomix_speed = 2 THEN '2'::thermomix_speed_type
        WHEN thermomix_speed = 2.5 THEN '2.5'::thermomix_speed_type
        WHEN thermomix_speed = 3 THEN '3'::thermomix_speed_type
        WHEN thermomix_speed = 3.5 THEN '3.5'::thermomix_speed_type
        WHEN thermomix_speed = 4 THEN '4'::thermomix_speed_type
        WHEN thermomix_speed = 4.5 THEN '4.5'::thermomix_speed_type
        WHEN thermomix_speed = 5 THEN '5'::thermomix_speed_type
        WHEN thermomix_speed = 5.5 THEN '5.5'::thermomix_speed_type
        WHEN thermomix_speed = 6 THEN '6'::thermomix_speed_type
        WHEN thermomix_speed = 6.5 THEN '6.5'::thermomix_speed_type
        WHEN thermomix_speed = 7 THEN '7'::thermomix_speed_type
        WHEN thermomix_speed = 7.5 THEN '7.5'::thermomix_speed_type
        WHEN thermomix_speed = 8 THEN '8'::thermomix_speed_type
        WHEN thermomix_speed = 8.5 THEN '8.5'::thermomix_speed_type
        WHEN thermomix_speed = 9 THEN '9'::thermomix_speed_type
        WHEN thermomix_speed = 9.5 THEN '9.5'::thermomix_speed_type
        WHEN thermomix_speed = 10 THEN '10'::thermomix_speed_type
        ELSE NULL  -- Default value for any non-matching values
    END;

-- Step 4: Drop the old column and rename the new one
ALTER TABLE recipe_steps DROP COLUMN thermomix_speed;
ALTER TABLE recipe_steps RENAME COLUMN thermomix_speed_new TO thermomix_speed;
