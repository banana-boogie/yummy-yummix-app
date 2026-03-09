-- Migration: Add locale column to user_profiles
-- Replaces the simple language ('en'/'es') column with a locale column
-- that references the locales table for regional specificity (e.g., 'es-MX').
-- NOTE: locales table and resolve_locale function already exist from PR1.

-- 1. Add locale column to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS locale text REFERENCES locales(code);

-- 2. Backfill: map existing language values to locale codes
UPDATE user_profiles
SET locale = CASE
  WHEN language = 'es' THEN 'es-MX'
  ELSE 'en'
END
WHERE locale IS NULL;

-- 3. Set default for new rows
ALTER TABLE user_profiles
  ALTER COLUMN locale SET DEFAULT 'en';

-- 4. Drop the old language column (no active users -- safe)
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS language;

-- 5. Update admin_analytics function to use locale instead of language
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
    WITH top_recipes AS (
      SELECT jsonb_agg(jsonb_build_object(
        'name', COALESCE(rt_es.name, rt_en.name, 'Untitled'),
        'nameEn', COALESCE(rt_en.name, 'Untitled'),
        'cookCount', cs.cook_count
      ) ORDER BY cs.cook_count DESC) AS data
      FROM (
        SELECT recipe_id, COUNT(*)::int AS cook_count
        FROM cooking_sessions
        WHERE started_at > now() - tf
        GROUP BY recipe_id
        ORDER BY cook_count DESC
        LIMIT "limit"
      ) cs
      JOIN recipes r ON r.id = cs.recipe_id
      LEFT JOIN recipe_translations rt_es ON rt_es.recipe_id = r.id AND rt_es.locale = 'es'
      LEFT JOIN recipe_translations rt_en ON rt_en.recipe_id = r.id AND rt_en.locale = 'en'
    ),
    active_users AS (
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
      'topRecipes', COALESCE((SELECT data FROM top_recipes), '[]'::jsonb),
      'activeUsers', COALESCE((SELECT data FROM active_users), '[]'::jsonb)
    )
    INTO result;

  ELSIF action = 'patterns' THEN
    WITH cooking_by_hour AS (
      SELECT jsonb_agg(jsonb_build_object(
        'hour', hour,
        'count', count
      ) ORDER BY hour) AS data
      FROM (
        SELECT hours.hour, COALESCE(counts.count, 0)::int AS count
        FROM generate_series(0, 23) AS hours(hour)
        LEFT JOIN (
          SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS count
          FROM cooking_sessions
          WHERE started_at > now() - tf
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
      'cookingByHour', COALESCE((SELECT data FROM cooking_by_hour), '[]'::jsonb),
      'languageSplit', COALESCE((SELECT data FROM language_split), '[]'::jsonb)
    )
    INTO result;

  ELSE
    RAISE EXCEPTION 'Unknown analytics action: %', action;
  END IF;

  RETURN result;
END;
$$;
