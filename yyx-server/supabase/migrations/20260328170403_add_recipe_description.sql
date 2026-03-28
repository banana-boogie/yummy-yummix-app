-- Add description field for catalog recipes (stored per-locale in recipe_translations).
-- user_recipes already has a description column.

ALTER TABLE recipe_translations ADD COLUMN description TEXT;
