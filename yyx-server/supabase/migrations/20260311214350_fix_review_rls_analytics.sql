-- Migration: Fix PR #32 review findings
-- 1. RLS: Gate nested recipe translation tables on parent is_published
-- 2. Analytics: Remove references to dropped cooking_sessions, handle unknown actions gracefully

-- ============================================================
-- 1. Fix RLS on nested recipe translation tables
--    These had USING (true) which exposed unpublished draft content.
--    Gate on parent recipes.is_published, with admin override.
-- ============================================================

-- recipe_step_translations: recipe_step_id -> recipe_steps.recipe_id -> recipes.is_published
DROP POLICY IF EXISTS "Anyone can read recipe step translations" ON public.recipe_step_translations;

CREATE POLICY "Anyone can read published recipe step translations"
  ON public.recipe_step_translations FOR SELECT TO anon, authenticated
  USING (
    recipe_step_id IN (
      SELECT rs.id FROM public.recipe_steps rs
      JOIN public.recipes r ON r.id = rs.recipe_id
      WHERE r.is_published = true
    )
  );

CREATE POLICY "Admins can read all recipe step translations"
  ON public.recipe_step_translations FOR SELECT TO authenticated
  USING (public.is_admin());

-- recipe_ingredient_translations: recipe_ingredient_id -> recipe_ingredients.recipe_id -> recipes.is_published
DROP POLICY IF EXISTS "Anyone can read recipe ingredient translations" ON public.recipe_ingredient_translations;

CREATE POLICY "Anyone can read published recipe ingredient translations"
  ON public.recipe_ingredient_translations FOR SELECT TO anon, authenticated
  USING (
    recipe_ingredient_id IN (
      SELECT ri.id FROM public.recipe_ingredients ri
      JOIN public.recipes r ON r.id = ri.recipe_id
      WHERE r.is_published = true
    )
  );

CREATE POLICY "Admins can read all recipe ingredient translations"
  ON public.recipe_ingredient_translations FOR SELECT TO authenticated
  USING (public.is_admin());

-- recipe_useful_item_translations: recipe_useful_item_id -> recipe_useful_items.recipe_id -> recipes.is_published
DROP POLICY IF EXISTS "Anyone can read recipe useful item translations" ON public.recipe_useful_item_translations;

CREATE POLICY "Anyone can read published recipe useful item translations"
  ON public.recipe_useful_item_translations FOR SELECT TO anon, authenticated
  USING (
    recipe_useful_item_id IN (
      SELECT rui.id FROM public.recipe_useful_items rui
      JOIN public.recipes r ON r.id = rui.recipe_id
      WHERE r.is_published = true
    )
  );

CREATE POLICY "Admins can read all recipe useful item translations"
  ON public.recipe_useful_item_translations FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 2. Fix admin_analytics: remove cooking_sessions references,
--    handle unknown actions gracefully
-- ============================================================

DROP FUNCTION IF EXISTS admin_analytics(text, text, int);
CREATE OR REPLACE FUNCTION admin_analytics(action text, timeframe text DEFAULT '7d', "limit" int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  tf interval;
BEGIN
  -- Verify caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Parse timeframe
  tf := CASE timeframe
    WHEN '24h' THEN interval '24 hours'
    WHEN '7d' THEN interval '7 days'
    WHEN '30d' THEN interval '30 days'
    WHEN '90d' THEN interval '90 days'
    WHEN 'all' THEN interval '100 years'
    ELSE interval '7 days'
  END;

  IF action = 'overview' THEN
    WITH user_counts AS (
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_users,
        COUNT(*) FILTER (WHERE onboarding_complete = true)::int AS onboarded_users
      FROM user_profiles
    ),
    recipe_counts AS (
      SELECT
        COUNT(*)::int AS total_recipes,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_recipes
      FROM recipes
    ),
    session_counts AS (
      SELECT
        COUNT(*)::int AS total_sessions,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_sessions,
        COUNT(DISTINCT user_id) FILTER (WHERE created_at > now() - tf)::int AS active_users
      FROM user_chat_sessions
    ),
    message_counts AS (
      SELECT
        COUNT(*)::int AS total_messages,
        COUNT(*) FILTER (WHERE created_at > now() - tf)::int AS new_messages
      FROM user_chat_messages
    )
    SELECT jsonb_build_object(
      'totalUsers', (SELECT total_users FROM user_counts),
      'newUsers', (SELECT new_users FROM user_counts),
      'onboardedUsers', (SELECT onboarded_users FROM user_counts),
      'totalRecipes', (SELECT total_recipes FROM recipe_counts),
      'newRecipes', (SELECT new_recipes FROM recipe_counts),
      'totalSessions', (SELECT total_sessions FROM session_counts),
      'newSessions', (SELECT new_sessions FROM session_counts),
      'activeUsers', (SELECT active_users FROM session_counts),
      'totalMessages', (SELECT total_messages FROM message_counts),
      'newMessages', (SELECT new_messages FROM message_counts)
    )
    INTO result;

  ELSIF action = 'engagement' THEN
    -- Top recipes: cooking_sessions was dropped, return empty until rebuild
    -- Active users: chat activity still works
    WITH active_users AS (
      SELECT jsonb_agg(jsonb_build_object(
        'name', up.name,
        'email', up.email,
        'messageCount', mc.msg_count,
        'sessionCount', mc.sess_count
      ) ORDER BY mc.msg_count DESC) AS data
      FROM (
        SELECT
          m.user_id,
          COUNT(*)::int AS msg_count,
          COUNT(DISTINCT m.session_id)::int AS sess_count
        FROM user_chat_messages m
        JOIN user_chat_sessions s ON s.id = m.session_id
        WHERE m.created_at > now() - tf
        AND m.role = 'user'
        GROUP BY m.user_id
        ORDER BY msg_count DESC
        LIMIT "limit"
      ) mc
      JOIN user_profiles up ON up.id = mc.user_id
    )
    SELECT jsonb_build_object(
      'topRecipes', '[]'::jsonb,
      'activeUsers', COALESCE((SELECT data FROM active_users), '[]'::jsonb)
    )
    INTO result;

  ELSIF action = 'patterns' THEN
    -- Chat activity by hour (replaces dropped cooking_sessions)
    WITH chat_by_hour AS (
      SELECT jsonb_agg(jsonb_build_object(
        'hour', hour,
        'count', count
      ) ORDER BY hour) AS data
      FROM (
        SELECT hours.hour, COALESCE(counts.count, 0)::int AS count
        FROM generate_series(0, 23) AS hours(hour)
        LEFT JOIN (
          SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
          FROM user_chat_sessions
          WHERE created_at > now() - tf
          GROUP BY 1
        ) counts ON counts.hour = hours.hour
      ) hourly
    ),
    language_split AS (
      SELECT jsonb_agg(jsonb_build_object(
        'language', locale,
        'count', count
      ) ORDER BY count DESC) AS data
      FROM (
        SELECT COALESCE(locale, 'en') AS locale, COUNT(*)::int AS count
        FROM user_profiles
        GROUP BY 1
      ) langs
    )
    SELECT jsonb_build_object(
      'cookingByHour', COALESCE((SELECT data FROM chat_by_hour), '[]'::jsonb),
      'languageSplit', COALESCE((SELECT data FROM language_split), '[]'::jsonb)
    )
    INTO result;

  ELSE
    -- Unknown action: return null gracefully instead of crashing
    -- Frontend may call actions not yet implemented (retention, funnel, etc.)
    result := 'null'::jsonb;
  END IF;

  RETURN result;
END;
$$;
