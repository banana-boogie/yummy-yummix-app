-- Add thermomix_mode column to recipe_steps and user_recipe_steps.
-- Stored as free text to allow new modes without migrations.
-- Valid values: slow_cook, rice_cooker, sous_vide, fermentation, open_cooking, high_temperature, dough, turbo

ALTER TABLE recipe_steps
ADD COLUMN thermomix_mode TEXT NULL;

ALTER TABLE user_recipe_steps
ADD COLUMN thermomix_mode TEXT NULL;
