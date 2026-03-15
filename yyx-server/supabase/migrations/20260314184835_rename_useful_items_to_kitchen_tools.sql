-- Rename useful_items → kitchen_tools (and all related tables/objects)
-- This is a naming cleanup — the domain concept is "kitchen tools", not "useful items".

-- ============================================================
-- 1. Rename tables
-- ============================================================
ALTER TABLE public.useful_items RENAME TO kitchen_tools;
ALTER TABLE public.recipe_useful_items RENAME TO recipe_kitchen_tools;
ALTER TABLE public.useful_item_translations RENAME TO kitchen_tool_translations;
ALTER TABLE public.recipe_useful_item_translations RENAME TO recipe_kitchen_tool_translations;

-- ============================================================
-- 2. Rename FK columns
-- ============================================================
ALTER TABLE public.kitchen_tool_translations
  RENAME COLUMN useful_item_id TO kitchen_tool_id;

ALTER TABLE public.recipe_kitchen_tools
  RENAME COLUMN useful_item_id TO kitchen_tool_id;

ALTER TABLE public.recipe_kitchen_tool_translations
  RENAME COLUMN recipe_useful_item_id TO recipe_kitchen_tool_id;

-- user_recipe_useful_items is for user-created recipes
ALTER TABLE public.user_recipe_useful_items
  RENAME COLUMN useful_item_id TO kitchen_tool_id;

ALTER TABLE public.user_recipe_useful_items
  RENAME TO user_recipe_kitchen_tools;

-- ============================================================
-- 3. Rename indexes
-- ============================================================
ALTER INDEX IF EXISTS idx_recipe_useful_items_useful_item_id
  RENAME TO idx_recipe_kitchen_tools_kitchen_tool_id;

ALTER INDEX IF EXISTS idx_user_recipe_useful_items_useful_item_id
  RENAME TO idx_user_recipe_kitchen_tools_kitchen_tool_id;

ALTER INDEX IF EXISTS idx_useful_item_translations_locale
  RENAME TO idx_kitchen_tool_translations_locale;

ALTER INDEX IF EXISTS idx_recipe_useful_item_translations_locale
  RENAME TO idx_recipe_kitchen_tool_translations_locale;

ALTER INDEX IF EXISTS idx_useful_item_translations_name_locale
  RENAME TO idx_kitchen_tool_translations_name_locale;

-- ============================================================
-- 4. Rename constraints
-- ============================================================
ALTER TABLE public.recipe_kitchen_tools
  RENAME CONSTRAINT recipe_useful_items_recipe_id_display_order_key
  TO recipe_kitchen_tools_recipe_id_display_order_key;

-- ============================================================
-- 5-9. Rename RLS policies (use DO block to handle missing policies gracefully)
-- ============================================================
DO $$
BEGIN
  -- kitchen_tools (was useful_items)
  ALTER POLICY "Only admins can delete useful items" ON public.kitchen_tools RENAME TO "Only admins can delete kitchen tools";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER POLICY "Only admins can insert useful items" ON public.kitchen_tools RENAME TO "Only admins can insert kitchen tools";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER POLICY "Only admins can update useful items" ON public.kitchen_tools RENAME TO "Only admins can update kitchen tools";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- recipe_kitchen_tools (was recipe_useful_items)
DO $$
BEGIN
  ALTER POLICY "Only admins can delete recipe useful items" ON public.recipe_kitchen_tools RENAME TO "Only admins can delete recipe kitchen tools";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER POLICY "Only admins can insert recipe useful items" ON public.recipe_kitchen_tools RENAME TO "Only admins can insert recipe kitchen tools";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER POLICY "Only admins can update recipe useful items" ON public.recipe_kitchen_tools RENAME TO "Only admins can update recipe kitchen tools";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- kitchen_tool_translations (was useful_item_translations)
DO $$
BEGIN
  ALTER POLICY "Anyone can read useful item translations" ON public.kitchen_tool_translations RENAME TO "Anyone can read kitchen tool translations";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER POLICY "Admin write useful item translations" ON public.kitchen_tool_translations RENAME TO "Admin write kitchen tool translations";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- recipe_kitchen_tool_translations (was recipe_useful_item_translations)
DO $$
BEGIN
  ALTER POLICY "Anyone can read published recipe useful item translations" ON public.recipe_kitchen_tool_translations RENAME TO "Anyone can read published recipe kitchen tool translations";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER POLICY "Admins can read all recipe useful item translations" ON public.recipe_kitchen_tool_translations RENAME TO "Admins can read all recipe kitchen tool translations";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER POLICY "Admin write recipe useful item translations" ON public.recipe_kitchen_tool_translations RENAME TO "Admin write recipe kitchen tool translations";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- user_recipe_kitchen_tools (was user_recipe_useful_items)
DO $$
BEGIN
  ALTER POLICY "user_recipe_useful_items_policy" ON public.user_recipe_kitchen_tools RENAME TO "user_recipe_kitchen_tools_policy";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- 10. Recreate recipe_kitchen_tool_translations RLS to reference renamed tables
-- (The USING clause references table names as text, not OIDs)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read published recipe kitchen tool translations" ON public.recipe_kitchen_tool_translations;
DROP POLICY IF EXISTS "Anyone can read published recipe useful item translations" ON public.recipe_kitchen_tool_translations;
CREATE POLICY "Anyone can read published recipe kitchen tool translations"
  ON public.recipe_kitchen_tool_translations FOR SELECT TO anon, authenticated
  USING (
    recipe_kitchen_tool_id IN (
      SELECT rkt.id FROM public.recipe_kitchen_tools rkt
      JOIN public.recipes r ON r.id = rkt.recipe_id
      WHERE r.is_published = true
    )
  );
