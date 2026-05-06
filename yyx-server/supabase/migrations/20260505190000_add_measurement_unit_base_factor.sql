-- Add base_factor to measurement_units so the shopping-list consolidator
-- can merge compatible units (g+kg → kg, ml+L → L, cup+tbsp → cup) by
-- converting through a canonical base unit per dimension.
--
-- The factor is "how many base-units does one of this unit equal":
--   - mass dimension: base = gram. So `oz.base_factor = 28.349523125`.
--   - volume dimension: base = milliliter. So `cup.base_factor = 236.5882365`.
--   - discrete units (clove, leaf, piece, pinch, etc.) are NULL — not
--     convertible. Consolidation falls back to (ingredient_id, unit_id)
--     keying for these, matching pre-PR behavior.
--
-- Reference values:
--   1 lb = 453.59237 g (international avoirdupois, NIST)
--   1 oz = 28.349523125 g (1/16 lb)
--   1 US cup = 236.5882365 ml (NIST)
--   1 US tbsp = 14.78676478125 ml (1/16 cup)
--   1 US tsp = 4.92892159375 ml (1/3 tbsp)
--
-- Future: per-ingredient cross-dimension factors (1 cup flour = 120g) will
-- live in a separate ingredient_unit_conversions table when nutrition lands.

ALTER TABLE public.measurement_units
ADD COLUMN IF NOT EXISTS base_factor NUMERIC;

ALTER TABLE public.measurement_units
ADD CONSTRAINT measurement_units_base_factor_positive
CHECK (base_factor IS NULL OR base_factor > 0);

COMMENT ON COLUMN public.measurement_units.base_factor IS
'Factor to convert one of this unit to the base unit of its dimension '
'(grams for weight, milliliters for volume). NULL for discrete units '
'(clove, piece, pinch, etc.) that are not convertible.';

-- Mass / weight (base: g)
UPDATE public.measurement_units SET base_factor = 1               WHERE id = 'g';
UPDATE public.measurement_units SET base_factor = 1000            WHERE id = 'kg';
UPDATE public.measurement_units SET base_factor = 28.349523125    WHERE id = 'oz';
UPDATE public.measurement_units SET base_factor = 453.59237       WHERE id = 'lb';

-- Volume (base: ml)
UPDATE public.measurement_units SET base_factor = 1               WHERE id = 'ml';
UPDATE public.measurement_units SET base_factor = 1000            WHERE id = 'l';
UPDATE public.measurement_units SET base_factor = 1000            WHERE id = 'L';
UPDATE public.measurement_units SET base_factor = 236.5882365     WHERE id = 'cup';
UPDATE public.measurement_units SET base_factor = 14.78676478125  WHERE id = 'tbsp';
UPDATE public.measurement_units SET base_factor = 4.92892159375   WHERE id = 'tsp';

-- Discrete units (clove, leaf, piece, pinch, slice, sprig, taste, unit,
-- scoop) intentionally remain NULL.
