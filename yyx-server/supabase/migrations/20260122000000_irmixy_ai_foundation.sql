-- Irmixy AI Foundation Migration
-- Creates tables for ingredient normalization, allergen filtering,
-- food safety validation, and cooking session tracking.

-- ============================================================
-- 1. Ingredient Aliases (bilingual normalization)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."ingredient_aliases" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    "canonical" text NOT NULL,
    "alias" text NOT NULL,
    "language" text NOT NULL CHECK (language IN ('en', 'es')),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."ingredient_aliases" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ingredient aliases"
    ON "public"."ingredient_aliases" FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE INDEX idx_ingredient_aliases_alias ON ingredient_aliases (lower(alias));
CREATE INDEX idx_ingredient_aliases_canonical ON ingredient_aliases (canonical);
CREATE UNIQUE INDEX idx_ingredient_aliases_unique ON ingredient_aliases (lower(alias), language);

-- Seed ingredient aliases
INSERT INTO ingredient_aliases (canonical, alias, language) VALUES
-- Bell pepper
('bell_pepper', 'bell pepper', 'en'),
('bell_pepper', 'capsicum', 'en'),
('bell_pepper', 'sweet pepper', 'en'),
('bell_pepper', 'pimiento', 'es'),
('bell_pepper', 'pimentón', 'es'),
-- Coriander/Cilantro
('coriander', 'cilantro', 'en'),
('coriander', 'coriander', 'en'),
('coriander', 'fresh coriander', 'en'),
('coriander', 'cilantro', 'es'),
('coriander', 'culantro', 'es'),
-- Zucchini
('zucchini', 'zucchini', 'en'),
('zucchini', 'courgette', 'en'),
('zucchini', 'calabacín', 'es'),
('zucchini', 'calabacita', 'es'),
-- Eggplant
('eggplant', 'eggplant', 'en'),
('eggplant', 'aubergine', 'en'),
('eggplant', 'berenjena', 'es'),
-- Green onion
('green_onion', 'green onion', 'en'),
('green_onion', 'scallion', 'en'),
('green_onion', 'spring onion', 'en'),
('green_onion', 'cebollín', 'es'),
('green_onion', 'cebolla de verdeo', 'es'),
-- Chicken
('chicken', 'chicken', 'en'),
('chicken', 'pollo', 'es'),
-- Garlic
('garlic', 'garlic', 'en'),
('garlic', 'ajo', 'es'),
-- Onion
('onion', 'onion', 'en'),
('onion', 'cebolla', 'es'),
-- Tomato
('tomato', 'tomato', 'en'),
('tomato', 'tomate', 'es'),
('tomato', 'jitomate', 'es'),
-- Butter
('butter', 'butter', 'en'),
('butter', 'mantequilla', 'es'),
-- Milk
('milk', 'milk', 'en'),
('milk', 'leche', 'es'),
-- Cheese
('cheese', 'cheese', 'en'),
('cheese', 'queso', 'es'),
-- Peanut
('peanut', 'peanut', 'en'),
('peanut', 'cacahuate', 'es'),
('peanut', 'maní', 'es'),
-- Almond
('almond', 'almond', 'en'),
('almond', 'almendra', 'es'),
-- Shrimp
('shrimp', 'shrimp', 'en'),
('shrimp', 'prawn', 'en'),
('shrimp', 'camarón', 'es'),
('shrimp', 'gamba', 'es');

-- ============================================================
-- 2. Allergen Groups (rule-based allergen filtering)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."allergen_groups" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    "category" text NOT NULL,
    "ingredient_canonical" text NOT NULL,
    "name_en" text NOT NULL,
    "name_es" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."allergen_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read allergen groups"
    ON "public"."allergen_groups" FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE INDEX idx_allergen_groups_category ON allergen_groups (category);

-- Seed allergen groups
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
-- Nuts
('nuts', 'almond', 'Almond', 'Almendra'),
('nuts', 'peanut', 'Peanut', 'Cacahuate'),
('nuts', 'walnut', 'Walnut', 'Nuez'),
('nuts', 'cashew', 'Cashew', 'Anacardo'),
('nuts', 'pistachio', 'Pistachio', 'Pistacho'),
('nuts', 'pecan', 'Pecan', 'Nuez pecana'),
('nuts', 'hazelnut', 'Hazelnut', 'Avellana'),
('nuts', 'macadamia', 'Macadamia', 'Macadamia'),
('nuts', 'pine_nut', 'Pine nut', 'Piñón'),
-- Dairy
('dairy', 'milk', 'Milk', 'Leche'),
('dairy', 'cheese', 'Cheese', 'Queso'),
('dairy', 'butter', 'Butter', 'Mantequilla'),
('dairy', 'cream', 'Cream', 'Crema'),
('dairy', 'yogurt', 'Yogurt', 'Yogur'),
('dairy', 'whey', 'Whey', 'Suero de leche'),
-- Gluten
('gluten', 'wheat', 'Wheat', 'Trigo'),
('gluten', 'barley', 'Barley', 'Cebada'),
('gluten', 'rye', 'Rye', 'Centeno'),
('gluten', 'spelt', 'Spelt', 'Espelta'),
-- Eggs
('eggs', 'egg', 'Egg', 'Huevo'),
('eggs', 'egg_white', 'Egg white', 'Clara de huevo'),
('eggs', 'egg_yolk', 'Egg yolk', 'Yema de huevo'),
-- Seafood
('seafood', 'shrimp', 'Shrimp', 'Camarón'),
('seafood', 'crab', 'Crab', 'Cangrejo'),
('seafood', 'lobster', 'Lobster', 'Langosta'),
('seafood', 'mussel', 'Mussel', 'Mejillón'),
('seafood', 'oyster', 'Oyster', 'Ostra'),
('seafood', 'clam', 'Clam', 'Almeja'),
('seafood', 'squid', 'Squid', 'Calamar');

-- ============================================================
-- 3. Food Safety Rules (USDA minimums)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."food_safety_rules" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    "ingredient_canonical" text NOT NULL,
    "category" text NOT NULL,
    "min_temp_c" integer NOT NULL,
    "min_temp_f" integer NOT NULL,
    "min_cook_min" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."food_safety_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read food safety rules"
    ON "public"."food_safety_rules" FOR SELECT
    TO authenticated, anon
    USING (true);

-- Seed food safety rules
INSERT INTO food_safety_rules (ingredient_canonical, category, min_temp_c, min_temp_f, min_cook_min) VALUES
('chicken', 'poultry', 74, 165, 10),
('turkey', 'poultry', 74, 165, 10),
('duck', 'poultry', 74, 165, 10),
('ground_beef', 'ground_meat', 71, 160, 8),
('ground_pork', 'ground_meat', 71, 160, 8),
('ground_turkey', 'ground_meat', 74, 165, 8),
('beef', 'whole_meat', 63, 145, 15),
('pork', 'whole_meat', 63, 145, 15),
('lamb', 'whole_meat', 63, 145, 15),
('salmon', 'fish', 63, 145, 8),
('tuna', 'fish', 63, 145, 8),
('shrimp', 'shellfish', 63, 145, 5);

-- ============================================================
-- 4. Cooking Sessions (progress tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."cooking_sessions" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "recipe_id" uuid,
    "recipe_type" text NOT NULL DEFAULT 'database' CHECK (recipe_type IN ('database', 'custom')),
    "recipe_name" text,
    "current_step" integer NOT NULL DEFAULT 1,
    "total_steps" integer NOT NULL,
    "status" text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."cooking_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cooking sessions"
    ON "public"."cooking_sessions" FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cooking_sessions_user_status ON cooking_sessions (user_id, status);

-- Function to mark stale cooking sessions as abandoned
CREATE OR REPLACE FUNCTION mark_stale_cooking_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE cooking_sessions
    SET status = 'abandoned'
    WHERE status = 'active'
      AND last_active_at < now() - interval '24 hours';
END;
$$;
