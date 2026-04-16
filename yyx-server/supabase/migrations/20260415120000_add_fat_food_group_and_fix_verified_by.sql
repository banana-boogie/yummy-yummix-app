-- Add `fat` to food_groups and add FK on recipes.verified_by.
--
-- `fat` is classification metadata only. It does NOT create a new required
-- coverage target for meal-slot completeness — planner ranking should not
-- gate on `fat` presence. Future intentional extension may change this, but
-- the enum is forward-compatible either way.
--
-- recipes.verified_by was originally TEXT without a FK (oversight from the
-- planner foundation migration). This migration casts it to UUID and adds
-- the proper FK to auth.users so PostgREST can embed the verifier's profile
-- when resolving the display name in the admin My Week Setup UI.

-- A) Widen food_groups CHECK constraints on all three planner tables.

ALTER TABLE public.recipes
    DROP CONSTRAINT IF EXISTS recipes_food_groups_check,
    ADD CONSTRAINT recipes_food_groups_check CHECK (
        food_groups <@ ARRAY['protein', 'carb', 'veg', 'fat', 'snack', 'dessert']::TEXT[]
    );

ALTER TABLE public.meal_plan_slots
    DROP CONSTRAINT IF EXISTS slots_expected_food_groups_check,
    ADD CONSTRAINT slots_expected_food_groups_check CHECK (
        expected_food_groups <@ ARRAY['protein', 'carb', 'veg', 'fat', 'snack', 'dessert']::TEXT[]
    );

ALTER TABLE public.meal_plan_slot_components
    DROP CONSTRAINT IF EXISTS components_food_groups_snapshot_check,
    ADD CONSTRAINT components_food_groups_snapshot_check CHECK (
        food_groups_snapshot <@ ARRAY['protein', 'carb', 'veg', 'fat', 'snack', 'dessert']::TEXT[]
    );

-- B) Clean any orphaned verified_by values before casting, then fix the type
-- and add the FK. Orphans are cleared to NULL (never committed by a real
-- admin session in this pre-launch state).

UPDATE public.recipes
SET verified_by = NULL
WHERE verified_by IS NOT NULL
  AND verified_by::uuid NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.recipes
    ALTER COLUMN verified_by TYPE UUID USING verified_by::UUID;

ALTER TABLE public.recipes
    ADD CONSTRAINT recipes_verified_by_fkey
        FOREIGN KEY (verified_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
