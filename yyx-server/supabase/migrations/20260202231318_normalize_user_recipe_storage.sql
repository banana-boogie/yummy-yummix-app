-- Normalize Custom Recipe Storage
-- Replace JSONB storage with normalized tables that mirror official recipe tables.
-- This allows custom recipes to use the same Recipe TypeScript type as official recipes.

-- ============================================================
-- USER_RECIPE_STEPS (mirrors recipe_steps)
-- ============================================================
CREATE TABLE user_recipe_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_recipe_id UUID NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    instruction_en TEXT NOT NULL,
    instruction_es TEXT,
    recipe_section_en TEXT DEFAULT 'Main',
    recipe_section_es TEXT DEFAULT 'Principal',
    -- Thermomix parameters stored as TEXT for AI flexibility
    -- AI outputs: time in seconds (int), temp as "100°C" or "Varoma", speed as "5" or "Spoon"
    thermomix_time INTEGER,
    thermomix_speed TEXT,
    thermomix_temperature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_recipe_id, step_order)
);

CREATE INDEX idx_user_recipe_steps_recipe ON user_recipe_steps(user_recipe_id);

-- ============================================================
-- USER_RECIPE_INGREDIENTS (mirrors recipe_ingredients)
-- ============================================================
CREATE TABLE user_recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_recipe_id UUID NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
    -- Optional link to canonical ingredient (for images, nutrition)
    ingredient_id UUID REFERENCES ingredients(id),
    name_en TEXT NOT NULL,
    name_es TEXT,
    quantity DECIMAL(10,2) NOT NULL,
    -- For AI recipes, we store unit as text since AI generates natural language units
    -- measurement_unit_id is TEXT to match measurement_units.id type (optional, for future matching)
    measurement_unit_id TEXT REFERENCES measurement_units(id),
    unit_text TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    recipe_section_en TEXT DEFAULT 'Main',
    recipe_section_es TEXT DEFAULT 'Principal',
    notes TEXT,
    optional BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_recipe_id, display_order)
);

CREATE INDEX idx_user_recipe_ingredients_recipe ON user_recipe_ingredients(user_recipe_id);
CREATE INDEX idx_user_recipe_ingredients_ingredient ON user_recipe_ingredients(ingredient_id) WHERE ingredient_id IS NOT NULL;

-- ============================================================
-- USER_RECIPE_STEP_INGREDIENTS (mirrors recipe_step_ingredients)
-- Links steps to ingredients used in that step
-- ============================================================
CREATE TABLE user_recipe_step_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_recipe_step_id UUID NOT NULL REFERENCES user_recipe_steps(id) ON DELETE CASCADE,
    user_recipe_ingredient_id UUID NOT NULL REFERENCES user_recipe_ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2),
    display_order INTEGER NOT NULL DEFAULT 0,
    optional BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_recipe_step_ingredients_step ON user_recipe_step_ingredients(user_recipe_step_id);
CREATE INDEX idx_user_recipe_step_ingredients_ingredient ON user_recipe_step_ingredients(user_recipe_ingredient_id);

-- ============================================================
-- USER_RECIPE_TAGS
-- ============================================================
CREATE TABLE user_recipe_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_recipe_id UUID NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_recipe_id, tag_name)
);

CREATE INDEX idx_user_recipe_tags_recipe ON user_recipe_tags(user_recipe_id);

-- ============================================================
-- USER_RECIPE_USEFUL_ITEMS
-- Links recipes to suggested equipment/tools
-- ============================================================
CREATE TABLE user_recipe_useful_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_recipe_id UUID NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
    useful_item_id UUID REFERENCES useful_items(id),
    name TEXT NOT NULL,
    image_url TEXT,
    notes TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_recipe_useful_items_recipe ON user_recipe_useful_items(user_recipe_id);

-- ============================================================
-- UPDATE user_recipes (add metadata columns)
-- Keep recipe_data for backward compatibility during migration
-- ============================================================
ALTER TABLE user_recipes
    ADD COLUMN IF NOT EXISTS total_time INTEGER,
    ADD COLUMN IF NOT EXISTS prep_time INTEGER,
    ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    ADD COLUMN IF NOT EXISTS portions INTEGER DEFAULT 4,
    ADD COLUMN IF NOT EXISTS measurement_system TEXT CHECK (measurement_system IN ('imperial', 'metric')),
    ADD COLUMN IF NOT EXISTS language TEXT CHECK (language IN ('en', 'es')) DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '1.0';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE user_recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_step_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_useful_items ENABLE ROW LEVEL SECURITY;

-- Access controlled via parent user_recipes ownership
CREATE POLICY "user_recipe_steps_policy" ON user_recipe_steps
    FOR ALL TO authenticated
    USING (user_recipe_id IN (SELECT id FROM user_recipes WHERE user_id = auth.uid()));

CREATE POLICY "user_recipe_ingredients_policy" ON user_recipe_ingredients
    FOR ALL TO authenticated
    USING (user_recipe_id IN (SELECT id FROM user_recipes WHERE user_id = auth.uid()));

CREATE POLICY "user_recipe_step_ingredients_policy" ON user_recipe_step_ingredients
    FOR ALL TO authenticated
    USING (user_recipe_step_id IN (
        SELECT urs.id FROM user_recipe_steps urs
        JOIN user_recipes ur ON ur.id = urs.user_recipe_id
        WHERE ur.user_id = auth.uid()
    ));

CREATE POLICY "user_recipe_tags_policy" ON user_recipe_tags
    FOR ALL TO authenticated
    USING (user_recipe_id IN (SELECT id FROM user_recipes WHERE user_id = auth.uid()));

CREATE POLICY "user_recipe_useful_items_policy" ON user_recipe_useful_items
    FOR ALL TO authenticated
    USING (user_recipe_id IN (SELECT id FROM user_recipes WHERE user_id = auth.uid()));

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================
CREATE OR REPLACE TRIGGER update_user_recipe_steps_updated_at
    BEFORE UPDATE ON user_recipe_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_user_recipe_ingredients_updated_at
    BEFORE UPDATE ON user_recipe_ingredients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE user_recipe_steps IS 'Normalized steps for AI-generated recipes. Mirrors recipe_steps structure.';
COMMENT ON TABLE user_recipe_ingredients IS 'Normalized ingredients for AI-generated recipes. Mirrors recipe_ingredients structure.';
COMMENT ON TABLE user_recipe_step_ingredients IS 'Links steps to ingredients used in that step. For showing ingredient images during cooking.';
COMMENT ON TABLE user_recipe_tags IS 'Tags/categories for custom recipes (e.g., "quick", "healthy", "comfort food").';
COMMENT ON TABLE user_recipe_useful_items IS 'Suggested equipment/tools for the recipe.';
COMMENT ON COLUMN user_recipes.schema_version IS 'Schema version: 1.0 = JSONB recipe_data, 2.0 = normalized tables';
