BEGIN;

-- Verify we can roll back
SAVEPOINT migration_start;

-- Create measurement units table
CREATE TABLE measurement_units (
    id TEXT PRIMARY KEY,                   -- A unique identifier (could be the English abbreviation)
    type TEXT NOT NULL,                    -- 'volume', 'weight', 'unit'
    system TEXT NOT NULL,                  -- 'metric', 'imperial', 'universal'
    symbol_en TEXT NOT NULL,               -- Abbreviation/symbol in English (tbsp., tsp., etc.)
    name_en TEXT NOT NULL,                 -- Full name in English
    name_en_plural TEXT NOT NULL,          -- Plural name in English
    symbol_es TEXT NOT NULL,               -- Abbreviation/symbol in Spanish (cda., cdta., etc.)
    name_es TEXT NOT NULL,                 -- Full name in Spanish
    name_es_plural TEXT NOT NULL           -- Plural name in Spanish
);

-- Insert measurement units
INSERT INTO measurement_units (id, type, system,
    symbol_en, name_en, name_en_plural,
    symbol_es, name_es, name_es_plural
) VALUES
    -- Base metric units (same symbols for both languages)
    ('g', 'weight', 'metric',
     'g', 'gram', 'grams',
     'g', 'gramo', 'gramos'),
    ('kg', 'weight', 'metric',
     'kg', 'kilogram', 'kilograms',
     'kg', 'kilogramo', 'kilogramos'),
    ('ml', 'volume', 'metric',
     'ml', 'milliliter', 'milliliters',
     'ml', 'mililitro', 'mililitros'),
    ('l', 'volume', 'metric',
     'l', 'liter', 'liters',
     'l', 'litro', 'litros'),
    
    -- Imperial units (different abbreviations per language)
    ('cup', 'volume', 'imperial',
     'cup', 'cup', 'cups',
     'tza.', 'taza', 'tazas'),
    ('tbsp', 'volume', 'imperial',
     'tbsp.', 'tablespoon', 'tablespoons',
     'cda.', 'cucharada', 'cucharadas'),
    ('tsp', 'volume', 'imperial',
     'tsp.', 'teaspoon', 'teaspoons',
     'cdta.', 'cucharadita', 'cucharaditas'),
    ('oz', 'weight', 'imperial',
     'oz.', 'ounce', 'ounces',
     'oz.', 'onza', 'onzas'),
    ('lb', 'weight', 'imperial',
     'lb', 'pound', 'pounds',
     'lb', 'libra', 'libras'),

    -- Universal units (no abbreviations needed)
    ('piece', 'unit', 'universal',
     'piece', 'piece', 'pieces',
     'unidad', 'unidad', 'unidades'),
    ('pinch', 'unit', 'universal',
     'pinch', 'pinch', 'pinches',
     'pizca', 'pizca', 'pizcas'),
    ('clove', 'unit', 'universal',
     'clove', 'clove', 'cloves',
     'diente', 'diente', 'dientes'),
    ('leaf', 'unit', 'universal',
     'leaf', 'leaf', 'leaves',
     'hoja', 'hoja', 'hojas'),
    ('sprig', 'unit', 'universal',
     'sprig', 'sprig', 'sprigs',
     'rama', 'rama', 'ramas'),
    ('slice', 'unit', 'universal',
     'slice', 'slice', 'slices',
     'rebanada', 'rebanada', 'rebanadas'),
    ('taste', 'unit', 'universal',
     'to taste', 'to taste', 'to taste',
     'al gusto', 'al gusto', 'al gusto');

-- Create a temporary mapping table to help with migration
CREATE TEMPORARY TABLE unit_mapping (
    old_unit TEXT,  -- Changed from measurement_unit to TEXT
    new_unit_id TEXT
);

-- Insert mappings from old enum values to new unit IDs
INSERT INTO unit_mapping (old_unit, new_unit_id) VALUES
    ('ml', 'ml'),
    ('l', 'l'),
    ('g', 'g'),
    ('kg', 'kg'),
    ('al gusto', 'taste'),
    ('taza', 'cup'),
    ('cdita', 'tsp'),
    ('cda', 'tbsp'),
    ('pizca', 'pinch'),
    ('rebanada', 'slice'),
    ('dientes', 'clove'),
    ('cubos', 'g'),
    ('hoja', 'leaf'),
    ('rama', 'sprig'),
    ('ramita', 'sprig');

-- Update recipe_ingredients to use the new unit_id
-- First, add the column allowing NULL
ALTER TABLE recipe_ingredients 
    ADD COLUMN unit_id TEXT;

-- Update the unit_id based on ingredients' base_unit
UPDATE recipe_ingredients ri 
SET unit_id = um.new_unit_id
FROM ingredients i
JOIN unit_mapping um ON i.base_unit_en = um.old_unit  -- This is now valid
WHERE ri.ingredient_id = i.id;

-- Make unit_id have FK constraint
ALTER TABLE recipe_ingredients 
    ADD CONSTRAINT fk_unit_id 
        FOREIGN KEY (unit_id) 
        REFERENCES measurement_units(id);

-- Clean up
-- Modify ingredients table
ALTER TABLE ingredients 
    DROP COLUMN base_unit_en,
    DROP COLUMN base_unit_plural_en,
    DROP COLUMN base_unit_es,
    DROP COLUMN base_unit_plural_es;

-- Modify recipe_ingredients table
ALTER TABLE recipe_ingredients
    DROP COLUMN custom_unit_en,
    DROP COLUMN custom_unit_es;

DROP TABLE unit_mapping;

-- Finally, drop the old enum types (this should be at the end of the file)
DROP TYPE IF EXISTS measurement_unit CASCADE;
DROP TYPE IF EXISTS measurement_unit_plural CASCADE;

-- If we got here, everything worked
RELEASE SAVEPOINT migration_start;

COMMIT;