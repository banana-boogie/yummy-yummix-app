-- ============================================================
-- Expand allergen_groups with derived products
-- ============================================================
--
-- The original seed (29 rows) covers raw ingredients but misses
-- derived products the AI commonly uses: soy sauce (gluten),
-- condensed milk (dairy), mayonnaise (eggs), etc.
-- These gaps let allergens slip through the prompt and post-gen scan.
--
-- All INSERTs use ON CONFLICT DO NOTHING so this is safe to re-run.

-- Add unique constraint (original table didn't have one)
ALTER TABLE allergen_groups
  ADD CONSTRAINT uq_allergen_groups_category_ingredient
  UNIQUE (category, ingredient_canonical);

-- NUTS (derived products)
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('nuts', 'brazil_nut', 'Brazil nut', 'nuez de Brasil'),
  ('nuts', 'peanut_butter', 'peanut butter', 'crema de cacahuate'),
  ('nuts', 'almond_milk', 'almond milk', 'leche de almendra'),
  ('nuts', 'almond_flour', 'almond flour', 'harina de almendra'),
  ('nuts', 'marzipan', 'marzipan', 'mazapán'),
  ('nuts', 'praline', 'praline', 'praliné'),
  ('nuts', 'nutella', 'Nutella', 'Nutella'),
  ('nuts', 'tahini', 'tahini', 'tahini')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- DAIRY (Mexican cheeses + derived products)
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('dairy', 'cream_cheese', 'cream cheese', 'queso crema'),
  ('dairy', 'sour_cream', 'sour cream', 'crema agria'),
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

-- EGGS (derived products)
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('eggs', 'mayonnaise', 'mayonnaise', 'mayonesa'),
  ('eggs', 'meringue', 'meringue', 'merengue'),
  ('eggs', 'aioli', 'aioli', 'alioli')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- SEAFOOD (common fish + sauces)
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  ('seafood', 'fish', 'fish', 'pescado'),
  ('seafood', 'salmon', 'salmon', 'salmón'),
  ('seafood', 'tuna', 'tuna', 'atún'),
  ('seafood', 'cod', 'cod', 'bacalao'),
  ('seafood', 'tilapia', 'tilapia', 'tilapia'),
  ('seafood', 'octopus', 'octopus', 'pulpo'),
  ('seafood', 'anchovy', 'anchovy', 'anchoa'),
  ('seafood', 'sardine', 'sardine', 'sardina'),
  ('seafood', 'fish_sauce', 'fish sauce', 'salsa de pescado'),
  ('seafood', 'oyster_sauce', 'oyster sauce', 'salsa de ostión'),
  ('seafood', 'surimi', 'surimi', 'surimi')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- GLUTEN (flours, pasta, sauces — the biggest gap)
INSERT INTO allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
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
  ('gluten', 'beer', 'beer', 'cerveza'),
  ('gluten', 'soy_sauce', 'soy sauce', 'salsa de soya'),
  ('gluten', 'teriyaki_sauce', 'teriyaki sauce', 'salsa teriyaki'),
  ('gluten', 'seitan', 'seitan', 'seitán'),
  ('gluten', 'bulgur', 'bulgur', 'bulgur'),
  ('gluten', 'orzo', 'orzo', 'orzo'),
  ('gluten', 'panko', 'panko', 'panko')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;
