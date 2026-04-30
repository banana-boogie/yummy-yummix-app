-- Recipe Metadata helper — fix volatility + privileges (Codex review of 14b553c8).
--
-- _recipe_metadata_resolve_kitchen_tool was declared IMMUTABLE, but it reads
-- public.kitchen_tools and public.kitchen_tool_translations — table reads are
-- not immutable (table contents can change). The correct volatility is STABLE
-- (returns the same value within a single statement). Marking it IMMUTABLE
-- would let the planner cache results across rows in incorrect ways.
--
-- Also: as a public-schema function, it inherited default PUBLIC EXECUTE.
-- The helper is internal to apply_recipe_metadata (which is itself
-- service_role-only). Lock it down to match.

ALTER FUNCTION public._recipe_metadata_resolve_kitchen_tool(text)
  STABLE;

REVOKE ALL ON FUNCTION public._recipe_metadata_resolve_kitchen_tool(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._recipe_metadata_resolve_kitchen_tool(text) TO service_role;
