-- Add missing allergen_groups table
-- The original migration (20260122000000_irmixy_ai_foundation) may have partially
-- failed but was still recorded as applied.

-- ============================================================
-- Allergen Groups (rule-based allergen filtering)
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

-- Only create policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'allergen_groups'
        AND policyname = 'Anyone can read allergen groups'
    ) THEN
        CREATE POLICY "Anyone can read allergen groups"
            ON "public"."allergen_groups" FOR SELECT
            TO authenticated, anon
            USING (true);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_allergen_groups_category ON allergen_groups (category);

-- Only insert seed data if table is empty
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es)
SELECT * FROM (VALUES
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
('seafood', 'squid', 'Squid', 'Calamar')
) AS v(category, ingredient_canonical, name_en, name_es)
WHERE NOT EXISTS (SELECT 1 FROM allergen_groups LIMIT 1);
