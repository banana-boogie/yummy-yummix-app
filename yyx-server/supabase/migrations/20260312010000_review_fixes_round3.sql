-- ============================================================
-- Review Fixes Round 3
-- 1. Restore security_invoker on convenience views
-- 2. Add SET search_path to admin_analytics (SECURITY DEFINER)
-- 3. Fix misleading COMMENT on batch_find_ingredients
-- 4. Drop orphaned check_base_translation function
-- ============================================================

-- 1. Views were recreated in migrations 7 and 9 without reapplying
--    security_invoker = true (set in migration 6). This restores it.
ALTER VIEW public.recipes_summary SET (security_invoker = true);
ALTER VIEW public.ingredients_summary SET (security_invoker = true);

-- 2. SECURITY DEFINER functions must pin search_path to prevent hijacking.
--    Recreate admin_analytics with SET search_path = public.
DROP FUNCTION IF EXISTS admin_analytics(text, text, int);
CREATE OR REPLACE FUNCTION admin_analytics(action text, timeframe text DEFAULT '7d', "limit" int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  tf interval;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

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
    result := null;
  END IF;

  RETURN result;
END;
$$;

-- 3. Fix misleading threshold comment (actual value is 0.5, not 0.7)
COMMENT ON FUNCTION public.batch_find_ingredients(text[], text) IS
  'Batch fuzzy ingredient search. Accepts array of ingredient names. Returns matches with similarity >= 0.5. Uses preferred_locale with fallback chain for name resolution.';

-- 4. check_base_translation() is orphaned — all constraint triggers were
--    dropped in migration 7 but the function was recreated in migration 9.
DROP FUNCTION IF EXISTS public.check_base_translation() CASCADE;
