-- First, create an enum type
CREATE TYPE recipe_difficulty AS ENUM ('easy', 'medium', 'hard');

-- Update existing values
UPDATE recipes 
SET difficulty = CASE 
    WHEN difficulty = 'Facil' THEN 'easy'
    WHEN difficulty = 'Medio' THEN 'medium'
    WHEN difficulty = 'Dificil' THEN 'hard'
    ELSE 'easy' -- default fallback
END;

-- Change column type to use enum
ALTER TABLE recipes 
    ALTER COLUMN difficulty TYPE recipe_difficulty 
    USING difficulty::recipe_difficulty; 