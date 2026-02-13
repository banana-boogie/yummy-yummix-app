-- Remove display_order from preference lookup tables.
-- Front-end now sorts options alphabetically by the user's language.

ALTER TABLE public.food_allergies DROP COLUMN IF EXISTS display_order;
ALTER TABLE public.diet_types DROP COLUMN IF EXISTS display_order;
ALTER TABLE public.cuisine_preferences DROP COLUMN IF EXISTS display_order;
