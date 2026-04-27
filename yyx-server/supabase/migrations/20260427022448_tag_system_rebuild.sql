-- ============================================================
-- Tag System Rebuild - single atomic migration
-- ============================================================

-- 1. Add slug column first. Existing rows are about to be truncated, so the
--    column starts nullable and is tightened after canonical seed data lands.
ALTER TABLE public.recipe_tags ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_tags_slug
  ON public.recipe_tags (slug)
  WHERE slug IS NOT NULL;

-- 2. Wipe all tag data. The app is pre-launch and this rebuild intentionally
--    replaces the taxonomy from scratch.
TRUNCATE public.recipe_to_tag CASCADE;
TRUNCATE public.recipe_tag_translations CASCADE;
TRUNCATE public.recipe_tags CASCADE;

-- 3. Swap the enum in the same transaction as the wipe and reseed.
ALTER TYPE public.recipe_tag_category RENAME TO recipe_tag_category_old;

CREATE TYPE public.recipe_tag_category AS ENUM (
  'cuisine',
  'meal_type',
  'diet',
  'occasion',
  'practical'
);

ALTER TABLE public.recipe_tags DROP COLUMN categories;
ALTER TABLE public.recipe_tags
  ADD COLUMN categories public.recipe_tag_category[] NOT NULL DEFAULT '{}';

DROP TYPE public.recipe_tag_category_old;

-- 4. Seed canonical tags with stable slugs and base-locale translations.
WITH seed(slug, category, name_en, name_es) AS (
  VALUES
    ('mexican', 'cuisine', 'Mexican', 'Mexicana'),
    ('italian', 'cuisine', 'Italian', 'Italiana'),
    ('japanese', 'cuisine', 'Japanese', 'Japonesa'),
    ('thai', 'cuisine', 'Thai', 'Tailandesa'),
    ('chinese', 'cuisine', 'Chinese', 'China'),
    ('korean', 'cuisine', 'Korean', 'Coreana'),
    ('middle_eastern', 'cuisine', 'Middle Eastern', 'Del Medio Oriente'),
    ('indian', 'cuisine', 'Indian', 'India'),
    ('american', 'cuisine', 'American', 'Americana'),
    ('french', 'cuisine', 'French', 'Francesa'),
    ('spanish', 'cuisine', 'Spanish', 'Española'),
    ('mediterranean', 'cuisine', 'Mediterranean', 'Mediterránea'),
    ('greek', 'cuisine', 'Greek', 'Griega'),
    ('asian', 'cuisine', 'Asian', 'Asiática'),
    ('breakfast', 'meal_type', 'Breakfast', 'Desayuno'),
    ('lunch', 'meal_type', 'Lunch', 'Comida'),
    ('dinner', 'meal_type', 'Dinner', 'Cena'),
    ('snack', 'meal_type', 'Snack', 'Botana'),
    ('dessert', 'meal_type', 'Dessert', 'Postre'),
    ('beverage', 'meal_type', 'Beverage', 'Bebida'),
    ('vegetarian', 'diet', 'Vegetarian', 'Vegetariana'),
    ('vegan', 'diet', 'Vegan', 'Vegana'),
    ('keto', 'diet', 'Keto', 'Keto'),
    ('low_carb', 'diet', 'Low Carb', 'Bajo en Carbohidratos'),
    ('paleo', 'diet', 'Paleo', 'Paleo'),
    ('low_sodium', 'diet', 'Low Sodium', 'Bajo en Sodio'),
    ('low_sugar', 'diet', 'Low Sugar', 'Bajo en Azúcar'),
    ('high_protein', 'diet', 'High Protein', 'Alto en Proteína'),
    ('pescatarian', 'diet', 'Pescatarian', 'Pescetariana'),
    ('weeknight', 'occasion', 'Weeknight', 'Entre Semana'),
    ('meal_prep', 'occasion', 'Meal Prep', 'Preparación de Comidas'),
    ('kid_friendly', 'occasion', 'Kid Friendly', 'Para Niños'),
    ('holiday_christmas', 'occasion', 'Christmas', 'Navidad'),
    ('holiday_easter', 'occasion', 'Easter', 'Semana Santa'),
    ('date_night', 'occasion', 'Date Night', 'Noche de Pareja'),
    ('potluck', 'occasion', 'Potluck', 'Para Compartir'),
    ('sunday_family', 'occasion', 'Sunday Family Meal', 'Comida Familiar del Domingo'),
    ('budget_friendly', 'occasion', 'Budget Friendly', 'Económico'),
    ('comfort_food', 'occasion', 'Comfort Food', 'Comida Reconfortante'),
    ('one_pot', 'practical', 'One Pot', 'Una Sola Olla'),
    ('batch_cook', 'practical', 'Batch Cook', 'Cocinar en Lote'),
    ('freezer_friendly', 'practical', 'Freezer Friendly', 'Se Puede Congelar'),
    ('make_ahead', 'practical', 'Make Ahead', 'Preparar con Anticipación'),
    ('leftover_friendly', 'practical', 'Leftover Friendly', 'Bueno para Sobras'),
    ('five_ingredients', 'practical', '5 Ingredients or Less', '5 Ingredientes o Menos'),
    ('quick_assembly', 'practical', 'Quick Assembly', 'Armado Rápido')
),
inserted AS (
  INSERT INTO public.recipe_tags (id, slug, categories)
  SELECT
    gen_random_uuid(),
    seed.slug,
    ARRAY[seed.category::public.recipe_tag_category]
  FROM seed
  RETURNING id, slug
)
INSERT INTO public.recipe_tag_translations (recipe_tag_id, locale, name)
SELECT inserted.id, translations.locale, translations.name
FROM inserted
JOIN seed ON seed.slug = inserted.slug
CROSS JOIN LATERAL (
  VALUES
    ('en', seed.name_en),
    ('es', seed.name_es)
) AS translations(locale, name);

-- 5. Every canonical row now has a slug, so make that contract strict.
ALTER TABLE public.recipe_tags ALTER COLUMN slug SET NOT NULL;
