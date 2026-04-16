-- Recipe role model extension + food_groups → meal_components rename
-- (2026-04-15)
--
-- Amends the planner metadata model per
-- product-kitchen/repeat-what-works/design/recipe-role-model.md:
--
--   1. Rename food_groups → meal_components on all three planner
--      tables. The old name was a mixed-taxonomy term that asked
--      three unrelated questions at once; the new name matches what
--      the field actually does — meal composition axes.
--
--   2. Narrow meal_components to the meal-composition axis only
--      (protein/carb/veg). Drop 'snack' and 'dessert' (redundant
--      with planner_role); do NOT add 'fat' (dietary descriptors
--      belong in the `diet` tag category, not meal_components).
--
--   3. Add 'pantry' to planner_role for recipes that belong in the
--      catalog but are never scheduled into weekly slots (matcha
--      butter, chile crisp, compound butters, spice blends).
--
--   4. Add alternate_planner_roles TEXT[] for recipes eligible in
--      multiple slot types (hummus as side + snack). 'pantry' is
--      excluded — mutually exclusive with scheduling.
--
-- Also fixes recipes.verified_by: casts from TEXT to UUID and adds
-- a FK to auth.users(id) so the admin UI can resolve the verifier
-- display name. Orphans are cleared to NULL before the cast.

-- ============================================================
-- 1. Scrub legacy 'snack'/'dessert'/'fat' values BEFORE rename.
-- ============================================================
UPDATE public.recipes
SET food_groups = array_remove(
    array_remove(
        array_remove(food_groups, 'snack'),
        'dessert'
    ),
    'fat'
)
WHERE food_groups && ARRAY['snack', 'dessert', 'fat']::TEXT[];

-- ============================================================
-- 2. Rename columns across all three tables.
-- ============================================================
ALTER TABLE public.recipes
    RENAME COLUMN food_groups TO meal_components;
ALTER TABLE public.meal_plan_slots
    RENAME COLUMN expected_food_groups TO expected_meal_components;
ALTER TABLE public.meal_plan_slot_components
    RENAME COLUMN food_groups_snapshot TO meal_components_snapshot;

-- ============================================================
-- 3. Drop old-named CHECK constraints.
-- CHECK constraints track the column after rename but keep their
-- original names; drop them so we can install new-named, narrower
-- versions below.
-- ============================================================
ALTER TABLE public.recipes
    DROP CONSTRAINT IF EXISTS recipes_food_groups_check;
ALTER TABLE public.meal_plan_slots
    DROP CONSTRAINT IF EXISTS slots_expected_food_groups_check;
ALTER TABLE public.meal_plan_slot_components
    DROP CONSTRAINT IF EXISTS components_food_groups_snapshot_check;

-- ============================================================
-- 4. Add new-named CHECKs with narrowed values.
-- ============================================================
ALTER TABLE public.recipes
    ADD CONSTRAINT recipes_meal_components_check CHECK (
        meal_components <@ ARRAY['protein', 'carb', 'veg']::TEXT[]
    );
ALTER TABLE public.meal_plan_slots
    ADD CONSTRAINT slots_expected_meal_components_check CHECK (
        expected_meal_components <@ ARRAY['protein', 'carb', 'veg']::TEXT[]
    );
ALTER TABLE public.meal_plan_slot_components
    ADD CONSTRAINT components_meal_components_snapshot_check CHECK (
        meal_components_snapshot <@ ARRAY['protein', 'carb', 'veg']::TEXT[]
    );

-- ============================================================
-- 5. Add 'pantry' to planner_role.
-- ============================================================
ALTER TABLE public.recipes
    DROP CONSTRAINT IF EXISTS recipes_planner_role_check,
    ADD CONSTRAINT recipes_planner_role_check CHECK (
        planner_role IS NULL OR planner_role IN (
            'main', 'side', 'snack', 'dessert',
            'beverage', 'condiment', 'pantry'
        )
    );

-- ============================================================
-- 6. Add alternate_planner_roles column.
-- ============================================================
ALTER TABLE public.recipes
    ADD COLUMN IF NOT EXISTS alternate_planner_roles TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.recipes
    DROP CONSTRAINT IF EXISTS recipes_alternate_planner_roles_check,
    ADD CONSTRAINT recipes_alternate_planner_roles_check CHECK (
        alternate_planner_roles <@ ARRAY[
            'main', 'side', 'snack', 'dessert', 'beverage', 'condiment'
        ]::TEXT[]
    );
-- 'pantry' intentionally excluded — mutually exclusive with scheduling.

-- ============================================================
-- 7. Fix recipes.verified_by: cast TEXT → UUID and add FK.
-- ============================================================
UPDATE public.recipes
SET verified_by = NULL
WHERE verified_by IS NOT NULL
  AND verified_by::uuid NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.recipes
    ALTER COLUMN verified_by TYPE UUID USING verified_by::UUID;

ALTER TABLE public.recipes
    DROP CONSTRAINT IF EXISTS recipes_verified_by_fkey,
    ADD CONSTRAINT recipes_verified_by_fkey
        FOREIGN KEY (verified_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
