-- Migration: Harden `apply_meal_plan_slot_swap` RPC (Codex review round 4)
--
-- Two security findings on the original migration:
--
-- 1. The RPC was granted to `authenticated`, exposing it as a public
--    surface for any signed-in user. RLS prevents cross-user writes, but
--    the function accepts arbitrary snapshot parameters (`p_title_snapshot`,
--    `p_total_time_snapshot`, etc.) and does not verify the
--    component → slot → plan relationship, primary status, or recipe
--    eligibility. A user could call the RPC directly to corrupt their own
--    plan state (forge snapshot fields, apply ineligible recipes,
--    sidestep rejection tracking).
--
-- 2. The function did not pin `search_path`, violating the database
--    guideline that every SECURITY-relevant function must set it.
--
-- Fix: revoke `authenticated`, grant only `service_role`, and pin
-- `search_path = public, pg_catalog`. The meal-planner edge function now
-- elevates to a service-role client for this single RPC call AFTER its
-- own ownership + eligibility validation. The function body is unchanged.
--
-- Date: 2026-05-04
-- Depends on: 20260504120931_add_apply_meal_plan_slot_swap_rpc.sql

REVOKE EXECUTE ON FUNCTION public.apply_meal_plan_slot_swap(
    uuid, uuid, text, text, integer, text, integer, text[], text[], uuid, uuid, timestamptz
) FROM PUBLIC, authenticated, anon;

ALTER FUNCTION public.apply_meal_plan_slot_swap(
    uuid, uuid, text, text, integer, text, integer, text[], text[], uuid, uuid, timestamptz
) SET search_path = public, pg_catalog;

GRANT EXECUTE ON FUNCTION public.apply_meal_plan_slot_swap(
    uuid, uuid, text, text, integer, text, integer, text[], text[], uuid, uuid, timestamptz
) TO service_role;
