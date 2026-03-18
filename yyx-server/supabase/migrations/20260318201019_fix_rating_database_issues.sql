-- ============================================================================
-- Fix 1: Replace admin_recipe_feedback_list RPC
-- The old version references dropped name_en/name_es columns.
-- Now joins recipe_translations with locale fallback.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_recipe_feedback_list(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_recipe_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_language text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_page integer := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  safe_offset integer;
  total_count integer := 0;
  rows_json jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  safe_offset := (safe_page - 1) * safe_page_size;

  SELECT COUNT(*)::integer
  INTO total_count
  FROM public.recipe_feedback rf
  WHERE (p_recipe_id IS NULL OR rf.recipe_id = p_recipe_id)
    AND (p_start_date IS NULL OR rf.created_at >= p_start_date)
    AND (p_end_date IS NULL OR rf.created_at <= p_end_date);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', row_data.id,
        'feedback', row_data.feedback,
        'created_at', row_data.created_at,
        'user_id', row_data.user_id,
        'recipe_id', row_data.recipe_id,
        'recipe_name', row_data.recipe_name,
        'user_email', row_data.user_email
      )
      ORDER BY row_data.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO rows_json
  FROM (
    SELECT
      rf.id,
      rf.feedback,
      rf.created_at,
      rf.user_id,
      rf.recipe_id,
      COALESCE(
        NULLIF(pref_t.name, ''),
        NULLIF(en_t.name, ''),
        NULLIF(es_t.name, ''),
        'Untitled'
      ) AS recipe_name,
      COALESCE(up.email, 'Unknown User') AS user_email
    FROM public.recipe_feedback rf
    JOIN public.recipes r ON r.id = rf.recipe_id
    LEFT JOIN public.recipe_translations pref_t
      ON pref_t.recipe_id = r.id AND pref_t.locale = p_language
    LEFT JOIN public.recipe_translations en_t
      ON en_t.recipe_id = r.id AND en_t.locale = 'en'
    LEFT JOIN public.recipe_translations es_t
      ON es_t.recipe_id = r.id AND es_t.locale = 'es'
    LEFT JOIN public.user_profiles up ON up.id = rf.user_id
    WHERE (p_recipe_id IS NULL OR rf.recipe_id = p_recipe_id)
      AND (p_start_date IS NULL OR rf.created_at >= p_start_date)
      AND (p_end_date IS NULL OR rf.created_at <= p_end_date)
    ORDER BY rf.created_at DESC
    OFFSET safe_offset
    LIMIT safe_page_size
  ) AS row_data;

  RETURN jsonb_build_object(
    'data', rows_json,
    'count', total_count,
    'hasMore', (safe_offset + safe_page_size) < total_count
  );
END;
$$;

-- ============================================================================
-- Fix 2: Create get_recipe_rating_distribution RPC
-- Replaces client-side N-row fetch with server-side GROUP BY (max 5 rows).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_recipe_rating_distribution(p_recipe_id uuid)
RETURNS TABLE(rating integer, count bigint)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT rr.rating, COUNT(*)
  FROM public.recipe_ratings rr
  WHERE rr.recipe_id = p_recipe_id
  GROUP BY rr.rating
  ORDER BY rr.rating DESC;
$$;

-- ============================================================================
-- Fix 3: Remove duplicate set_updated_at() function
-- The project already has handle_updated_at(). Repoint the trigger.
-- ============================================================================

-- Drop the duplicate trigger and function
DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.recipe_ratings;
DROP FUNCTION IF EXISTS public.set_updated_at();

-- Recreate trigger using existing handle_updated_at()
CREATE TRIGGER set_updated_at_trigger
  BEFORE UPDATE ON public.recipe_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
