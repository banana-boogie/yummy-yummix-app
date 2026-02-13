-- Migration: Harden rating/completion integrity and add admin feedback RPC
-- Created: 2026-02-12
-- Description:
--   1) Convert recipe_completions to append-only completion events
--   2) Enforce completion-gated rating writes at DB policy level
--   3) Add admin_recipe_feedback_list RPC for secure admin feedback retrieval

-- ============================================================================
-- 1. Convert recipe_completions to append-only events
-- ============================================================================

-- Drop legacy RLS policies before restructuring
DROP POLICY IF EXISTS "Users can view own completions" ON public.recipe_completions;
DROP POLICY IF EXISTS "Users can insert own completions" ON public.recipe_completions;
DROP POLICY IF EXISTS "Users can update own completions" ON public.recipe_completions;
DROP POLICY IF EXISTS "Users can delete own completions" ON public.recipe_completions;

-- Allow multiple completion events per user+recipe
ALTER TABLE public.recipe_completions
  DROP CONSTRAINT IF EXISTS recipe_completions_user_id_recipe_id_key;

-- Add append-only timestamp column
ALTER TABLE public.recipe_completions
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill the primary event timestamp on existing rows
UPDATE public.recipe_completions
SET completed_at = COALESCE(last_completed_at, first_completed_at, now())
WHERE completed_at IS NULL;

-- Expand historical counter rows into individual completion events
INSERT INTO public.recipe_completions (id, user_id, recipe_id, completed_at)
SELECT
  uuid_generate_v4(),
  rc.user_id,
  rc.recipe_id,
  COALESCE(rc.last_completed_at, rc.first_completed_at, rc.completed_at, now())
    - make_interval(secs => gs.offset_seconds)
FROM public.recipe_completions rc
JOIN LATERAL generate_series(
  1,
  GREATEST(COALESCE(rc.completion_count, 1) - 1, 0)
) AS gs(offset_seconds) ON true;

-- Finalize append-only schema
UPDATE public.recipe_completions
SET completed_at = now()
WHERE completed_at IS NULL;

ALTER TABLE public.recipe_completions
  ALTER COLUMN completed_at SET DEFAULT now(),
  ALTER COLUMN completed_at SET NOT NULL;

ALTER TABLE public.recipe_completions
  DROP COLUMN IF EXISTS completion_count,
  DROP COLUMN IF EXISTS first_completed_at,
  DROP COLUMN IF EXISTS last_completed_at;

-- Replace legacy indexes
DROP INDEX IF EXISTS idx_recipe_completions_last_completed;
DROP INDEX IF EXISTS idx_recipe_completions_user_id;
DROP INDEX IF EXISTS idx_recipe_completions_recipe_id;

CREATE INDEX IF NOT EXISTS idx_recipe_completions_user_recipe
  ON public.recipe_completions(user_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_completions_recipe_completed_at
  ON public.recipe_completions(recipe_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_completions_user_completed_at
  ON public.recipe_completions(user_id, completed_at DESC);

-- Recreate append-only RLS policies
CREATE POLICY "Users can view own completions"
  ON public.recipe_completions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completions"
  ON public.recipe_completions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own completions"
  ON public.recipe_completions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Enforce completion-gated rating writes
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own ratings" ON public.recipe_ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON public.recipe_ratings;

CREATE POLICY "Users can insert own ratings"
  ON public.recipe_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.recipe_completions rc
      WHERE rc.user_id = auth.uid()
        AND rc.recipe_id = recipe_id
    )
  );

CREATE POLICY "Users can update own ratings"
  ON public.recipe_ratings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.recipe_completions rc
      WHERE rc.user_id = auth.uid()
        AND rc.recipe_id = recipe_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.recipe_completions rc
      WHERE rc.user_id = auth.uid()
        AND rc.recipe_id = recipe_id
    )
  );

-- ============================================================================
-- 3. Admin feedback retrieval RPC
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
      CASE
        WHEN p_language = 'es' THEN r.name_es
        ELSE r.name_en
      END AS recipe_name,
      COALESCE(up.email, 'Unknown User') AS user_email
    FROM public.recipe_feedback rf
    JOIN public.recipes r ON r.id = rf.recipe_id
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

REVOKE ALL ON FUNCTION public.admin_recipe_feedback_list(integer, integer, uuid, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recipe_feedback_list(integer, integer, uuid, timestamptz, timestamptz, text) TO authenticated;
