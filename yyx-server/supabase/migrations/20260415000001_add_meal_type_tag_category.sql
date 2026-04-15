-- Add MEAL_TYPE to recipe_tag_category enum.
-- The admin recipe editor's My Week Setup step filters tags by a category
-- matching /meal\s*type/i to populate the meal-type picker; without this
-- enum value, admins cannot create the Meal Type tags the picker reads.

ALTER TYPE public.recipe_tag_category ADD VALUE IF NOT EXISTS 'MEAL_TYPE';
