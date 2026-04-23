-- Add 'main' to recipe_pairings.pairing_role allowed values.
--
-- The original CHECK at 20260410000001_add_meal_plans.sql:374 included only
-- {side, base, veg, dessert, beverage, condiment, leftover_transform}.
-- That assumed the source recipe is the "main" in any pair, which doesn't
-- match content reality — admins pairing a soup or starter with a main
-- dish (e.g. broccoli soup → air-fryer chicken) need to mark the target's
-- role as `main`.
--
-- Widening only (adds a value); no existing rows can become invalid.

ALTER TABLE public.recipe_pairings
    DROP CONSTRAINT IF EXISTS pairings_role_check,
    ADD CONSTRAINT pairings_role_check CHECK (
        pairing_role IN (
            'main',
            'side',
            'base',
            'veg',
            'dessert',
            'beverage',
            'condiment',
            'leftover_transform'
        )
    );
