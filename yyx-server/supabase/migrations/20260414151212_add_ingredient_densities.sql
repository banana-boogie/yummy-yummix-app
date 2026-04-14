-- Migration: Add ingredient_densities table
-- Track G (nutrition infrastructure): density values (g/mL) for
-- volume-to-weight conversion. Used when computing recipe nutrition
-- totals from ingredient quantities expressed in volume units
-- (cups, tbsp, mL, etc.).
-- Date: 2026-04-14

-- ============================================================
-- 1. Table
-- ============================================================

CREATE TABLE public.ingredient_densities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    density_g_per_ml NUMERIC(6, 3) NOT NULL,
    source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ingredient_densities_density_positive CHECK (density_g_per_ml > 0),
    CONSTRAINT ingredient_densities_ingredient_unique UNIQUE (ingredient_id)
);

CREATE INDEX idx_ingredient_densities_ingredient_id
    ON public.ingredient_densities (ingredient_id);

COMMENT ON TABLE public.ingredient_densities IS
    'Density (grams per milliliter) for ingredients. Enables volume-to-weight conversion when computing recipe nutrition totals.';
COMMENT ON COLUMN public.ingredient_densities.density_g_per_ml IS
    'Grams per 1 mL of the ingredient. 1 cup = 240 mL, 1 tbsp = 15 mL, 1 tsp = 5 mL.';
COMMENT ON COLUMN public.ingredient_densities.source IS
    'Provenance of the value: usda | manual | ai_estimated | reference.';

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE public.ingredient_densities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
    ON public.ingredient_densities
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Admin write access"
    ON public.ingredient_densities
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- 3. Seed common-ingredient densities (g/mL, reference values)
-- Only inserts rows where a matching ingredient exists (by EN name).
-- ============================================================

WITH seeds(name_en, density_g_per_ml) AS (
    VALUES
        -- Liquids
        ('water',             1.000),
        ('milk',              1.030),
        ('olive oil',         0.915),
        ('vegetable oil',     0.920),
        ('honey',             1.420),
        ('maple syrup',       1.320),
        -- Dry / powders (bulk density)
        ('all-purpose flour', 0.520),
        ('whole wheat flour', 0.540),
        ('granulated sugar',  0.845),
        ('brown sugar',       0.930),
        ('powdered sugar',    0.560),
        ('salt',              1.217),
        ('baking powder',     0.720),
        ('baking soda',       0.950),
        ('cocoa powder',      0.510),
        -- Starches / grains
        ('white rice',        0.850),
        ('rolled oats',       0.410),
        -- Dairy solids
        ('butter',            0.911)
)
INSERT INTO public.ingredient_densities (ingredient_id, density_g_per_ml, source)
SELECT i.id, s.density_g_per_ml, 'reference'
FROM seeds s
JOIN public.ingredient_translations it
    ON it.locale = 'en' AND lower(it.name) = s.name_en
JOIN public.ingredients i
    ON i.id = it.ingredient_id
ON CONFLICT (ingredient_id) DO NOTHING;
