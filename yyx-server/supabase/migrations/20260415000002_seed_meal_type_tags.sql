-- Seed the canonical Meal Type tags so the admin My Week Setup picker has
-- real options out of the box. Runs as a separate migration from the enum
-- change because Postgres forbids using a newly-added enum value in the
-- same transaction that added it.
--
-- Idempotent, and non-destructive: if a tag with one of these names already
-- exists (e.g. "Postre" used as a dessert category tag), add MEAL_TYPE to
-- its categories array instead of creating a duplicate. A unique constraint
-- on (locale, lower(name)) means we can't have two tags with the same
-- translation, so upsert-by-name is the correct semantics.

DO $$
DECLARE
  r record;
  existing_id uuid;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('Breakfast', 'Desayuno'),
      ('Brunch',    'Brunch'),
      ('Lunch',     'Comida'),
      ('Dinner',    'Cena'),
      ('Snack',     'Botana'),
      ('Dessert',   'Postre')
    ) AS v(name_en, name_es)
  LOOP
    SELECT t.recipe_tag_id INTO existing_id
    FROM public.recipe_tag_translations t
    WHERE (t.locale = 'en' AND lower(t.name) = lower(r.name_en))
       OR (t.locale = 'es' AND lower(t.name) = lower(r.name_es))
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE public.recipe_tags
      SET categories = array_append(categories, 'MEAL_TYPE'::public.recipe_tag_category)
      WHERE id = existing_id
        AND NOT ('MEAL_TYPE' = ANY(categories));
    ELSE
      new_id := gen_random_uuid();
      INSERT INTO public.recipe_tags (id, categories)
        VALUES (new_id, ARRAY['MEAL_TYPE']::public.recipe_tag_category[]);
      INSERT INTO public.recipe_tag_translations (recipe_tag_id, locale, name)
        VALUES (new_id, 'en', r.name_en), (new_id, 'es', r.name_es);
    END IF;
  END LOOP;
END $$;
