-- Revert: keep es-MX active to avoid breaking user profiles or locale resolution.
-- The display_name rename for 'es' stays — it clarifies that base Spanish = Mexican Spanish.
UPDATE public.locales SET is_active = true WHERE code = 'es-MX';
