-- Migrate nutritional_facts JSONB column to typed ingredient_nutrition table.
-- Also drops unused recipes.nutritional_facts column.

-- 1. Create ingredient_nutrition table
CREATE TABLE public.ingredient_nutrition (
  ingredient_id UUID PRIMARY KEY REFERENCES public.ingredients(id) ON DELETE CASCADE,
  calories NUMERIC(5,1),
  protein NUMERIC(5,1),
  fat NUMERIC(5,1),
  carbohydrates NUMERIC(5,1),
  fiber NUMERIC(5,1),
  sugar NUMERIC(5,1),
  sodium NUMERIC(6,1),
  source TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Copy existing data from ingredients.nutritional_facts->'per_100g'
INSERT INTO public.ingredient_nutrition (ingredient_id, calories, protein, fat, carbohydrates, source)
SELECT
  id,
  (nutritional_facts->'per_100g'->>'calories')::NUMERIC(5,1),
  (nutritional_facts->'per_100g'->>'protein')::NUMERIC(5,1),
  (nutritional_facts->'per_100g'->>'fat')::NUMERIC(5,1),
  (nutritional_facts->'per_100g'->>'carbohydrates')::NUMERIC(5,1),
  'openai:gpt-4o-mini'
FROM public.ingredients
WHERE nutritional_facts IS NOT NULL
  AND nutritional_facts != '{}'::jsonb
  AND nutritional_facts->'per_100g' IS NOT NULL;

-- 3. Drop ingredients.nutritional_facts column
ALTER TABLE public.ingredients DROP COLUMN IF EXISTS nutritional_facts;

-- 4. Drop recipes.nutritional_facts column (unused)
ALTER TABLE public.recipes DROP COLUMN IF EXISTS nutritional_facts;

-- 5. RLS policies
ALTER TABLE public.ingredient_nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON public.ingredient_nutrition
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admin write access"
  ON public.ingredient_nutrition
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Replace admin_content_health() RPC to use new table
CREATE OR REPLACE FUNCTION public.admin_content_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH step_counts AS (
    SELECT recipe_id, count(*)::int AS cnt FROM recipe_steps GROUP BY recipe_id
  ),
  ingredient_counts AS (
    SELECT recipe_id, count(*)::int AS cnt FROM recipe_ingredients GROUP BY recipe_id
  ),
  recipe_issues AS (
    SELECT
      r.id,
      'recipe' AS entity_type,
      COALESCE(rt_en.name, rt_es.name, r.id::text) AS name,
      r.image_url,
      r.is_published,
      COALESCE(sc.cnt, 0) AS step_count,
      COALESCE(ic.cnt, 0) AS ingredient_count,
      (rt_en.recipe_id IS NULL) AS missing_en,
      (rt_es.recipe_id IS NULL) AS missing_es,
      (r.image_url IS NULL OR r.image_url = '') AS missing_image,
      false AS missing_nutrition
    FROM recipes r
    LEFT JOIN recipe_translations rt_en ON rt_en.recipe_id = r.id AND rt_en.locale = 'en'
    LEFT JOIN recipe_translations rt_es ON rt_es.recipe_id = r.id AND rt_es.locale = 'es'
    LEFT JOIN step_counts sc ON sc.recipe_id = r.id
    LEFT JOIN ingredient_counts ic ON ic.recipe_id = r.id
    WHERE rt_en.recipe_id IS NULL
       OR rt_es.recipe_id IS NULL
       OR r.image_url IS NULL OR r.image_url = ''
       OR r.is_published = false
  ),
  ingredient_issues AS (
    SELECT
      i.id,
      'ingredient' AS entity_type,
      COALESCE(it_en.name, it_es.name, i.id::text) AS name,
      i.image_url,
      null::boolean AS is_published,
      null::int AS step_count,
      null::int AS ingredient_count,
      (it_en.ingredient_id IS NULL) AS missing_en,
      (it_es.ingredient_id IS NULL) AS missing_es,
      (i.image_url IS NULL OR i.image_url = '') AS missing_image,
      (n.ingredient_id IS NULL) AS missing_nutrition
    FROM ingredients i
    LEFT JOIN ingredient_translations it_en ON it_en.ingredient_id = i.id AND it_en.locale = 'en'
    LEFT JOIN ingredient_translations it_es ON it_es.ingredient_id = i.id AND it_es.locale = 'es'
    LEFT JOIN ingredient_nutrition n ON n.ingredient_id = i.id
    WHERE it_en.ingredient_id IS NULL
       OR it_es.ingredient_id IS NULL
       OR i.image_url IS NULL OR i.image_url = ''
       OR n.ingredient_id IS NULL
  ),
  kitchen_tool_issues AS (
    SELECT
      kt.id,
      'useful_item' AS entity_type,
      COALESCE(kt_en.name, kt_es.name, kt.id::text) AS name,
      kt.image_url,
      null::boolean AS is_published,
      null::int AS step_count,
      null::int AS ingredient_count,
      (kt_en.kitchen_tool_id IS NULL) AS missing_en,
      (kt_es.kitchen_tool_id IS NULL) AS missing_es,
      (kt.image_url IS NULL OR kt.image_url = '') AS missing_image,
      false AS missing_nutrition
    FROM kitchen_tools kt
    LEFT JOIN kitchen_tool_translations kt_en ON kt_en.kitchen_tool_id = kt.id AND kt_en.locale = 'en'
    LEFT JOIN kitchen_tool_translations kt_es ON kt_es.kitchen_tool_id = kt.id AND kt_es.locale = 'es'
    WHERE kt_en.kitchen_tool_id IS NULL
       OR kt_es.kitchen_tool_id IS NULL
       OR kt.image_url IS NULL OR kt.image_url = ''
  ),
  all_issues AS (
    SELECT * FROM recipe_issues
    UNION ALL
    SELECT * FROM ingredient_issues
    UNION ALL
    SELECT * FROM kitchen_tool_issues
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'missingTranslations', jsonb_build_object(
        'total', (SELECT count(*)::int FROM all_issues WHERE missing_en OR missing_es),
        'recipes', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'recipe' AND (missing_en OR missing_es)),
        'ingredients', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'ingredient' AND (missing_en OR missing_es)),
        'usefulItems', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'useful_item' AND (missing_en OR missing_es))
      ),
      'missingImages', jsonb_build_object(
        'total', (SELECT count(*)::int FROM all_issues WHERE missing_image),
        'recipes', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'recipe' AND missing_image),
        'ingredients', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'ingredient' AND missing_image),
        'usefulItems', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'useful_item' AND missing_image)
      ),
      'missingNutrition', jsonb_build_object(
        'total', (SELECT count(*)::int FROM all_issues WHERE missing_nutrition),
        'ingredients', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'ingredient' AND missing_nutrition)
      ),
      'unpublished', jsonb_build_object(
        'total', (SELECT count(*)::int FROM all_issues WHERE is_published = false),
        'recipes', (SELECT count(*)::int FROM all_issues WHERE entity_type = 'recipe' AND is_published = false)
      )
    ),
    'issues', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'entityType', entity_type,
          'name', name,
          'imageUrl', image_url,
          'isPublished', is_published,
          'stepCount', step_count,
          'ingredientCount', ingredient_count,
          'missingEn', missing_en,
          'missingEs', missing_es,
          'missingImage', missing_image,
          'missingNutrition', missing_nutrition
        )
        ORDER BY entity_type, name
      )
      FROM all_issues
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;
