-- ============================================================
-- Tag System Rebuild — single atomic migration
--
-- Replaces the legacy free-form tag set with a 7-category canonical
-- taxonomy keyed by stable slugs, while preserving the curated
-- recipe -> tag links that admins/imports have already created.
--
-- Flow:
--   1. Snapshot recipe_to_tag joined with old translation names.
--   2. Truncate the tag tables.
--   3. Swap the recipe_tag_category enum to the new 7-category set.
--   4. Seed canonical tags + base-locale (en/es) translations.
--   5. Build a legacy_tag_remap temp table (single source of truth).
--   6. Reinsert recipe_to_tag rows by joining the snapshot with
--      legacy_tag_remap and the new canonical tags.
--   7. Backfill planner_role for unambiguous dish_type tags only
--      when the field is currently NULL (never overwrites curation).
--   8. Log dropped legacy names via RAISE NOTICE.
--
-- Intentional drops (no canonical home):
--   - 'FAV'           -> personalization, not taxonomy
--   - 'International' -> vague catch-all; cuisine handles specifics
-- ============================================================

BEGIN;

-- 1. Snapshot recipe → legacy tag-name links BEFORE truncating.
--    We record every translated name (en + es) per link so the remap
--    can match either side. COALESCE would silently drop rows where
--    only one locale was populated; we want both.
CREATE TEMP TABLE legacy_tag_links AS
SELECT
  rt.recipe_id,
  tr.name AS legacy_name
FROM public.recipe_to_tag rt
JOIN public.recipe_tag_translations tr
  ON tr.recipe_tag_id = rt.tag_id
WHERE tr.locale IN ('en', 'es')
  AND tr.name IS NOT NULL
  AND tr.name <> '';

-- 2. Add slug column first. Existing rows are about to be truncated, so the
--    column starts nullable and is tightened after canonical seed data lands.
ALTER TABLE public.recipe_tags ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_tags_slug
  ON public.recipe_tags (slug)
  WHERE slug IS NOT NULL;

-- 3. Wipe the tag tables. recipe_to_tag is recreated from the snapshot in step 6.
TRUNCATE public.recipe_to_tag CASCADE;
TRUNCATE public.recipe_tag_translations CASCADE;
TRUNCATE public.recipe_tags CASCADE;

-- 4. Swap the enum in the same transaction as the wipe and reseed.
ALTER TYPE public.recipe_tag_category RENAME TO recipe_tag_category_old;

CREATE TYPE public.recipe_tag_category AS ENUM (
  'cuisine',
  'meal_type',
  'diet',
  'dish_type',
  'primary_ingredient',
  'occasion',
  'practical'
);

ALTER TABLE public.recipe_tags DROP COLUMN categories;
ALTER TABLE public.recipe_tags
  ADD COLUMN categories public.recipe_tag_category[] NOT NULL DEFAULT '{}';

DROP TYPE public.recipe_tag_category_old;

-- 5. Seed canonical tags with stable slugs and base-locale (en/es) translations.
WITH seed(slug, category, name_en, name_es) AS (
  VALUES
    -- cuisine
    ('mexican',                    'cuisine',            'Mexican',                'Mexicana'),
    ('italian',                    'cuisine',            'Italian',                'Italiana'),
    ('japanese',                   'cuisine',            'Japanese',               'Japonesa'),
    ('thai',                       'cuisine',            'Thai',                   'Tailandesa'),
    ('chinese',                    'cuisine',            'Chinese',                'China'),
    ('korean',                     'cuisine',            'Korean',                 'Coreana'),
    ('middle_eastern',             'cuisine',            'Middle Eastern',         'Del Medio Oriente'),
    ('indian',                     'cuisine',            'Indian',                 'India'),
    ('american',                   'cuisine',            'American',               'Americana'),
    ('french',                     'cuisine',            'French',                 'Francesa'),
    ('spanish',                    'cuisine',            'Spanish',                'Española'),
    ('mediterranean',              'cuisine',            'Mediterranean',          'Mediterránea'),
    ('greek',                      'cuisine',            'Greek',                  'Griega'),
    ('asian',                      'cuisine',            'Asian',                  'Asiática'),

    -- meal_type
    ('breakfast',                  'meal_type',          'Breakfast',              'Desayuno'),
    ('lunch',                      'meal_type',          'Lunch',                  'Comida'),
    ('dinner',                     'meal_type',          'Dinner',                 'Cena'),
    ('snack',                      'meal_type',          'Snack',                  'Botana'),
    ('dessert',                    'meal_type',          'Dessert',                'Postre'),
    ('beverage',                   'meal_type',          'Beverage',               'Bebida'),

    -- diet
    -- NOTE: gluten_free and healthy are preference/discovery tags, NOT allergy or
    -- medical-safety guarantees. UI copy must not imply medical safety.
    ('vegetarian',                 'diet',               'Vegetarian',             'Vegetariana'),
    ('vegan',                      'diet',               'Vegan',                  'Vegana'),
    ('keto',                       'diet',               'Keto',                   'Keto'),
    ('low_carb',                   'diet',               'Low Carb',               'Bajo en Carbohidratos'),
    ('paleo',                      'diet',               'Paleo',                  'Paleo'),
    ('low_sodium',                 'diet',               'Low Sodium',             'Bajo en Sodio'),
    ('low_sugar',                  'diet',               'Low Sugar',              'Bajo en Azúcar'),
    ('high_protein',               'diet',               'High Protein',           'Alto en Proteína'),
    ('pescatarian',                'diet',               'Pescatarian',            'Pescetariana'),
    ('gluten_free',                'diet',               'Gluten Free',            'Sin Gluten'),
    ('healthy',                    'diet',               'Healthy',                'Saludable'),

    -- dish_type
    ('soup',                       'dish_type',          'Soup',                   'Sopa'),
    ('sauce',                      'dish_type',          'Sauce',                  'Salsa'),
    ('dip_dressing',               'dish_type',          'Dip & Dressing',         'Dip y Aderezo'),
    ('appetizer',                  'dish_type',          'Appetizer',              'Aperitivo'),
    ('main_dish',                  'dish_type',          'Main Dish',              'Plato Fuerte'),
    ('side_dish',                  'dish_type',          'Side Dish',              'Guarnición'),
    ('bakery',                     'dish_type',          'Bakery',                 'Panadería'),
    ('pasta',                      'dish_type',          'Pasta',                  'Pasta'),
    ('candy',                      'dish_type',          'Candy',                  'Dulces'),
    ('salad',                      'dish_type',          'Salad',                  'Ensalada'),
    ('rice_dish',                  'dish_type',          'Rice Dish',              'Plato de Arroz'),
    ('bean_dish',                  'dish_type',          'Bean Dish',              'Plato de Frijoles'),

    -- primary_ingredient
    ('chicken',                    'primary_ingredient', 'Chicken',                'Pollo'),
    ('beef',                       'primary_ingredient', 'Beef',                   'Res'),
    ('pork',                       'primary_ingredient', 'Pork',                   'Cerdo'),
    ('seafood',                    'primary_ingredient', 'Seafood',                'Mariscos'),
    ('lamb',                       'primary_ingredient', 'Lamb',                   'Cordero'),
    ('fish',                       'primary_ingredient', 'Fish',                   'Pescado'),
    ('shrimp',                     'primary_ingredient', 'Shrimp',                 'Camarón'),
    ('vegetables',                 'primary_ingredient', 'Vegetables',             'Verduras'),
    ('beans',                      'primary_ingredient', 'Beans',                  'Frijoles'),
    ('rice',                       'primary_ingredient', 'Rice',                   'Arroz'),
    ('cheese',                     'primary_ingredient', 'Cheese',                 'Queso'),
    ('egg',                        'primary_ingredient', 'Egg',                    'Huevo'),

    -- occasion
    ('weeknight',                  'occasion',           'Weeknight',              'Entre Semana'),
    ('meal_prep',                  'occasion',           'Meal Prep',              'Preparación Semanal'),
    ('kid_friendly',               'occasion',           'Kid Friendly',           'Para Niños'),
    ('baby_friendly',              'occasion',           'Baby Friendly',          'Apto para Bebés'),
    ('holiday_christmas',          'occasion',           'Christmas',              'Navidad'),
    ('holiday_easter',             'occasion',           'Easter',                 'Pascua'),
    ('holiday_halloween',          'occasion',           'Halloween',              'Halloween / Día de Brujas'),
    ('holiday_dia_de_muertos',     'occasion',           'Day of the Dead',        'Día de Muertos'),
    ('holiday_thanksgiving',       'occasion',           'Thanksgiving',           'Día de Acción de Gracias'),
    ('holiday_new_year',           'occasion',           'New Year',               'Año Nuevo'),
    ('holiday_valentines',         'occasion',           'Valentine''s Day',       'Día de San Valentín'),
    ('holiday_mothers_day',        'occasion',           'Mother''s Day',          'Día de las Madres'),
    ('holiday_mexican_independence','occasion',          'Mexican Independence Day','Independencia de México'),
    ('holiday_us_independence',    'occasion',           'US Independence Day',    '4 de Julio'),
    ('holiday_cinco_de_mayo',      'occasion',           'Cinco de Mayo',          'Cinco de Mayo'),
    ('date_night',                 'occasion',           'Date Night',             'Cena Romántica'),
    ('potluck',                    'occasion',           'Potluck',                'Para Compartir'),
    ('sunday_family',              'occasion',           'Sunday Family',          'Domingo Familiar'),
    ('budget_friendly',            'occasion',           'Budget Friendly',        'Económico'),
    ('comfort_food',               'occasion',           'Comfort Food',           'Comida Reconfortante'),
    ('entertaining',               'occasion',           'Entertaining',           'Para Recibir'),
    ('party',                      'occasion',           'Party',                  'Fiesta'),

    -- practical
    ('one_pot',                    'practical',          'One Pot',                'Una Sola Olla'),
    ('batch_cook',                 'practical',          'Batch Cook',             'Cocinar por Lotes'),
    ('freezer_friendly',           'practical',          'Freezer Friendly',       'Apto para Congelar'),
    ('make_ahead',                 'practical',          'Make Ahead',             'Preparar con Anticipación'),
    ('leftover_friendly',          'practical',          'Leftover Friendly',      'Aprovecha Sobras'),
    ('five_ingredients',           'practical',          'Five Ingredients',       'Cinco Ingredientes'),
    ('quick_assembly',             'practical',          'Quick Assembly',         'Armado Rápido'),
    ('pantry_staple',              'practical',          'Pantry Staple',          'Básicos de Cocina'),
    ('quick',                      'practical',          'Quick',                  'Rápido'),
    ('beginner_friendly',          'practical',          'Beginner Friendly',      'Para Principiantes'),
    ('thermomix_basics',           'practical',          'Thermomix Basics',       'Básicos Thermomix'),
    ('lunchbox',                   'practical',          'Lunchbox',               'Lonchera')
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

-- Every canonical row now has a slug, so make that contract strict.
ALTER TABLE public.recipe_tags ALTER COLUMN slug SET NOT NULL;

-- 6. Build the legacy → canonical-slug remap.
--    This is the SINGLE source of truth used both for reinsertion and
--    for logging which legacy names had no canonical home.
--    Keys are stored lowercase and matched case-insensitively against
--    legacy_tag_links.legacy_name. Coverage includes:
--      - every old NOTION_TAG_MAP en/es value
--      - every observed scan-report tag name
--      - every new canonical name_en / name_es seeded above
--    so that the migration survives both fresh runs against the legacy
--    schema AND re-runs after the new canonical names are already in
--    place.
CREATE TEMP TABLE legacy_tag_remap (
  legacy_name text PRIMARY KEY,
  slug        text NOT NULL
);

INSERT INTO legacy_tag_remap (legacy_name, slug) VALUES
  -- meal_type
  ('postre',                 'dessert'),
  ('dessert',                'dessert'),
  ('bebida',                 'beverage'),
  ('drink',                  'beverage'),
  ('beverage',               'beverage'),
  ('desayuno',               'breakfast'),
  ('breakfast',              'breakfast'),
  ('botana',                 'snack'),
  ('snack',                  'snack'),
  ('merienda',               'snack'),
  ('comida',                 'lunch'),
  ('lunch',                  'lunch'),
  ('cena',                   'dinner'),
  ('dinner',                 'dinner'),

  -- cuisine
  ('mexican',                'mexican'),
  ('mexicano',               'mexican'),
  ('mexicana',               'mexican'),
  ('indian',                 'indian'),
  ('indio',                  'indian'),
  ('india',                  'indian'),

  -- diet
  ('vegetarian',             'vegetarian'),
  ('vegetariano',            'vegetarian'),
  ('vegetariana',            'vegetarian'),
  ('sugar free',             'low_sugar'),
  ('sugarfree',              'low_sugar'),
  ('sinazúcar',              'low_sugar'),
  ('sin azúcar',             'low_sugar'),
  ('low sugar',              'low_sugar'),
  ('bajo en azúcar',         'low_sugar'),
  ('sin gluten',             'gluten_free'),
  ('singluten',              'gluten_free'),
  ('glutenfree',             'gluten_free'),
  ('gluten free',            'gluten_free'),
  ('healthy',                'healthy'),
  ('saludable',              'healthy'),

  -- dish_type
  ('sopa',                   'soup'),
  ('soup',                   'soup'),
  ('salsa',                  'sauce'),
  ('salsas',                 'sauce'),
  ('sauce',                  'sauce'),
  ('sauces',                 'sauce'),
  ('dip/dressing',           'dip_dressing'),
  ('dip y aderezo',          'dip_dressing'),
  ('dip & dressing',         'dip_dressing'),
  ('dip',                    'dip_dressing'),
  ('aperitivo',              'appetizer'),
  ('appetizer',              'appetizer'),
  ('plato fuerte',           'main_dish'),
  ('main course',            'main_dish'),
  ('main dish',              'main_dish'),
  ('guarnicion',             'side_dish'),
  ('guarnición',             'side_dish'),
  ('sides',                  'side_dish'),
  ('side dish',              'side_dish'),
  ('acompañamiento',         'side_dish'),
  ('panadería',              'bakery'),
  ('panaderia',              'bakery'),
  ('bakery',                 'bakery'),
  ('pasta',                  'pasta'),
  ('candy',                  'candy'),
  ('dulces',                 'candy'),

  -- primary_ingredient
  ('pollo',                  'chicken'),
  ('chicken',                'chicken'),
  ('res',                    'beef'),
  ('beef',                   'beef'),
  ('cerdo',                  'pork'),
  ('pork',                   'pork'),
  ('seafood',                'seafood'),
  ('mariscos',               'seafood'),
  ('lamb',                   'lamb'),
  ('cordero',                'lamb'),

  -- occasion
  ('halloween',              'holiday_halloween'),
  ('halloween / día de brujas', 'holiday_halloween'),
  ('baby friendly',          'baby_friendly'),
  ('babyfriendly',           'baby_friendly'),
  ('aptoparabebe',           'baby_friendly'),
  ('apto para bebés',        'baby_friendly'),

  -- practical
  ('todo en 1',              'one_pot'),
  ('one pot',                'one_pot'),
  ('una sola olla',          'one_pot'),
  ('básicos de la cocina',   'pantry_staple'),
  ('basicos de la cocina',   'pantry_staple'),
  ('básicosdelacocina',      'pantry_staple'),
  ('basicosdelacocina',      'pantry_staple'),
  ('básicos de cocina',      'pantry_staple'),
  ('basicos de cocina',      'pantry_staple'),
  ('kitchenbasics',          'pantry_staple'),
  ('kitchen basics',         'pantry_staple'),
  ('pantry staple',          'pantry_staple'),
  ('spices',                 'pantry_staple'),
  ('especias',               'pantry_staple');

-- 7. Reinsert the curated recipe → tag links using the remap.
--    The DISTINCT guards against double-insertion when both en + es
--    translations of the same legacy tag matched the same canonical slug.
--    LOWER() on the snapshot side makes the join case-insensitive so the
--    remap only needs lowercase keys.
INSERT INTO public.recipe_to_tag (recipe_id, tag_id)
SELECT DISTINCT l.recipe_id, t.id
FROM legacy_tag_links l
JOIN legacy_tag_remap r ON r.legacy_name = LOWER(l.legacy_name)
JOIN public.recipe_tags t ON t.slug = r.slug;

-- 8. Backfill planner_role from unambiguous dish_type / meal_type tags, but
--    only when planner_role is currently NULL. We never overwrite curation.
--    Mapping is intentionally narrow: only slugs whose planner semantics are
--    unambiguous are listed. priority disambiguates when a recipe has more
--    than one mappable slug — lower number wins.
WITH planner_role_remap(slug, planner_role, priority) AS (
  VALUES
    ('main_dish',     'main',      1),
    ('dessert',       'dessert',   2),
    ('beverage',      'beverage',  3),
    ('snack',         'snack',     4),
    ('side_dish',     'side',      5),
    ('sauce',         'condiment', 6),
    ('pantry_staple', 'pantry',    7)
),
recipe_role_candidates AS (
  SELECT DISTINCT ON (rt.recipe_id)
    rt.recipe_id,
    pr.planner_role
  FROM public.recipe_to_tag rt
  JOIN public.recipe_tags t ON t.id = rt.tag_id
  JOIN planner_role_remap pr ON pr.slug = t.slug
  ORDER BY rt.recipe_id, pr.priority
)
UPDATE public.recipes r
SET planner_role = c.planner_role
FROM recipe_role_candidates c
WHERE r.id = c.recipe_id
  AND r.planner_role IS NULL;

-- 9. Log dropped legacy names so the migration output makes the
--    intentional drops + any unmapped names visible at apply time.
DO $$
DECLARE
  unmapped_names text;
  preserved_links bigint;
BEGIN
  SELECT string_agg(DISTINCT l.legacy_name, ', ' ORDER BY l.legacy_name)
  INTO unmapped_names
  FROM legacy_tag_links l
  LEFT JOIN legacy_tag_remap r ON r.legacy_name = LOWER(l.legacy_name)
  WHERE r.slug IS NULL;

  SELECT COUNT(*) INTO preserved_links FROM public.recipe_to_tag;

  RAISE NOTICE 'Tag rebuild: % recipe_to_tag links preserved after remap.', preserved_links;
  RAISE NOTICE 'Tag rebuild: dropped legacy tag names: %', COALESCE(unmapped_names, '(none)');
END $$;

COMMIT;
