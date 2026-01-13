-- Migration: Add symbol plural columns to measurement_units
-- This allows units like "clove" to display as "cloves" for plural
-- while units like "g" stay as "g" for both singular and plural

-- Step 1: Add new columns
ALTER TABLE measurement_units 
ADD COLUMN IF NOT EXISTS symbol_en_plural TEXT,
ADD COLUMN IF NOT EXISTS symbol_es_plural TEXT;

-- Step 2: Update existing data - copy symbol to symbol_plural by default
UPDATE measurement_units SET symbol_en_plural = symbol_en WHERE symbol_en_plural IS NULL;
UPDATE measurement_units SET symbol_es_plural = symbol_es WHERE symbol_es_plural IS NULL;

-- Step 3: Update specific units that need different plural symbols
-- English
UPDATE measurement_units SET symbol_en_plural = 'cloves' WHERE id = 'clove';
UPDATE measurement_units SET symbol_en_plural = 'cups' WHERE id = 'cup';
UPDATE measurement_units SET symbol_en_plural = 'leaves' WHERE id = 'leaf';
UPDATE measurement_units SET symbol_en_plural = 'pieces' WHERE id = 'piece';
UPDATE measurement_units SET symbol_en_plural = 'pinches' WHERE id = 'pinch';
UPDATE measurement_units SET symbol_en_plural = 'slices' WHERE id = 'slice';
UPDATE measurement_units SET symbol_en_plural = 'sprigs' WHERE id = 'sprig';
UPDATE measurement_units SET symbol_en_plural = 'units' WHERE id = 'unit';

-- Spanish
UPDATE measurement_units SET symbol_es_plural = 'dientes' WHERE id = 'clove';
UPDATE measurement_units SET symbol_es_plural = 'tzas.' WHERE id = 'cup';
UPDATE measurement_units SET symbol_es_plural = 'hojas' WHERE id = 'leaf';
UPDATE measurement_units SET symbol_es_plural = 'unidades' WHERE id = 'piece';
UPDATE measurement_units SET symbol_es_plural = 'pizcas' WHERE id = 'pinch';
UPDATE measurement_units SET symbol_es_plural = 'rebanadas' WHERE id = 'slice';
UPDATE measurement_units SET symbol_es_plural = 'ramas' WHERE id = 'sprig';
UPDATE measurement_units SET symbol_es_plural = 'unidades' WHERE id = 'unit';
