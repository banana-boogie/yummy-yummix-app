-- Drop unused preference lookup tables
-- These were used to populate preference selection UIs (onboarding + profile editing).
-- The app now uses hardcoded arrays + i18n keys instead, matching the pattern
-- already used by profile modals for diet/allergy types.
-- User selections in user_profiles (diet_types, dietary_restrictions, cuisine_preferences columns) are unaffected.

DROP TABLE IF EXISTS public.cuisine_preferences;
DROP TABLE IF EXISTS public.diet_types;
DROP TABLE IF EXISTS public.food_allergies;
