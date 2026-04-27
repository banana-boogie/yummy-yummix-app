-- Migration: Replace `prefer_leftovers_for_lunch` with `auto_leftovers`.
--
-- Background: the planner originally only considered leftovers for lunch
-- slots (and only when explicitly opted in via prefer_leftovers_for_lunch).
-- We're broadening this to a single `auto_leftovers` flag that, when true,
-- lets BOTH lunch and dinner targets be satisfied by leftovers from any
-- prior lunch/dinner cook slot within the existing 24h source window.
--
-- This matches Mexican comida-recalentado culture (lunch leftovers reheated
-- as dinner the same day, or yesterday's dinner becoming today's lunch).
-- The narrow boolean is replaced rather than supplemented because the
-- broader flag subsumes its semantics.
--
-- Default: TRUE globally. Users who don't want auto-leftovers can pass
-- `autoLeftovers: false` in the request payload (per-generation override)
-- or set the column to false in user_meal_planning_preferences (persistent).
--
-- Backfill: any user who explicitly opted into prefer_leftovers_for_lunch
-- carries that opt-in into auto_leftovers (with the broader semantics).
-- Users who explicitly opted OUT (false) are NOT carried forward to opt-out
-- of auto_leftovers — the new default (true) is the right starting point
-- for everyone, and the old false often just meant "I haven't thought about
-- leftovers" rather than an active rejection.
--
-- Date: 2026-04-26
-- Depends on: 20260410000001_add_meal_plans.sql (creates the table + the
--             prefer_leftovers_for_lunch column)

ALTER TABLE public.user_meal_planning_preferences
    ADD COLUMN IF NOT EXISTS auto_leftovers BOOLEAN NOT NULL DEFAULT true;

-- Carry forward explicit opt-ins from the old column (TRUE → TRUE, no
-- semantic change for those users; the new flag is broader but they already
-- wanted leftovers).
UPDATE public.user_meal_planning_preferences
    SET auto_leftovers = true
    WHERE prefer_leftovers_for_lunch = true;

ALTER TABLE public.user_meal_planning_preferences
    DROP COLUMN IF EXISTS prefer_leftovers_for_lunch;
