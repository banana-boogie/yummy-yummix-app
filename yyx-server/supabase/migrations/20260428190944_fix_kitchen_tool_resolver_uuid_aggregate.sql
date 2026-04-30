-- Fix `function max(uuid) does not exist` in
-- _recipe_metadata_resolve_kitchen_tool. The helper used max(kt.id) to pick
-- a single row out of the LEFT JOIN against kitchen_tool_translations,
-- but Postgres has no default max(uuid) aggregate, so the apply RPC errored
-- whenever a YAML's kitchen_tools.set referenced any tool.
--
-- Replace with (array_agg(kt.id))[1], which works on uuid and still picks
-- a deterministic single row from the aggregate when count = 1. The
-- function still raises on count > 1 (ambiguous match) and count = 0
-- (no match), so the only behavior change is "stops crashing on success".
--
-- Volatility (STABLE — table reads are not IMMUTABLE) is reasserted here
-- because CREATE OR REPLACE FUNCTION does not preserve it from the prior
-- definition. Mirrors the explicit ALTER in migration 20260427192453.

CREATE OR REPLACE FUNCTION public._recipe_metadata_resolve_kitchen_tool(name_lookup text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_match_count int;
  v_kt_id       uuid;
BEGIN
  SELECT count(*), (array_agg(kt.id))[1]
    INTO v_match_count, v_kt_id
    FROM public.kitchen_tools kt
    JOIN public.kitchen_tool_translations ktt
      ON ktt.kitchen_tool_id = kt.id AND ktt.locale = 'en'
   WHERE lower(trim(ktt.name)) = lower(trim(name_lookup));

  IF v_match_count > 1 THEN
    RAISE EXCEPTION
      'kitchen_tools: ambiguous name_en "%" matches % rows — disambiguate in the admin UI',
      name_lookup, v_match_count;
  END IF;
  IF v_match_count = 0 THEN
    RAISE EXCEPTION
      'kitchen_tools: no kitchen_tool with name_en = "%" (create it in the admin UI first)',
      name_lookup;
  END IF;

  RETURN v_kt_id;
END;
$$;

REVOKE ALL ON FUNCTION public._recipe_metadata_resolve_kitchen_tool(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._recipe_metadata_resolve_kitchen_tool(text) TO service_role;
