-- Schema improvements migration
-- Fixes: indexes, NOT NULL constraints, case-insensitive unique constraints, full-text search

-- ============================================================================
-- STEP 1: Clean up duplicate data before adding unique constraints
-- ============================================================================

-- 1a. Delete unreferenced duplicate ingredients (keep the more complete ones)
-- The older duplicates have NULL name_en and are not referenced
DELETE FROM ingredients
WHERE id IN ('2f39b40b-1582-4dc1-816d-91f5fdeb18ff', '11cb409d-1f59-4051-8680-4eb256f9b497');

-- 1b. Clean up duplicate recipe_tags by merging references
-- For each duplicate group, keep the first one (by created_at) and migrate references
DO $$
DECLARE
    dup RECORD;
    keep_id UUID;
    delete_ids UUID[];
BEGIN
    -- Find all duplicate groups by name_en
    FOR dup IN
        SELECT LOWER(name_en) as name, array_agg(id ORDER BY created_at) as ids
        FROM recipe_tags
        WHERE name_en IS NOT NULL
        GROUP BY LOWER(name_en)
        HAVING COUNT(*) > 1
    LOOP
        keep_id := dup.ids[1];
        delete_ids := dup.ids[2:];

        -- Update references to point to the kept tag
        UPDATE recipe_to_tag SET tag_id = keep_id
        WHERE tag_id = ANY(delete_ids)
        AND NOT EXISTS (
            SELECT 1 FROM recipe_to_tag rt2
            WHERE rt2.recipe_id = recipe_to_tag.recipe_id AND rt2.tag_id = keep_id
        );

        -- Delete duplicate references (same recipe, same tag after merge)
        DELETE FROM recipe_to_tag WHERE tag_id = ANY(delete_ids);

        -- Delete duplicate tags
        DELETE FROM recipe_tags WHERE id = ANY(delete_ids);
    END LOOP;

    -- Find all duplicate groups by name_es
    FOR dup IN
        SELECT LOWER(name_es) as name, array_agg(id ORDER BY created_at) as ids
        FROM recipe_tags
        WHERE name_es IS NOT NULL
        GROUP BY LOWER(name_es)
        HAVING COUNT(*) > 1
    LOOP
        keep_id := dup.ids[1];
        delete_ids := dup.ids[2:];

        UPDATE recipe_to_tag SET tag_id = keep_id
        WHERE tag_id = ANY(delete_ids)
        AND NOT EXISTS (
            SELECT 1 FROM recipe_to_tag rt2
            WHERE rt2.recipe_id = recipe_to_tag.recipe_id AND rt2.tag_id = keep_id
        );

        DELETE FROM recipe_to_tag WHERE tag_id = ANY(delete_ids);
        DELETE FROM recipe_tags WHERE id = ANY(delete_ids);
    END LOOP;
END $$;

-- 1c. Clean up duplicate useful_items by merging references
DO $$
DECLARE
    dup RECORD;
    keep_id UUID;
    delete_ids UUID[];
BEGIN
    -- Find all duplicate groups by name_es (useful_items doesn't have name_en duplicates)
    FOR dup IN
        SELECT LOWER(name_es) as name, array_agg(id ORDER BY created_at) as ids
        FROM useful_items
        WHERE name_es IS NOT NULL
        GROUP BY LOWER(name_es)
        HAVING COUNT(*) > 1
    LOOP
        keep_id := dup.ids[1];
        delete_ids := dup.ids[2:];

        -- Update references to point to the kept item
        UPDATE recipe_useful_items SET useful_item_id = keep_id
        WHERE useful_item_id = ANY(delete_ids)
        AND NOT EXISTS (
            SELECT 1 FROM recipe_useful_items rui2
            WHERE rui2.recipe_id = recipe_useful_items.recipe_id AND rui2.useful_item_id = keep_id
        );

        -- Delete duplicate references
        DELETE FROM recipe_useful_items WHERE useful_item_id = ANY(delete_ids);

        -- Delete duplicate items
        DELETE FROM useful_items WHERE id = ANY(delete_ids);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Add partial index for published recipes (common query pattern)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_recipes_is_published
  ON recipes(is_published)
  WHERE is_published = true;

-- ============================================================================
-- STEP 3: Add NOT NULL constraints to junction table FKs
-- ============================================================================
DELETE FROM recipe_step_ingredients WHERE ingredient_id IS NULL;
DELETE FROM recipe_useful_items WHERE recipe_id IS NULL OR useful_item_id IS NULL;

ALTER TABLE recipe_step_ingredients
  ALTER COLUMN ingredient_id SET NOT NULL;

ALTER TABLE recipe_useful_items
  ALTER COLUMN recipe_id SET NOT NULL,
  ALTER COLUMN useful_item_id SET NOT NULL;

-- ============================================================================
-- STEP 4: Add case-insensitive unique indexes on names
-- ============================================================================
-- Ingredients
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_name_en_unique
  ON ingredients(LOWER(name_en))
  WHERE name_en IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_name_es_unique
  ON ingredients(LOWER(name_es))
  WHERE name_es IS NOT NULL;

-- Recipe tags
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_tags_name_en_unique
  ON recipe_tags(LOWER(name_en))
  WHERE name_en IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_tags_name_es_unique
  ON recipe_tags(LOWER(name_es))
  WHERE name_es IS NOT NULL;

-- Useful items
CREATE UNIQUE INDEX IF NOT EXISTS idx_useful_items_name_en_unique
  ON useful_items(LOWER(name_en))
  WHERE name_en IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_useful_items_name_es_unique
  ON useful_items(LOWER(name_es))
  WHERE name_es IS NOT NULL;

-- ============================================================================
-- STEP 5: Add full-text search index for recipe search
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_recipes_search
  ON recipes
  USING GIN (to_tsvector('english', COALESCE(name_en, '') || ' ' || COALESCE(name_es, '')));
