-- Migration: Add `swap` to the meal_plan_slot_components.pairing_basis enum
--
-- Background: when a user picks an alternative from the swap sheet, the
-- planner replaces the slot's primary component snapshot. The original
-- pairing basis (often `explicit_pairing` or `role_match`) no longer
-- describes how this component arrived — it was chosen by the user from a
-- list of planner-offered alternatives.
--
-- We had two choices: reuse `manual` (historically "user typed in something
-- the planner didn't suggest") or add `swap`. Adding `swap` preserves the
-- analytical distinction: `manual` implies the planner's ranking was
-- bypassed entirely; `swap` implies the planner offered options and the
-- user picked one. This matters for swap-success metrics and
-- ranking-quality dashboards downstream.
--
-- Date: 2026-04-27
-- Depends on: 20260410000001_add_meal_plans.sql (creates the table + the
--             original components_pairing_basis_check constraint)

ALTER TABLE public.meal_plan_slot_components
    DROP CONSTRAINT IF EXISTS components_pairing_basis_check;

ALTER TABLE public.meal_plan_slot_components
    ADD CONSTRAINT components_pairing_basis_check CHECK (
        pairing_basis IN (
            'standalone',
            'explicit_pairing',
            'role_match',
            'leftover_carry',
            'manual',
            'swap'
        )
    );
