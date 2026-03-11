-- Add tip column to user_recipe_steps for AI-generated step tips.
-- Single column (not bilingual) because AI generates in the user's language.
ALTER TABLE user_recipe_steps ADD COLUMN tip TEXT;
