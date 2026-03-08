-- Migration: i18n data migration and sync triggers
-- Author: database-agent
-- Date: 2026-03-08
-- Description: Copies existing _en/_es column data into translation tables and
--              creates one-way sync triggers (old columns -> translation tables).
--              100% backward-compatible — no existing tables/columns/RPCs modified.

BEGIN;

-- ============================================================
-- 2A. Data copy from old columns to translation tables
-- ============================================================

-- recipes
INSERT INTO public.recipe_translations (recipe_id, locale, name, tips_and_tricks)
SELECT id, 'en', name_en, tips_and_tricks_en FROM public.recipes WHERE name_en IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_translations (recipe_id, locale, name, tips_and_tricks)
SELECT id, 'es', name_es, tips_and_tricks_es FROM public.recipes WHERE name_es IS NOT NULL
ON CONFLICT DO NOTHING;

-- recipe_steps
INSERT INTO public.recipe_step_translations (recipe_step_id, locale, instruction, recipe_section, tip)
SELECT id, 'en', instruction_en, recipe_section_en, tip_en FROM public.recipe_steps WHERE instruction_en IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_step_translations (recipe_step_id, locale, instruction, recipe_section, tip)
SELECT id, 'es', instruction_es, recipe_section_es, tip_es FROM public.recipe_steps WHERE instruction_es IS NOT NULL
ON CONFLICT DO NOTHING;

-- ingredients
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT id, 'en', name_en, plural_name_en FROM public.ingredients WHERE name_en IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT id, 'es', name_es, plural_name_es FROM public.ingredients WHERE name_es IS NOT NULL
ON CONFLICT DO NOTHING;

-- recipe_ingredients
INSERT INTO public.recipe_ingredient_translations (recipe_ingredient_id, locale, recipe_section, notes, tip)
SELECT id, 'en', recipe_section_en, notes_en, tip_en FROM public.recipe_ingredients
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_ingredient_translations (recipe_ingredient_id, locale, recipe_section, notes, tip)
SELECT id, 'es', recipe_section_es, notes_es, tip_es FROM public.recipe_ingredients
ON CONFLICT DO NOTHING;

-- measurement_units (PK is text, not uuid)
INSERT INTO public.measurement_unit_translations (measurement_unit_id, locale, name, name_plural, symbol, symbol_plural)
SELECT id, 'en', name_en, name_en_plural, symbol_en, symbol_en_plural FROM public.measurement_units
ON CONFLICT DO NOTHING;

INSERT INTO public.measurement_unit_translations (measurement_unit_id, locale, name, name_plural, symbol, symbol_plural)
SELECT id, 'es', name_es, name_es_plural, symbol_es, symbol_es_plural FROM public.measurement_units
ON CONFLICT DO NOTHING;

-- recipe_tags
INSERT INTO public.recipe_tag_translations (recipe_tag_id, locale, name)
SELECT id, 'en', name_en FROM public.recipe_tags WHERE name_en IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_tag_translations (recipe_tag_id, locale, name)
SELECT id, 'es', name_es FROM public.recipe_tags WHERE name_es IS NOT NULL
ON CONFLICT DO NOTHING;

-- useful_items
INSERT INTO public.useful_item_translations (useful_item_id, locale, name)
SELECT id, 'en', name_en FROM public.useful_items
ON CONFLICT DO NOTHING;

INSERT INTO public.useful_item_translations (useful_item_id, locale, name)
SELECT id, 'es', name_es FROM public.useful_items
ON CONFLICT DO NOTHING;

-- recipe_useful_items
INSERT INTO public.recipe_useful_item_translations (recipe_useful_item_id, locale, notes)
SELECT id, 'en', notes_en FROM public.recipe_useful_items WHERE notes_en IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.recipe_useful_item_translations (recipe_useful_item_id, locale, notes)
SELECT id, 'es', notes_es FROM public.recipe_useful_items WHERE notes_es IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2B. One-way sync triggers (old columns -> translation tables)
-- ============================================================

-- recipes sync
CREATE OR REPLACE FUNCTION public.sync_recipe_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  IF NEW.name_en IS NOT NULL THEN
    INSERT INTO public.recipe_translations (recipe_id, locale, name, tips_and_tricks)
    VALUES (NEW.id, 'en', NEW.name_en, NEW.tips_and_tricks_en)
    ON CONFLICT (recipe_id, locale) DO UPDATE
    SET name = EXCLUDED.name, tips_and_tricks = EXCLUDED.tips_and_tricks;
  END IF;

  -- Sync Spanish
  IF NEW.name_es IS NOT NULL THEN
    INSERT INTO public.recipe_translations (recipe_id, locale, name, tips_and_tricks)
    VALUES (NEW.id, 'es', NEW.name_es, NEW.tips_and_tricks_es)
    ON CONFLICT (recipe_id, locale) DO UPDATE
    SET name = EXCLUDED.name, tips_and_tricks = EXCLUDED.tips_and_tricks;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_recipe_translations
  AFTER INSERT OR UPDATE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_recipe_to_translations();

-- recipe_steps sync
CREATE OR REPLACE FUNCTION public.sync_recipe_step_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  IF NEW.instruction_en IS NOT NULL THEN
    INSERT INTO public.recipe_step_translations (recipe_step_id, locale, instruction, recipe_section, tip)
    VALUES (NEW.id, 'en', NEW.instruction_en, NEW.recipe_section_en, NEW.tip_en)
    ON CONFLICT (recipe_step_id, locale) DO UPDATE
    SET instruction = EXCLUDED.instruction, recipe_section = EXCLUDED.recipe_section, tip = EXCLUDED.tip;
  END IF;

  -- Sync Spanish
  IF NEW.instruction_es IS NOT NULL THEN
    INSERT INTO public.recipe_step_translations (recipe_step_id, locale, instruction, recipe_section, tip)
    VALUES (NEW.id, 'es', NEW.instruction_es, NEW.recipe_section_es, NEW.tip_es)
    ON CONFLICT (recipe_step_id, locale) DO UPDATE
    SET instruction = EXCLUDED.instruction, recipe_section = EXCLUDED.recipe_section, tip = EXCLUDED.tip;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_recipe_step_translations
  AFTER INSERT OR UPDATE ON public.recipe_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_recipe_step_to_translations();

-- ingredients sync
CREATE OR REPLACE FUNCTION public.sync_ingredient_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  IF NEW.name_en IS NOT NULL THEN
    INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
    VALUES (NEW.id, 'en', NEW.name_en, NEW.plural_name_en)
    ON CONFLICT (ingredient_id, locale) DO UPDATE
    SET name = EXCLUDED.name, plural_name = EXCLUDED.plural_name;
  END IF;

  -- Sync Spanish
  IF NEW.name_es IS NOT NULL THEN
    INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
    VALUES (NEW.id, 'es', NEW.name_es, NEW.plural_name_es)
    ON CONFLICT (ingredient_id, locale) DO UPDATE
    SET name = EXCLUDED.name, plural_name = EXCLUDED.plural_name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_ingredient_translations
  AFTER INSERT OR UPDATE ON public.ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ingredient_to_translations();

-- recipe_ingredients sync
CREATE OR REPLACE FUNCTION public.sync_recipe_ingredient_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  INSERT INTO public.recipe_ingredient_translations (recipe_ingredient_id, locale, recipe_section, notes, tip)
  VALUES (NEW.id, 'en', NEW.recipe_section_en, NEW.notes_en, NEW.tip_en)
  ON CONFLICT (recipe_ingredient_id, locale) DO UPDATE
  SET recipe_section = EXCLUDED.recipe_section, notes = EXCLUDED.notes, tip = EXCLUDED.tip;

  -- Sync Spanish
  INSERT INTO public.recipe_ingredient_translations (recipe_ingredient_id, locale, recipe_section, notes, tip)
  VALUES (NEW.id, 'es', NEW.recipe_section_es, NEW.notes_es, NEW.tip_es)
  ON CONFLICT (recipe_ingredient_id, locale) DO UPDATE
  SET recipe_section = EXCLUDED.recipe_section, notes = EXCLUDED.notes, tip = EXCLUDED.tip;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_recipe_ingredient_translations
  AFTER INSERT OR UPDATE ON public.recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_recipe_ingredient_to_translations();

-- measurement_units sync
CREATE OR REPLACE FUNCTION public.sync_measurement_unit_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  INSERT INTO public.measurement_unit_translations (measurement_unit_id, locale, name, name_plural, symbol, symbol_plural)
  VALUES (NEW.id, 'en', NEW.name_en, NEW.name_en_plural, NEW.symbol_en, NEW.symbol_en_plural)
  ON CONFLICT (measurement_unit_id, locale) DO UPDATE
  SET name = EXCLUDED.name, name_plural = EXCLUDED.name_plural, symbol = EXCLUDED.symbol, symbol_plural = EXCLUDED.symbol_plural;

  -- Sync Spanish
  INSERT INTO public.measurement_unit_translations (measurement_unit_id, locale, name, name_plural, symbol, symbol_plural)
  VALUES (NEW.id, 'es', NEW.name_es, NEW.name_es_plural, NEW.symbol_es, NEW.symbol_es_plural)
  ON CONFLICT (measurement_unit_id, locale) DO UPDATE
  SET name = EXCLUDED.name, name_plural = EXCLUDED.name_plural, symbol = EXCLUDED.symbol, symbol_plural = EXCLUDED.symbol_plural;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_measurement_unit_translations
  AFTER INSERT OR UPDATE ON public.measurement_units
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_measurement_unit_to_translations();

-- recipe_tags sync
CREATE OR REPLACE FUNCTION public.sync_recipe_tag_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  IF NEW.name_en IS NOT NULL THEN
    INSERT INTO public.recipe_tag_translations (recipe_tag_id, locale, name)
    VALUES (NEW.id, 'en', NEW.name_en)
    ON CONFLICT (recipe_tag_id, locale) DO UPDATE
    SET name = EXCLUDED.name;
  END IF;

  -- Sync Spanish
  IF NEW.name_es IS NOT NULL THEN
    INSERT INTO public.recipe_tag_translations (recipe_tag_id, locale, name)
    VALUES (NEW.id, 'es', NEW.name_es)
    ON CONFLICT (recipe_tag_id, locale) DO UPDATE
    SET name = EXCLUDED.name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_recipe_tag_translations
  AFTER INSERT OR UPDATE ON public.recipe_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_recipe_tag_to_translations();

-- useful_items sync
CREATE OR REPLACE FUNCTION public.sync_useful_item_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  INSERT INTO public.useful_item_translations (useful_item_id, locale, name)
  VALUES (NEW.id, 'en', NEW.name_en)
  ON CONFLICT (useful_item_id, locale) DO UPDATE
  SET name = EXCLUDED.name;

  -- Sync Spanish
  INSERT INTO public.useful_item_translations (useful_item_id, locale, name)
  VALUES (NEW.id, 'es', NEW.name_es)
  ON CONFLICT (useful_item_id, locale) DO UPDATE
  SET name = EXCLUDED.name;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_useful_item_translations
  AFTER INSERT OR UPDATE ON public.useful_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_useful_item_to_translations();

-- recipe_useful_items sync
CREATE OR REPLACE FUNCTION public.sync_recipe_useful_item_to_translations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync English
  IF NEW.notes_en IS NOT NULL THEN
    INSERT INTO public.recipe_useful_item_translations (recipe_useful_item_id, locale, notes)
    VALUES (NEW.id, 'en', NEW.notes_en)
    ON CONFLICT (recipe_useful_item_id, locale) DO UPDATE
    SET notes = EXCLUDED.notes;
  END IF;

  -- Sync Spanish
  IF NEW.notes_es IS NOT NULL THEN
    INSERT INTO public.recipe_useful_item_translations (recipe_useful_item_id, locale, notes)
    VALUES (NEW.id, 'es', NEW.notes_es)
    ON CONFLICT (recipe_useful_item_id, locale) DO UPDATE
    SET notes = EXCLUDED.notes;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_recipe_useful_item_translations
  AFTER INSERT OR UPDATE ON public.recipe_useful_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_recipe_useful_item_to_translations();

COMMIT;
