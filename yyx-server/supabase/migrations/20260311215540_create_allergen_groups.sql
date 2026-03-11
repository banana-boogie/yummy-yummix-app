-- ============================================================
-- Create allergen_groups table
-- ============================================================
--
-- Maps allergen categories (from food_allergies) to specific
-- ingredient names. Used by:
-- 1. System prompt builder — tells the AI which ingredients to avoid
-- 2. Allergen filter — runtime scan of recipes/ingredients
-- 3. Post-generation allergen scan — safety net on AI output
--
-- Single source of truth for allergen-to-ingredient mapping.
-- Both EN and ES names so prompts work in the user's language.

CREATE TABLE IF NOT EXISTS allergen_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL REFERENCES food_allergies(slug),
  ingredient_canonical text NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (category, ingredient_canonical)
);

COMMENT ON TABLE allergen_groups IS 'Maps allergen categories to specific ingredient names for AI prompt building and runtime allergen filtering.';
COMMENT ON COLUMN allergen_groups.category IS 'FK to food_allergies.slug (e.g., nuts, dairy, gluten)';
COMMENT ON COLUMN allergen_groups.ingredient_canonical IS 'Normalized ingredient name for matching (e.g., peanut, soy_sauce)';
COMMENT ON COLUMN allergen_groups.name_en IS 'Human-readable English name for prompts and warnings';
COMMENT ON COLUMN allergen_groups.name_es IS 'Human-readable Spanish name for prompts and warnings';

-- ============================================================
-- RLS: read-only lookup table
-- ============================================================

ALTER TABLE allergen_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read allergen_groups"
  ON allergen_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon users to read allergen_groups"
  ON allergen_groups FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- Seed data
-- ============================================================
-- Categories match food_allergies.slug values.
-- Ingredient names are the most common items in Mexican/Latin cooking.

-- NUTS
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('nuts', 'peanut', 'peanut', 'cacahuate'),
  ('nuts', 'almond', 'almond', 'almendra'),
  ('nuts', 'walnut', 'walnut', 'nuez'),
  ('nuts', 'pecan', 'pecan', 'nuez pecana'),
  ('nuts', 'cashew', 'cashew', 'anacardo'),
  ('nuts', 'pistachio', 'pistachio', 'pistache'),
  ('nuts', 'hazelnut', 'hazelnut', 'avellana'),
  ('nuts', 'macadamia', 'macadamia', 'macadamia'),
  ('nuts', 'pine_nut', 'pine nut', 'piñón'),
  ('nuts', 'brazil_nut', 'Brazil nut', 'nuez de Brasil'),
  ('nuts', 'peanut_butter', 'peanut butter', 'crema de cacahuate'),
  ('nuts', 'almond_milk', 'almond milk', 'leche de almendra'),
  ('nuts', 'almond_flour', 'almond flour', 'harina de almendra'),
  ('nuts', 'marzipan', 'marzipan', 'mazapán'),
  ('nuts', 'praline', 'praline', 'praliné'),
  ('nuts', 'nutella', 'Nutella', 'Nutella'),
  ('nuts', 'tahini', 'tahini', 'tahini')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- DAIRY
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('dairy', 'milk', 'milk', 'leche'),
  ('dairy', 'butter', 'butter', 'mantequilla'),
  ('dairy', 'cheese', 'cheese', 'queso'),
  ('dairy', 'cream', 'cream', 'crema'),
  ('dairy', 'cream_cheese', 'cream cheese', 'queso crema'),
  ('dairy', 'sour_cream', 'sour cream', 'crema agria'),
  ('dairy', 'yogurt', 'yogurt', 'yogur'),
  ('dairy', 'whey', 'whey', 'suero de leche'),
  ('dairy', 'ghee', 'ghee', 'ghee'),
  ('dairy', 'condensed_milk', 'condensed milk', 'leche condensada'),
  ('dairy', 'evaporated_milk', 'evaporated milk', 'leche evaporada'),
  ('dairy', 'heavy_cream', 'heavy cream', 'crema para batir'),
  ('dairy', 'parmesan', 'Parmesan', 'parmesano'),
  ('dairy', 'mozzarella', 'mozzarella', 'mozzarella'),
  ('dairy', 'ricotta', 'ricotta', 'ricotta'),
  ('dairy', 'mascarpone', 'mascarpone', 'mascarpone'),
  ('dairy', 'oaxaca_cheese', 'Oaxaca cheese', 'queso Oaxaca'),
  ('dairy', 'panela_cheese', 'panela cheese', 'queso panela'),
  ('dairy', 'cotija_cheese', 'cotija cheese', 'queso cotija'),
  ('dairy', 'whipped_cream', 'whipped cream', 'crema batida')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- EGGS
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('eggs', 'egg', 'egg', 'huevo'),
  ('eggs', 'egg_white', 'egg white', 'clara de huevo'),
  ('eggs', 'egg_yolk', 'egg yolk', 'yema de huevo'),
  ('eggs', 'mayonnaise', 'mayonnaise', 'mayonesa'),
  ('eggs', 'meringue', 'meringue', 'merengue'),
  ('eggs', 'aioli', 'aioli', 'alioli')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- SEAFOOD
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('seafood', 'shrimp', 'shrimp', 'camarón'),
  ('seafood', 'fish', 'fish', 'pescado'),
  ('seafood', 'salmon', 'salmon', 'salmón'),
  ('seafood', 'tuna', 'tuna', 'atún'),
  ('seafood', 'cod', 'cod', 'bacalao'),
  ('seafood', 'tilapia', 'tilapia', 'tilapia'),
  ('seafood', 'crab', 'crab', 'cangrejo'),
  ('seafood', 'lobster', 'lobster', 'langosta'),
  ('seafood', 'clam', 'clam', 'almeja'),
  ('seafood', 'mussel', 'mussel', 'mejillón'),
  ('seafood', 'oyster', 'oyster', 'ostión'),
  ('seafood', 'squid', 'squid', 'calamar'),
  ('seafood', 'octopus', 'octopus', 'pulpo'),
  ('seafood', 'anchovy', 'anchovy', 'anchoa'),
  ('seafood', 'sardine', 'sardine', 'sardina'),
  ('seafood', 'fish_sauce', 'fish sauce', 'salsa de pescado'),
  ('seafood', 'oyster_sauce', 'oyster sauce', 'salsa de ostión'),
  ('seafood', 'surimi', 'surimi', 'surimi')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- GLUTEN
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('gluten', 'wheat', 'wheat', 'trigo'),
  ('gluten', 'wheat_flour', 'wheat flour', 'harina de trigo'),
  ('gluten', 'all_purpose_flour', 'all-purpose flour', 'harina para todo uso'),
  ('gluten', 'bread_flour', 'bread flour', 'harina de fuerza'),
  ('gluten', 'semolina', 'semolina', 'sémola'),
  ('gluten', 'couscous', 'couscous', 'cuscús'),
  ('gluten', 'pasta', 'pasta', 'pasta'),
  ('gluten', 'spaghetti', 'spaghetti', 'espagueti'),
  ('gluten', 'bread', 'bread', 'pan'),
  ('gluten', 'breadcrumbs', 'breadcrumbs', 'pan molido'),
  ('gluten', 'flour_tortilla', 'flour tortilla', 'tortilla de harina'),
  ('gluten', 'barley', 'barley', 'cebada'),
  ('gluten', 'rye', 'rye', 'centeno'),
  ('gluten', 'beer', 'beer', 'cerveza'),
  ('gluten', 'soy_sauce', 'soy sauce', 'salsa de soya'),
  ('gluten', 'teriyaki_sauce', 'teriyaki sauce', 'salsa teriyaki'),
  ('gluten', 'seitan', 'seitan', 'seitán'),
  ('gluten', 'bulgur', 'bulgur', 'bulgur'),
  ('gluten', 'orzo', 'orzo', 'orzo'),
  ('gluten', 'panko', 'panko', 'panko')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- Index for fast category lookups (used by allergen filter)
CREATE INDEX IF NOT EXISTS idx_allergen_groups_category
  ON allergen_groups (category);
