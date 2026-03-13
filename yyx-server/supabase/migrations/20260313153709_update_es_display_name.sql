-- Deactivate es-MX: it's redundant because 'es' is already Mexican Spanish (Mexico-first).
-- es-ES remains active as a genuine regional override (Spain differs from Mexico).
-- Also update 'es' display_name to clarify it's the Mexico base.
UPDATE public.locales SET is_active = false WHERE code = 'es-MX';
UPDATE public.locales SET display_name = 'Español (México)' WHERE code = 'es';
