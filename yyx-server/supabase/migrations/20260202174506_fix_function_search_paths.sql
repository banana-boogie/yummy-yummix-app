-- Fix function search paths to prevent SQL injection via search_path manipulation
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1. Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2. Fix update_ai_voice_usage
CREATE OR REPLACE FUNCTION public.update_ai_voice_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds IS NOT NULL THEN
    INSERT INTO ai_voice_usage (
      user_id,
      month,
      minutes_used,
      conversations_count,
      total_cost_usd,
      openai_minutes,
      openai_cost,
      hts_minutes,
      hts_cost
    )
    VALUES (
      NEW.user_id,
      TO_CHAR(NEW.started_at, 'YYYY-MM'),
      NEW.duration_seconds / 60.0,
      1,
      COALESCE(NEW.cost_usd, 0.00),
      CASE WHEN NEW.provider_type = 'openai-realtime' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      CASE WHEN NEW.provider_type = 'openai-realtime' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END,
      CASE WHEN NEW.provider_type = 'hear-think-speak' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      CASE WHEN NEW.provider_type = 'hear-think-speak' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END
    )
    ON CONFLICT (user_id, month) DO UPDATE SET
      minutes_used = ai_voice_usage.minutes_used + (NEW.duration_seconds / 60.0),
      conversations_count = ai_voice_usage.conversations_count + 1,
      total_cost_usd = ai_voice_usage.total_cost_usd + COALESCE(NEW.cost_usd, 0.00),
      openai_minutes = ai_voice_usage.openai_minutes + CASE WHEN NEW.provider_type = 'openai-realtime' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      openai_cost = ai_voice_usage.openai_cost + CASE WHEN NEW.provider_type = 'openai-realtime' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END,
      hts_minutes = ai_voice_usage.hts_minutes + CASE WHEN NEW.provider_type = 'hear-think-speak' THEN NEW.duration_seconds / 60.0 ELSE 0 END,
      hts_cost = ai_voice_usage.hts_cost + CASE WHEN NEW.provider_type = 'hear-think-speak' THEN COALESCE(NEW.cost_usd, 0.00) ELSE 0 END,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Fix add_updated_at_column
CREATE OR REPLACE FUNCTION public.add_updated_at_column(table_name regclass)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Add updated_at column if it doesn't exist
    EXECUTE format('
        ALTER TABLE %I
        ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone
        NOT NULL DEFAULT timezone(''utc''::text, now())',
        table_name
    );

    -- Create the trigger
    EXECUTE format('
        DROP TRIGGER IF EXISTS handle_updated_at ON %I;
        CREATE TRIGGER handle_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION handle_updated_at()',
        table_name,
        table_name
    );
END;
$$;

-- 4. Fix add_updated_at_to_all_tables
CREATE OR REPLACE FUNCTION public.add_updated_at_to_all_tables(schema_name text DEFAULT 'public')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    table_record record;
BEGIN
    FOR table_record IN
        SELECT table_name::text
        FROM information_schema.tables
        WHERE table_schema = schema_name
        AND table_type = 'BASE TABLE'
    LOOP
        PERFORM add_updated_at_column(format('%I.%I', schema_name, table_record.table_name)::regclass);
    END LOOP;
END;
$$;
