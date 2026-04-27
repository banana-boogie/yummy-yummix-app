-- Migration: Mark partial meal-plan slot coverage
-- Date: 2026-04-25
--
-- Keeps the slot requirement visible when assembly cannot find every
-- requested component. A main_plus_one/main_plus_two slot can now persist its
-- intended structure and expected_meal_components while marking that coverage
-- was incomplete.

ALTER TABLE public.meal_plan_slots
    ADD COLUMN IF NOT EXISTS coverage_complete BOOLEAN NOT NULL DEFAULT true;
