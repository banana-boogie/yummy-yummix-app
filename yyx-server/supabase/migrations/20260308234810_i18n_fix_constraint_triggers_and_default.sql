-- Fix: remove OR UPDATE from base translation constraint triggers (INSERT-only)
-- Fix: change recipe_ingredient_translations.recipe_section default from 'Main' to ''

BEGIN;

-- Drop and recreate all 8 constraint triggers as INSERT-only
DROP TRIGGER IF EXISTS check_recipe_base_translation ON public.recipes;
CREATE CONSTRAINT TRIGGER check_recipe_base_translation
  AFTER INSERT ON public.recipes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_translations', 'recipe_id');

DROP TRIGGER IF EXISTS check_recipe_step_base_translation ON public.recipe_steps;
CREATE CONSTRAINT TRIGGER check_recipe_step_base_translation
  AFTER INSERT ON public.recipe_steps
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_step_translations', 'recipe_step_id');

DROP TRIGGER IF EXISTS check_ingredient_base_translation ON public.ingredients;
CREATE CONSTRAINT TRIGGER check_ingredient_base_translation
  AFTER INSERT ON public.ingredients
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('ingredient_translations', 'ingredient_id');

DROP TRIGGER IF EXISTS check_recipe_ingredient_base_translation ON public.recipe_ingredients;
CREATE CONSTRAINT TRIGGER check_recipe_ingredient_base_translation
  AFTER INSERT ON public.recipe_ingredients
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_ingredient_translations', 'recipe_ingredient_id');

DROP TRIGGER IF EXISTS check_measurement_unit_base_translation ON public.measurement_units;
CREATE CONSTRAINT TRIGGER check_measurement_unit_base_translation
  AFTER INSERT ON public.measurement_units
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('measurement_unit_translations', 'measurement_unit_id');

DROP TRIGGER IF EXISTS check_recipe_tag_base_translation ON public.recipe_tags;
CREATE CONSTRAINT TRIGGER check_recipe_tag_base_translation
  AFTER INSERT ON public.recipe_tags
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_tag_translations', 'recipe_tag_id');

DROP TRIGGER IF EXISTS check_useful_item_base_translation ON public.useful_items;
CREATE CONSTRAINT TRIGGER check_useful_item_base_translation
  AFTER INSERT ON public.useful_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('useful_item_translations', 'useful_item_id');

DROP TRIGGER IF EXISTS check_recipe_useful_item_base_translation ON public.recipe_useful_items;
CREATE CONSTRAINT TRIGGER check_recipe_useful_item_base_translation
  AFTER INSERT ON public.recipe_useful_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_base_translation('recipe_useful_item_translations', 'recipe_useful_item_id');

-- Change recipe_ingredient_translations default
ALTER TABLE public.recipe_ingredient_translations
  ALTER COLUMN recipe_section SET DEFAULT '';

COMMIT;
