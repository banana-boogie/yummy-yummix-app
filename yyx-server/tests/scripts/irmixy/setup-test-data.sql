-- ============================================================================
-- Phase 1 Irmixy AI - Test Data Setup
-- ============================================================================
--
-- This script sets up test data for running the Phase 1 test suite.
-- Run this after the main migration but before running tests.
--
-- Usage:
--   psql -h localhost -p 54322 -U postgres -d postgres -f setup-test-data.sql
--
-- ============================================================================

-- Create a test user profile (if using existing dev user)
-- Note: The dev user is created by npm run dev:setup in yyx-app

-- ============================================================================
-- Test Recipes (if needed for allergen filtering tests)
-- ============================================================================

-- Check if recipes table exists and has minimal test data
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recipes') THEN
    -- Insert test recipes if none exist
    IF NOT EXISTS (SELECT 1 FROM recipes WHERE id = '00000000-0000-0000-0000-000000000001') THEN
      INSERT INTO recipes (id, name, name_es, description, description_es, difficulty, prep_time_minutes, cook_time_minutes, total_time_minutes, servings, cuisine, created_at)
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'Simple Pasta', 'Pasta Simple', 'Easy pasta with olive oil and garlic', 'Pasta fácil con aceite de oliva y ajo', 'easy', 10, 15, 25, 4, 'Italian', NOW()),
        ('00000000-0000-0000-0000-000000000002', 'Chocolate Cake', 'Pastel de Chocolate', 'Rich chocolate cake', 'Pastel de chocolate rico', 'medium', 30, 45, 75, 8, 'American', NOW()),
        ('00000000-0000-0000-0000-000000000003', 'Vegetable Stir Fry', 'Salteado de Verduras', 'Quick vegetable stir fry', 'Salteado rápido de verduras', 'easy', 15, 10, 25, 2, 'Asian', NOW()),
        ('00000000-0000-0000-0000-000000000004', 'Beef Tacos', 'Tacos de Res', 'Classic beef tacos', 'Tacos clásicos de res', 'easy', 15, 20, 35, 4, 'Mexican', NOW()),
        ('00000000-0000-0000-0000-000000000005', 'Eggplant Parmesan', 'Berenjena a la Parmesana', 'Baked eggplant with cheese', 'Berenjena al horno con queso', 'medium', 30, 45, 75, 6, 'Italian', NOW())
      ON CONFLICT (id) DO NOTHING;

      RAISE NOTICE 'Inserted 5 test recipes';
    ELSE
      RAISE NOTICE 'Test recipes already exist';
    END IF;
  ELSE
    RAISE NOTICE 'Recipes table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- Test Recipe Ingredients (for allergen filtering)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recipe_ingredients') THEN
    -- Insert test ingredients if none exist
    IF NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE recipe_id = '00000000-0000-0000-0000-000000000001') THEN
      INSERT INTO recipe_ingredients (id, recipe_id, ingredient_name, ingredient_name_es, quantity, unit, created_at)
      VALUES
        -- Simple Pasta (no allergens for basic version)
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'pasta', 'pasta', '400', 'g', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'olive oil', 'aceite de oliva', '3', 'tbsp', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'garlic', 'ajo', '4', 'cloves', NOW()),

        -- Chocolate Cake (contains eggs, dairy)
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'flour', 'harina', '200', 'g', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'eggs', 'huevos', '3', 'whole', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'milk', 'leche', '240', 'ml', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'butter', 'mantequilla', '100', 'g', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'cocoa powder', 'cacao en polvo', '50', 'g', NOW()),

        -- Vegetable Stir Fry (vegan, gluten-free option)
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'broccoli', 'brócoli', '200', 'g', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'carrots', 'zanahorias', '150', 'g', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'soy sauce', 'salsa de soja', '2', 'tbsp', NOW()),

        -- Beef Tacos (contains dairy if using cheese)
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'ground beef', 'carne molida', '500', 'g', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'corn tortillas', 'tortillas de maíz', '8', 'whole', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'cheese', 'queso', '100', 'g', NOW()),

        -- Eggplant Parmesan (contains dairy, eggs) - tests word boundary
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'eggplant', 'berenjena', '2', 'large', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'parmesan cheese', 'queso parmesano', '100', 'g', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'eggs', 'huevos', '2', 'whole', NOW()),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'breadcrumbs', 'pan rallado', '150', 'g', NOW())
      ON CONFLICT DO NOTHING;

      RAISE NOTICE 'Inserted test recipe ingredients';
    ELSE
      RAISE NOTICE 'Test recipe ingredients already exist';
    END IF;
  ELSE
    RAISE NOTICE 'Recipe_ingredients table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- Test Cooking Session (for resumable session tests)
-- ============================================================================

DO $$
DECLARE
  test_user_id UUID;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cooking_sessions') THEN
    -- Find the dev user
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = 'dev@yummyyummix.local'
    LIMIT 1;

    IF test_user_id IS NOT NULL THEN
      -- Create an active cooking session for testing
      INSERT INTO cooking_sessions (
        id, user_id, recipe_id, recipe_name, current_step, total_steps, status, last_active_at, created_at
      )
      VALUES (
        '00000000-0000-0000-0000-000000000099',
        test_user_id,
        '00000000-0000-0000-0000-000000000001',
        'Simple Pasta',
        3,
        8,
        'active',
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '2 hours'
      )
      ON CONFLICT (id) DO UPDATE SET
        current_step = EXCLUDED.current_step,
        last_active_at = EXCLUDED.last_active_at;

      RAISE NOTICE 'Created test cooking session for user %', test_user_id;
    ELSE
      RAISE NOTICE 'Dev user not found - run npm run dev:setup first';
    END IF;
  ELSE
    RAISE NOTICE 'Cooking_sessions table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- Test User Preferences (dietary restrictions)
-- ============================================================================

DO $$
DECLARE
  test_user_id UUID;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profile') THEN
    -- Find the dev user
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = 'dev@yummyyummix.local'
    LIMIT 1;

    IF test_user_id IS NOT NULL THEN
      -- Update user profile with test dietary restrictions
      UPDATE user_profile
      SET
        dietary_restrictions = ARRAY['nuts']::text[],
        ingredient_dislikes = ARRAY['cilantro']::text[],
        updated_at = NOW()
      WHERE user_id = test_user_id;

      IF NOT FOUND THEN
        RAISE NOTICE 'User profile not found for dev user - may need to complete onboarding';
      ELSE
        RAISE NOTICE 'Updated user profile with test dietary restrictions';
      END IF;
    ELSE
      RAISE NOTICE 'Dev user not found - run npm run dev:setup first';
    END IF;
  ELSE
    RAISE NOTICE 'User_profile table does not exist - skipping';
  END IF;
END $$;

-- ============================================================================
-- Create Stale Session for Testing (>24 hours old)
-- ============================================================================

DO $$
DECLARE
  test_user_id UUID;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cooking_sessions') THEN
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = 'dev@yummyyummix.local'
    LIMIT 1;

    IF test_user_id IS NOT NULL THEN
      INSERT INTO cooking_sessions (
        id, user_id, recipe_id, recipe_name, current_step, total_steps, status, last_active_at, created_at
      )
      VALUES (
        '00000000-0000-0000-0000-000000000098',
        test_user_id,
        '00000000-0000-0000-0000-000000000002',
        'Chocolate Cake',
        2,
        10,
        'active',
        NOW() - INTERVAL '25 hours',
        NOW() - INTERVAL '26 hours'
      )
      ON CONFLICT (id) DO UPDATE SET
        last_active_at = NOW() - INTERVAL '25 hours';

      RAISE NOTICE 'Created stale cooking session (25h old) for testing';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================

SELECT 'Test data setup complete!' AS status;

-- Show counts
SELECT
  (SELECT COUNT(*) FROM recipes WHERE id LIKE '00000000-0000-0000-0000-00000000000%') AS test_recipes,
  (SELECT COUNT(*) FROM cooking_sessions WHERE id LIKE '00000000-0000-0000-0000-00000000009%') AS test_sessions,
  (SELECT COUNT(*) FROM ingredient_aliases) AS ingredient_aliases,
  (SELECT COUNT(*) FROM allergen_groups) AS allergen_groups,
  (SELECT COUNT(*) FROM food_safety_rules) AS food_safety_rules;
