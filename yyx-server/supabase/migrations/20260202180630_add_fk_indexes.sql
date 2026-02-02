-- Add indexes for unindexed foreign keys
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

-- ai_voice_sessions
CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_user_id
ON ai_voice_sessions(user_id);

-- recipe_ingredients
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id
ON recipe_ingredients(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_measurement_unit_id
ON recipe_ingredients(measurement_unit_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
ON recipe_ingredients(recipe_id);

-- recipe_step_ingredients
CREATE INDEX IF NOT EXISTS idx_recipe_step_ingredients_ingredient_id
ON recipe_step_ingredients(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_recipe_step_ingredients_measurement_unit_id
ON recipe_step_ingredients(measurement_unit_id);

CREATE INDEX IF NOT EXISTS idx_recipe_step_ingredients_recipe_id
ON recipe_step_ingredients(recipe_id);

-- user_chat_sessions
CREATE INDEX IF NOT EXISTS idx_user_chat_sessions_user_id
ON user_chat_sessions(user_id);

-- user_recipes
CREATE INDEX IF NOT EXISTS idx_user_recipes_original_recipe_id
ON user_recipes(original_recipe_id);
