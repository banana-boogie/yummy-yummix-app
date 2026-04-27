-- Migration: Add recipe_nutrition_summary + compute / percentile RPCs
-- Track G (nutrition infrastructure). Per-recipe computed nutrition
-- totals (per portion), plus meal-type percentile columns used by the
-- planner's relative nutrition scoring. This migration does NOT modify
-- planner ranking code — it provides the data surface the planner can
-- read when it's ready.
-- Date: 2026-04-14

-- ============================================================
-- 1. Table
-- ============================================================

CREATE TABLE public.recipe_nutrition_summary (
    recipe_id UUID PRIMARY KEY REFERENCES public.recipes(id) ON DELETE CASCADE,

    -- Absolute totals per portion
    calories_per_portion NUMERIC(8, 1),
    protein_g_per_portion NUMERIC(7, 2),
    fat_g_per_portion NUMERIC(7, 2),
    carbs_g_per_portion NUMERIC(7, 2),
    fiber_g_per_portion NUMERIC(7, 2),
    sugar_g_per_portion NUMERIC(7, 2),
    sodium_mg_per_portion NUMERIC(8, 1),

    -- Derived ratios (share of calories from protein / sugar)
    protein_calorie_pct NUMERIC(5, 2),
    sugar_calorie_pct NUMERIC(5, 2),

    -- 0-1: share of recipe ingredients that contributed real nutrition data
    completeness_score NUMERIC(4, 3),

    -- Meal-type percentiles (0-100), null until tagged + recomputed
    calorie_percentile_breakfast NUMERIC(5, 2),
    calorie_percentile_lunch NUMERIC(5, 2),
    calorie_percentile_dinner NUMERIC(5, 2),
    calorie_percentile_snack NUMERIC(5, 2),
    calorie_percentile_dessert NUMERIC(5, 2),
    protein_percentile_breakfast NUMERIC(5, 2),
    protein_percentile_lunch NUMERIC(5, 2),
    protein_percentile_dinner NUMERIC(5, 2),
    protein_percentile_snack NUMERIC(5, 2),
    protein_percentile_dessert NUMERIC(5, 2),

    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT recipe_nutrition_summary_completeness_range
        CHECK (completeness_score IS NULL OR (completeness_score >= 0 AND completeness_score <= 1))
);

COMMENT ON TABLE public.recipe_nutrition_summary IS
    'Computed per-portion nutrition totals plus meal-type percentiles. Populated by compute_recipe_nutrition() and recompute_nutrition_percentiles(). Read by the meal planner for relative nutrition scoring.';
COMMENT ON COLUMN public.recipe_nutrition_summary.protein_calorie_pct IS
    'Share of total calories from protein, expressed as a percentage 0-100 (e.g. 12.50 = 12.5%).';
COMMENT ON COLUMN public.recipe_nutrition_summary.sugar_calorie_pct IS
    'Share of total calories from sugar, expressed as a percentage 0-100 (e.g. 8.25 = 8.25%).';

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE public.recipe_nutrition_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
    ON public.recipe_nutrition_summary
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Admin write access"
    ON public.recipe_nutrition_summary
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- 3. compute_recipe_nutrition(recipe_id) — upsert summary row
-- ============================================================
--
-- Walks recipe_ingredients and converts each line's quantity to grams
-- using measurement_units.type + ingredient_densities. Multiplies by
-- per-100g nutrition and divides by recipes.portions. Tracks
-- completeness as the share of non-optional ingredients that had both
-- a resolvable gram quantity AND nutrition data.
--
-- Assumed unit ids (see measurement_units seed): 'g', 'kg', 'mg',
-- 'ml', 'l', 'tsp' (5 ml), 'tbsp' (15 ml), 'cup' (240 ml). Units we
-- can't convert (e.g. 'unit', 'scoop', 'piece') are skipped and
-- reflected in completeness_score.

CREATE OR REPLACE FUNCTION public.compute_recipe_nutrition(p_recipe_id UUID)
RETURNS public.recipe_nutrition_summary
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_portions INTEGER;
    v_total_ingredients INTEGER := 0;
    v_counted_ingredients INTEGER := 0;
    v_calories NUMERIC := 0;
    v_protein NUMERIC := 0;
    v_fat NUMERIC := 0;
    v_carbs NUMERIC := 0;
    v_fiber NUMERIC := 0;
    v_sugar NUMERIC := 0;
    v_sodium NUMERIC := 0;
    v_row recipe_nutrition_summary;
    ri RECORD;
    v_grams NUMERIC;
    v_ml NUMERIC;
    v_factor NUMERIC;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT COALESCE(portions, 1) INTO v_portions
    FROM recipes WHERE id = p_recipe_id;

    IF v_portions IS NULL THEN
        RAISE EXCEPTION 'Recipe % not found', p_recipe_id;
    END IF;

    IF v_portions <= 0 THEN
        v_portions := 1;
    END IF;

    FOR ri IN
        SELECT
            r.id              AS ri_id,
            r.ingredient_id   AS ingredient_id,
            r.quantity        AS quantity,
            r.optional        AS optional,
            mu.id             AS unit_id,
            mu.type           AS unit_type,
            n.calories        AS n_calories,
            n.protein         AS n_protein,
            n.fat             AS n_fat,
            n.carbohydrates   AS n_carbs,
            n.fiber           AS n_fiber,
            n.sugar           AS n_sugar,
            n.sodium          AS n_sodium,
            d.density_g_per_ml AS density
        FROM recipe_ingredients r
        LEFT JOIN measurement_units mu ON mu.id = r.measurement_unit_id
        LEFT JOIN ingredient_nutrition n ON n.ingredient_id = r.ingredient_id
        LEFT JOIN ingredient_densities d ON d.ingredient_id = r.ingredient_id
        WHERE r.recipe_id = p_recipe_id
    LOOP
        -- Count only non-optional ingredients toward completeness
        IF NOT COALESCE(ri.optional, false) THEN
            v_total_ingredients := v_total_ingredients + 1;
        END IF;

        -- Resolve quantity to grams
        v_grams := NULL;
        IF ri.quantity IS NULL OR ri.unit_id IS NULL THEN
            CONTINUE;
        ELSIF ri.unit_id = 'g' THEN
            v_grams := ri.quantity;
        ELSIF ri.unit_id = 'kg' THEN
            v_grams := ri.quantity * 1000;
        ELSIF ri.unit_id = 'mg' THEN
            v_grams := ri.quantity / 1000;
        ELSIF ri.unit_type = 'volume' AND ri.density IS NOT NULL THEN
            v_ml := CASE ri.unit_id
                WHEN 'ml'   THEN ri.quantity
                WHEN 'l'    THEN ri.quantity * 1000
                WHEN 'tsp'  THEN ri.quantity * 5
                WHEN 'tbsp' THEN ri.quantity * 15
                WHEN 'cup'  THEN ri.quantity * 240
                ELSE NULL
            END;
            IF v_ml IS NOT NULL THEN
                v_grams := v_ml * ri.density;
            END IF;
        END IF;

        -- Need grams AND complete 7-macro nutrition to contribute.
        -- Legacy rows backfilled with only 4 macros (null fiber/sugar/
        -- sodium) are skipped so we never undercount; they'll start
        -- counting once a 7-macro row is written for the ingredient.
        IF v_grams IS NULL
           OR ri.n_calories IS NULL
           OR ri.n_protein IS NULL
           OR ri.n_fat IS NULL
           OR ri.n_carbs IS NULL
           OR ri.n_fiber IS NULL
           OR ri.n_sugar IS NULL
           OR ri.n_sodium IS NULL
        THEN
            CONTINUE;
        END IF;

        IF NOT COALESCE(ri.optional, false) THEN
            v_counted_ingredients := v_counted_ingredients + 1;
        END IF;

        v_factor := v_grams / 100.0;
        v_calories := v_calories + ri.n_calories * v_factor;
        v_protein  := v_protein  + ri.n_protein  * v_factor;
        v_fat      := v_fat      + ri.n_fat      * v_factor;
        v_carbs    := v_carbs    + ri.n_carbs    * v_factor;
        v_fiber    := v_fiber    + ri.n_fiber    * v_factor;
        v_sugar    := v_sugar    + ri.n_sugar    * v_factor;
        v_sodium   := v_sodium   + ri.n_sodium   * v_factor;
    END LOOP;

    INSERT INTO recipe_nutrition_summary AS s (
        recipe_id,
        calories_per_portion,
        protein_g_per_portion,
        fat_g_per_portion,
        carbs_g_per_portion,
        fiber_g_per_portion,
        sugar_g_per_portion,
        sodium_mg_per_portion,
        protein_calorie_pct,
        sugar_calorie_pct,
        completeness_score,
        computed_at
    ) VALUES (
        p_recipe_id,
        -- When nothing contributed, leave per-portion metrics NULL
        -- rather than writing fabricated zeros that would enter
        -- percentile ranking as "0-calorie" recipes.
        CASE WHEN v_counted_ingredients > 0
             THEN ROUND((v_calories / v_portions)::numeric, 1)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0
             THEN ROUND((v_protein  / v_portions)::numeric, 2)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0
             THEN ROUND((v_fat      / v_portions)::numeric, 2)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0
             THEN ROUND((v_carbs    / v_portions)::numeric, 2)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0
             THEN ROUND((v_fiber    / v_portions)::numeric, 2)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0
             THEN ROUND((v_sugar    / v_portions)::numeric, 2)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0
             THEN ROUND((v_sodium   / v_portions)::numeric, 1)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0 AND v_calories > 0
             THEN ROUND(((v_protein * 4) / v_calories * 100)::numeric, 2)
             ELSE NULL END,
        CASE WHEN v_counted_ingredients > 0 AND v_calories > 0
             THEN ROUND(((v_sugar * 4) / v_calories * 100)::numeric, 2)
             ELSE NULL END,
        CASE WHEN v_total_ingredients > 0
             THEN ROUND((v_counted_ingredients::numeric / v_total_ingredients)::numeric, 3)
             ELSE NULL END,
        now()
    )
    ON CONFLICT (recipe_id) DO UPDATE SET
        calories_per_portion   = EXCLUDED.calories_per_portion,
        protein_g_per_portion  = EXCLUDED.protein_g_per_portion,
        fat_g_per_portion      = EXCLUDED.fat_g_per_portion,
        carbs_g_per_portion    = EXCLUDED.carbs_g_per_portion,
        fiber_g_per_portion    = EXCLUDED.fiber_g_per_portion,
        sugar_g_per_portion    = EXCLUDED.sugar_g_per_portion,
        sodium_mg_per_portion  = EXCLUDED.sodium_mg_per_portion,
        protein_calorie_pct    = EXCLUDED.protein_calorie_pct,
        sugar_calorie_pct      = EXCLUDED.sugar_calorie_pct,
        completeness_score     = EXCLUDED.completeness_score,
        computed_at            = EXCLUDED.computed_at
    RETURNING s.* INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_recipe_nutrition(UUID) FROM PUBLIC;

-- ============================================================
-- 4. recompute_nutrition_percentiles(meal_type, recipe_ids)
-- ============================================================
--
-- Assigns 0-100 percentile ranks for calories_per_portion and
-- protein_g_per_portion to every recipe in `p_recipe_ids` that has
-- a summary row. Percentile is written into the meal-type-specific
-- columns. Callers classify recipes into meal types (this table
-- doesn't store meal-type tags — a future tagging migration owns
-- that). Recipes with missing nutrition are skipped.
--
-- Returns: the number of recipes that received non-null percentiles
-- in this call. Recipes in `p_recipe_ids` whose existing percentiles
-- were cleared (because they have no nutrition data) are NOT counted
-- in the return value.

CREATE OR REPLACE FUNCTION public.recompute_nutrition_percentiles(
    p_meal_type TEXT,
    p_recipe_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INTEGER := 0;
    v_sql_calorie_col TEXT;
    v_sql_protein_col TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    IF p_meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack', 'dessert') THEN
        RAISE EXCEPTION
            'Invalid meal_type: %. Must be breakfast|lunch|dinner|snack|dessert.',
            p_meal_type;
    END IF;

    v_sql_calorie_col := format('calorie_percentile_%I', p_meal_type);
    v_sql_protein_col := format('protein_percentile_%I', p_meal_type);

    -- Clear existing percentiles for the given recipes so stale rows
    -- don't persist if they lose nutrition data.
    EXECUTE format($f$
        UPDATE recipe_nutrition_summary
        SET %s = NULL, %s = NULL
        WHERE recipe_id = ANY($1)
    $f$, v_sql_calorie_col, v_sql_protein_col)
    USING p_recipe_ids;

    -- Assign percentiles by ordering recipes that have nutrition data.
    EXECUTE format($f$
        WITH ranked AS (
            SELECT
                recipe_id,
                (percent_rank() OVER (ORDER BY calories_per_portion) * 100)::numeric(5,2)
                    AS calorie_pct,
                (percent_rank() OVER (ORDER BY protein_g_per_portion) * 100)::numeric(5,2)
                    AS protein_pct
            FROM recipe_nutrition_summary
            WHERE recipe_id = ANY($1)
              AND calories_per_portion IS NOT NULL
              AND protein_g_per_portion IS NOT NULL
        )
        UPDATE recipe_nutrition_summary s
        SET %s = ranked.calorie_pct,
            %s = ranked.protein_pct
        FROM ranked
        WHERE s.recipe_id = ranked.recipe_id
    $f$, v_sql_calorie_col, v_sql_protein_col)
    USING p_recipe_ids;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_nutrition_percentiles(TEXT, UUID[]) FROM PUBLIC;
