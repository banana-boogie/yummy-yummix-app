-- Add English columns to ingredients table
ALTER TABLE ingredients
ADD COLUMN name_en text,
ADD COLUMN name_es text,
ADD COLUMN plural_name_en text,
ADD COLUMN plural_name_es text,


-- Add English columns to recipes table
ALTER TABLE recipes
ADD COLUMN name_en text,
ADD COLUMN name_es text,
ADD COLUMN tips_and_tricks_en text,
ADD COLUMN tips_and_tricks_es text,
ADD COLUMN difficulty text,

-- Copy existing data to _es columns
UPDATE recipes
SET name_es = name,
    tips_and_tricks_es = tips_and_tricks,
    useful_items_es = useful_items

-- Add English columns to recipe_ingredients table
ALTER TABLE recipe_ingredients
ADD COLUMN notes_en text,
ADD COLUMN notes_es text,
ADD COLUMN custom_unit_en text,
ADD COLUMN custom_unit_es text;



-- Add English columns to recipe_tags table
ALTER TABLE recipe_tags
ADD COLUMN name_en text,
ADD COLUMN name_es text;

-- Copy existing data to _es columns
UPDATE recipe_tags
SET name_es = name;

-- Drop original columns after data is copied
ALTER TABLE ingredients
DROP COLUMN name,
DROP COLUMN plural_name

ALTER TABLE recipes
DROP COLUMN name,
DROP COLUMN tips_and_tricks,


