-- Fix UNRESTRICTED warning on convenience views by enabling security_invoker
-- so they respect RLS on the underlying tables.

ALTER VIEW public.recipes_summary SET (security_invoker = true);
ALTER VIEW public.ingredients_summary SET (security_invoker = true);
