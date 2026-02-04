

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."activity_level" AS ENUM (
    'sedentary',
    'lightlyActive',
    'moderatelyActive',
    'veryActive',
    'extraActive'
);


ALTER TYPE "public"."activity_level" OWNER TO "postgres";


CREATE TYPE "public"."diet_type" AS ENUM (
    'none',
    'keto',
    'lactoVegetarian',
    'mediterranean',
    'ovoVegetarian',
    'paleo',
    'pescatarian',
    'sugarFree',
    'vegan',
    'vegetarian',
    'other'
);


ALTER TYPE "public"."diet_type" OWNER TO "postgres";


CREATE TYPE "public"."dietary_restriction" AS ENUM (
    'none',
    'nuts',
    'dairy',
    'eggs',
    'seafood',
    'gluten',
    'other'
);


ALTER TYPE "public"."dietary_restriction" OWNER TO "postgres";


CREATE TYPE "public"."measurement_system" AS ENUM (
    'metric',
    'imperial'
);


ALTER TYPE "public"."measurement_system" OWNER TO "postgres";


CREATE TYPE "public"."recipe_complete" AS (
	"id" "uuid",
	"name" "text",
	"steps" "jsonb",
	"description" "text",
	"display_picture_url" "text",
	"difficulty" "text",
	"prep_time" integer,
	"total_time" integer,
	"portions" "text",
	"useful_items" "text",
	"nutritional_value" "jsonb",
	"tips_and_tricks" "text",
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"tags" "text"[],
	"ingredients" "jsonb"
);


ALTER TYPE "public"."recipe_complete" OWNER TO "postgres";


CREATE TYPE "public"."recipe_difficulty" AS ENUM (
    'easy',
    'medium',
    'hard'
);


ALTER TYPE "public"."recipe_difficulty" OWNER TO "postgres";


CREATE TYPE "public"."recipe_tag_category" AS ENUM (
    'INGREDIENTS',
    'OILS_AND_FATS',
    'GENERAL',
    'CULTURAL_CUISINE',
    'FRUITS',
    'VEGETABLES',
    'HERBS_AND_SPICES',
    'DIETARY_RESTRICTIONS',
    'GRAINS_AND_STARCHES',
    'DAIRY_AND_ALTERNATIVES',
    'HOLIDAY',
    'PROTEINS',
    'NUTS_AND_SEEDS',
    'LEGUMES',
    'SWEETENERS_AND_BAKING',
    'LIQUID'
);


ALTER TYPE "public"."recipe_tag_category" OWNER TO "postgres";


CREATE TYPE "public"."temperature_units" AS ENUM (
    'F',
    'C'
);


ALTER TYPE "public"."temperature_units" OWNER TO "postgres";


CREATE TYPE "public"."thermomix_speed_type" AS ENUM (
    'spoon',
    '0.5',
    '1',
    '1.5',
    '2',
    '2.5',
    '3',
    '3.5',
    '4',
    '4.5',
    '5',
    '5.5',
    '6',
    '6.5',
    '7',
    '7.5',
    '8',
    '8.5',
    '9',
    '9.5',
    '10'
);


ALTER TYPE "public"."thermomix_speed_type" OWNER TO "postgres";


CREATE TYPE "public"."thermomix_temperature_type" AS ENUM (
    '37',
    '40',
    '45',
    '50',
    '55',
    '60',
    '65',
    '70',
    '75',
    '80',
    '85',
    '90',
    '95',
    '98',
    '100',
    '105',
    '110',
    '115',
    '120',
    'Varoma',
    '130',
    '140',
    '150',
    '160',
    '170',
    '175',
    '185',
    '195',
    '200',
    '205',
    '212',
    '220',
    '230',
    '240',
    '250'
);


ALTER TYPE "public"."thermomix_temperature_type" OWNER TO "postgres";


CREATE TYPE "public"."user_gender" AS ENUM (
    'male',
    'female',
    'other',
    'preferNotToSay'
);


ALTER TYPE "public"."user_gender" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_enum_value"("enum_name" "text", "new_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_values text[];
  sql text;
BEGIN
  -- Get existing enum values
  EXECUTE format('SELECT array_agg(enumlabel) FROM pg_enum WHERE enumtypid = %L::regtype', enum_name)
  INTO current_values;
  
  -- Check if the value already exists
  IF new_value = ANY(current_values) THEN
    RAISE NOTICE 'Value "%" already exists in enum "%"', new_value, enum_name;
    RETURN;
  END IF;
  
  -- Add the new value to the enum
  sql := format('ALTER TYPE %I ADD VALUE %L', enum_name, new_value);
  EXECUTE sql;
  
  RAISE NOTICE 'Added "%" to enum "%"', new_value, enum_name;
END;
$$;


ALTER FUNCTION "public"."add_enum_value"("enum_name" "text", "new_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_updated_at_column"("table_name" "regclass") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."add_updated_at_column"("table_name" "regclass") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_updated_at_to_all_tables"("schema_name" "text" DEFAULT 'public'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."add_updated_at_to_all_tables"("schema_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_enum_values"("enum_name" "text") RETURNS TABLE("enum_value" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT unnest(enum_range(NULL::%I))::text as enum_value', 
    enum_name
  );
END;
$$;


ALTER FUNCTION "public"."get_enum_values"("enum_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = (SELECT auth.uid())),
    false
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ai_voice_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_ai_voice_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_voice_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "duration_seconds" numeric(10,2),
    "started_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "cost_usd" numeric(10,6) DEFAULT 0.00,
    "input_text_tokens" integer DEFAULT 0,
    "input_audio_tokens" integer DEFAULT 0,
    "output_text_tokens" integer DEFAULT 0,
    "output_audio_tokens" integer DEFAULT 0,
    "provider_type" "text" DEFAULT 'openai-realtime'::"text" NOT NULL,
    "stt_cost_usd" numeric(10,6) DEFAULT 0.00,
    "llm_cost_usd" numeric(10,6) DEFAULT 0.00,
    "tts_cost_usd" numeric(10,6) DEFAULT 0.00,
    "llm_tokens_input" integer DEFAULT 0,
    "llm_tokens_output" integer DEFAULT 0,
    "tts_characters" integer DEFAULT 0
);


ALTER TABLE "public"."ai_voice_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_voice_sessions"."input_text_tokens" IS 'Text input tokens - priced at $0.60 per 1M tokens';



COMMENT ON COLUMN "public"."ai_voice_sessions"."input_audio_tokens" IS 'Audio input tokens - priced at $10 per 1M tokens';



COMMENT ON COLUMN "public"."ai_voice_sessions"."output_text_tokens" IS 'Text output tokens - priced at $2.40 per 1M tokens';



COMMENT ON COLUMN "public"."ai_voice_sessions"."output_audio_tokens" IS 'Audio output tokens - priced at $20 per 1M tokens';



COMMENT ON COLUMN "public"."ai_voice_sessions"."provider_type" IS 'Voice provider: openai-realtime (premium) or hear-think-speak (standard)';



COMMENT ON COLUMN "public"."ai_voice_sessions"."stt_cost_usd" IS 'Speech-to-text cost (HearThinkSpeak only)';



COMMENT ON COLUMN "public"."ai_voice_sessions"."llm_cost_usd" IS 'LLM inference cost (HearThinkSpeak only)';



COMMENT ON COLUMN "public"."ai_voice_sessions"."tts_cost_usd" IS 'Text-to-speech cost (HearThinkSpeak only)';



CREATE TABLE IF NOT EXISTS "public"."ai_voice_usage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month" "text" NOT NULL,
    "minutes_used" numeric(10,2) DEFAULT 0,
    "conversations_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_cost_usd" numeric(10,2) DEFAULT 0.00,
    "openai_minutes" numeric(10,2) DEFAULT 0.00,
    "openai_cost" numeric(10,2) DEFAULT 0.00,
    "hts_minutes" numeric(10,2) DEFAULT 0.00,
    "hts_cost" numeric(10,2) DEFAULT 0.00
);


ALTER TABLE "public"."ai_voice_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allergen_groups" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category" "text" NOT NULL,
    "ingredient_canonical" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_es" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."allergen_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "image_url" "text",
    "nutritional_facts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name_en" "text",
    "name_es" "text",
    "plural_name_en" "text",
    "plural_name_es" "text"
);


ALTER TABLE "public"."ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_units" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "system" "text" NOT NULL,
    "symbol_en" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_en_plural" "text" NOT NULL,
    "symbol_es" "text" NOT NULL,
    "name_es" "text" NOT NULL,
    "name_es_plural" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "symbol_en_plural" "text",
    "symbol_es_plural" "text"
);


ALTER TABLE "public"."measurement_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_ingredients" (
    "recipe_id" "uuid" NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "quantity" numeric(10,2),
    "recipe_section_en" "text" DEFAULT 'Main'::"text" NOT NULL,
    "display_order" integer,
    "optional" boolean DEFAULT false,
    "notes_en" "text",
    "notes_es" "text",
    "measurement_unit_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recipe_section_es" "text" DEFAULT 'Principal'::"text" NOT NULL,
    "tip_en" "text",
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tip_es" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recipe_ingredients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recipe_ingredients"."recipe_section_en" IS 'Name of the section of the recipe the ingredient belongs to (ENGLISH)';



COMMENT ON COLUMN "public"."recipe_ingredients"."recipe_section_es" IS 'Name of the section of the recipe the ingredient belongs to (SPANISH)';



COMMENT ON COLUMN "public"."recipe_ingredients"."tip_en" IS 'Tip for an ingredient in the recipe';



CREATE TABLE IF NOT EXISTS "public"."recipe_step_ingredients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "recipe_step_id" "uuid" NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "measurement_unit_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_order" integer,
    "optional" boolean DEFAULT false
);


ALTER TABLE "public"."recipe_step_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "order" integer NOT NULL,
    "instruction_en" "text" NOT NULL,
    "instruction_es" "text" NOT NULL,
    "thermomix_time" integer,
    "thermomix_temperature" "public"."thermomix_temperature_type",
    "recipe_section_en" "text" DEFAULT 'Main'::"text",
    "recipe_section_es" "text" DEFAULT 'Principal'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "thermomix_temperature_unit" "public"."temperature_units",
    "tip_en" "text",
    "tip_es" "text",
    "thermomix_is_blade_reversed" boolean,
    "thermomix_speed" "public"."thermomix_speed_type",
    "thermomix_speed_start" "public"."thermomix_speed_type",
    "thermomix_speed_end" "public"."thermomix_speed_type"
);


ALTER TABLE "public"."recipe_steps" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recipe_steps"."recipe_section_en" IS 'Part of the recipe that the instruction belongs to in ENGLISH';



COMMENT ON COLUMN "public"."recipe_steps"."thermomix_temperature_unit" IS 'Temperature unit shorthand Fahrenheit (F) or Celsius (C)';



CREATE TABLE IF NOT EXISTS "public"."recipe_tags" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name_en" "text",
    "name_es" "text",
    "categories" "public"."recipe_tag_category"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recipe_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_to_tag" (
    "recipe_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recipe_to_tag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_useful_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "useful_item_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes_en" "text",
    "notes_es" "text"
);


ALTER TABLE "public"."recipe_useful_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "image_url" "text",
    "prep_time" integer,
    "total_time" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_published" boolean DEFAULT false,
    "name_en" "text",
    "name_es" "text",
    "tips_and_tricks_en" "text",
    "tips_and_tricks_es" "text",
    "portions" smallint,
    "difficulty" "public"."recipe_difficulty",
    "nutritional_facts" "jsonb"
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."useful_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name_en" "text" NOT NULL,
    "name_es" "text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."useful_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "tool_calls" "jsonb",
    "tool_call_id" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."user_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_chat_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['view_recipe'::"text", 'cook_start'::"text", 'cook_complete'::"text", 'rate_recipe'::"text", 'search'::"text", 'chat_message'::"text", 'save_recipe'::"text"])))
);


ALTER TABLE "public"."user_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "biography" "text",
    "gender" "public"."user_gender",
    "birth_date" "date",
    "height" numeric(5,2),
    "weight" numeric(5,2),
    "activity_level" "public"."activity_level",
    "dietary_restrictions" "public"."dietary_restriction"[] DEFAULT ARRAY[]::"public"."dietary_restriction"[],
    "diet_types" "public"."diet_type"[] DEFAULT ARRAY[]::"public"."diet_type"[],
    "measurement_system" "public"."measurement_system" DEFAULT 'metric'::"public"."measurement_system",
    "language" "text" DEFAULT 'en'::"text",
    "profile_image_url" "text",
    "onboarding_complete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "other_allergy" "text"[],
    "other_diet" "text"[],
    "is_admin" boolean DEFAULT false NOT NULL,
    "kitchen_equipment" "jsonb" DEFAULT '[]'::"jsonb",
    "skill_level" "text",
    "household_size" integer DEFAULT 1,
    "ingredient_dislikes" "text"[] DEFAULT '{}'::"text"[],
    "taste_profile" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "user_profiles_biography_check" CHECK (("length"("biography") <= 150)),
    CONSTRAINT "user_profiles_height_check" CHECK ((("height" > (0)::numeric) AND ("height" < (300)::numeric))),
    CONSTRAINT "user_profiles_name_check" CHECK (("length"("name") <= 30)),
    CONSTRAINT "user_profiles_skill_level_check" CHECK ((("skill_level" IS NULL) OR ("skill_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"])))),
    CONSTRAINT "user_profiles_weight_check" CHECK ((("weight" > (0)::numeric) AND ("weight" < (500)::numeric)))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."other_allergy" IS 'Custom allergies set by the user';



COMMENT ON COLUMN "public"."user_profiles"."other_diet" IS 'Custom diet preferences set by user';



COMMENT ON COLUMN "public"."user_profiles"."is_admin" IS 'flag to set admin users';



COMMENT ON COLUMN "public"."user_profiles"."kitchen_equipment" IS 'Array of kitchen equipment strings. Examples: ["thermomix_TM6", "thermomix_TM7", "air_fryer"]. Used to personalize recipe generation with equipment-specific instructions (especially Thermomix cooking parameters).';



COMMENT ON COLUMN "public"."user_profiles"."skill_level" IS 'User cooking skill level: beginner, intermediate, or advanced';



COMMENT ON COLUMN "public"."user_profiles"."household_size" IS 'Number of people the user typically cooks for';



COMMENT ON COLUMN "public"."user_profiles"."ingredient_dislikes" IS 'Ingredients the user wants to avoid';



COMMENT ON COLUMN "public"."user_profiles"."taste_profile" IS 'User taste preferences (spiciness, sweetness, etc.)';



CREATE TABLE IF NOT EXISTS "public"."user_recipe_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_recipe_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "name_en" "text" NOT NULL,
    "name_es" "text",
    "quantity" numeric(10,2) NOT NULL,
    "measurement_unit_id" "text",
    "unit_text" "text",
    "image_url" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "recipe_section_en" "text" DEFAULT 'Main'::"text",
    "recipe_section_es" "text" DEFAULT 'Principal'::"text",
    "notes" "text",
    "optional" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_recipe_ingredients" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_recipe_ingredients" IS 'Normalized ingredients for AI-generated recipes. Mirrors recipe_ingredients structure.';



CREATE TABLE IF NOT EXISTS "public"."user_recipe_step_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_recipe_step_id" "uuid" NOT NULL,
    "user_recipe_ingredient_id" "uuid" NOT NULL,
    "quantity" numeric(10,2),
    "display_order" integer DEFAULT 0 NOT NULL,
    "optional" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_recipe_step_ingredients" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_recipe_step_ingredients" IS 'Links steps to ingredients used in that step. For showing ingredient images during cooking.';



CREATE TABLE IF NOT EXISTS "public"."user_recipe_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_recipe_id" "uuid" NOT NULL,
    "step_order" integer NOT NULL,
    "instruction_en" "text" NOT NULL,
    "instruction_es" "text",
    "recipe_section_en" "text" DEFAULT 'Main'::"text",
    "recipe_section_es" "text" DEFAULT 'Principal'::"text",
    "thermomix_time" integer,
    "thermomix_speed" "text",
    "thermomix_temperature" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_recipe_steps" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_recipe_steps" IS 'Normalized steps for AI-generated recipes. Mirrors recipe_steps structure.';



CREATE TABLE IF NOT EXISTS "public"."user_recipe_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_recipe_id" "uuid" NOT NULL,
    "tag_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_recipe_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_recipe_tags" IS 'Tags/categories for custom recipes (e.g., "quick", "healthy", "comfort food").';



CREATE TABLE IF NOT EXISTS "public"."user_recipe_useful_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_recipe_id" "uuid" NOT NULL,
    "useful_item_id" "uuid",
    "name" "text" NOT NULL,
    "image_url" "text",
    "notes" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_recipe_useful_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_recipe_useful_items" IS 'Suggested equipment/tools for the recipe.';



CREATE TABLE IF NOT EXISTS "public"."user_recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "original_recipe_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "recipe_data" "jsonb" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_time" integer,
    "prep_time" integer,
    "difficulty" "text",
    "portions" integer DEFAULT 4,
    "measurement_system" "text",
    "language" "text" DEFAULT 'en'::"text",
    "image_url" "text",
    "schema_version" "text" DEFAULT '1.0'::"text",
    CONSTRAINT "user_recipes_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "user_recipes_language_check" CHECK (("language" = ANY (ARRAY['en'::"text", 'es'::"text"]))),
    CONSTRAINT "user_recipes_measurement_system_check" CHECK (("measurement_system" = ANY (ARRAY['imperial'::"text", 'metric'::"text"]))),
    CONSTRAINT "user_recipes_source_check" CHECK (("source" = ANY (ARRAY['ai_generated'::"text", 'ai_modified'::"text", 'user_created'::"text"])))
);


ALTER TABLE "public"."user_recipes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_recipes"."schema_version" IS 'Schema version: 1.0 = JSONB recipe_data, 2.0 = normalized tables';



COPY "public"."ai_voice_sessions" ("id", "user_id", "status", "duration_seconds", "started_at", "completed_at", "created_at", "input_tokens", "output_tokens", "cost_usd", "input_text_tokens", "input_audio_tokens", "output_text_tokens", "output_audio_tokens", "provider_type", "stt_cost_usd", "llm_cost_usd", "tts_cost_usd", "llm_tokens_input", "llm_tokens_output", "tts_characters") FROM stdin;
fe3d2a97-9110-4c13-9cd4-d13cc8ad7a37	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:14:48.817+00	\N	2026-01-15 02:14:48.850114+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
987c51db-f89d-423e-9668-ae9fc2f5f85d	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:14:49.001+00	\N	2026-01-15 02:14:49.028967+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
0760d420-475c-4d8e-8553-4b7c6743a73e	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:14:50.422+00	\N	2026-01-15 02:14:50.503008+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
2ad4a43c-7452-4a76-a175-37e556379bf3	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:16:47.55+00	\N	2026-01-15 02:16:47.592986+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
f448f59c-c919-4d20-8959-a48777405745	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:17:03.536+00	\N	2026-01-15 02:17:03.571899+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
3fa7a7b7-1416-4035-8bdc-d6ec757a8f5d	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:23:23.008+00	\N	2026-01-15 02:23:23.039956+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
87ad5259-f889-4aa2-a0ab-5c047c5427ad	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:23:23.528+00	\N	2026-01-15 02:23:23.55367+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
22f5a431-0425-4136-95c6-04bd6caab657	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:23:25.53+00	\N	2026-01-15 02:23:25.554525+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
1a6c318f-35ff-4553-b04f-f9915c83a191	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:23:26.92+00	\N	2026-01-15 02:23:26.946582+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
797d9ef0-fec8-4709-b4db-7e38d9ed0de8	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 02:35:27.72+00	\N	2026-01-15 02:35:27.771399+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
5326c48c-bfd9-4d32-b2dc-923e762a10cb	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 03:54:51.743+00	\N	2026-01-15 03:54:51.804239+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
f6ffdaa7-fe29-4434-8551-a1b7764f65a3	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 03:58:00.48+00	\N	2026-01-15 03:58:00.500371+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
1a9dc5c8-48ca-4dab-aa65-7a707153ac0f	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 05:03:24.679+00	\N	2026-01-15 05:03:24.713367+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
d84958cc-0500-48e4-93db-cd847c3c9c0b	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 05:04:06.741+00	\N	2026-01-15 05:04:06.776813+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
074e5455-f061-466f-adc2-14033bf13ea0	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 05:04:34.82+00	\N	2026-01-15 05:04:34.869892+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
469bb359-8796-4b90-8051-9983984a3413	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 05:32:24.596+00	\N	2026-01-15 05:32:24.681265+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
d34832df-67db-49c9-b77f-93a03a519140	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 05:51:17.048+00	\N	2026-01-15 05:51:17.110199+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
d7256014-0471-4671-b777-5149286ea8fc	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 06:21:29.278+00	\N	2026-01-15 06:21:29.321221+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
08482105-cd3b-4a86-81ee-e75975286d46	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 06:34:38.2+00	\N	2026-01-15 06:34:38.236489+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
2202b762-578b-4599-99a2-b658197e90e3	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 06:34:50.069+00	\N	2026-01-15 06:34:50.105774+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
ceb02eb3-87e7-413d-927a-84b448dbb875	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 06:35:21.923+00	\N	2026-01-15 06:35:21.954747+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
426abbfe-bfed-4981-ab25-1c4cfc454554	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 06:57:37.634+00	\N	2026-01-15 06:57:37.671535+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
500e112c-7a47-4535-84f9-55f95224f261	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	13.71	2026-01-15 07:00:17.093+00	2026-01-15 07:00:31.472+00	2026-01-15 07:00:17.116894+00	172	172	0.005160	0	172	0	172	openai-realtime	0.000000	0.000000	0.000000	0	0	0
b8cffea7-dac8-433f-95f5-f2fa98aeba48	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	45.51	2026-01-15 07:01:41.296+00	2026-01-15 07:02:27.525+00	2026-01-15 07:01:41.334911+00	569	569	0.017070	0	569	0	569	openai-realtime	0.000000	0.000000	0.000000	0	0	0
d047555d-85c9-4c1f-9a36-feff9cd8ee19	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 07:03:20.72+00	\N	2026-01-15 07:03:20.756747+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
9a59ae28-f95f-4ec2-8330-5a2d515d03a8	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-15 07:03:48.68+00	\N	2026-01-15 07:03:48.711802+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
0210bbf0-8186-4c64-8140-f3a3efb0f87e	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	14.72	2026-01-15 07:09:29.144+00	2026-01-15 07:09:44.621+00	2026-01-15 07:09:29.163233+00	185	185	0.005550	0	185	0	185	openai-realtime	0.000000	0.000000	0.000000	0	0	0
7d996b87-255c-432d-872b-35f2976f6434	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	9.41	2026-01-15 07:14:02.471+00	2026-01-15 07:14:12.631+00	2026-01-15 07:14:02.486647+00	118	118	0.003540	0	118	0	118	openai-realtime	0.000000	0.000000	0.000000	0	0	0
711319eb-7466-47e9-bb2d-94ac28eff43d	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	30.00	2026-01-15 07:14:21.202+00	2026-01-15 07:14:51.828+00	2026-01-15 07:14:21.216697+00	375	375	0.011250	0	375	0	375	openai-realtime	0.000000	0.000000	0.000000	0	0	0
adf2d3a0-ff06-4e98-80de-feb64a786163	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	30.77	2026-01-15 07:15:27.573+00	2026-01-15 07:15:59.08+00	2026-01-15 07:15:27.609426+00	385	385	0.011550	0	385	0	385	openai-realtime	0.000000	0.000000	0.000000	0	0	0
feaa4cf6-a653-4b9f-a6cf-2c805cdccfb0	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	17.89	2026-01-15 11:52:34.563+00	2026-01-15 11:52:54.368+00	2026-01-15 11:52:34.658899+00	224	224	0.006720	0	224	0	224	openai-realtime	0.000000	0.000000	0.000000	0	0	0
91578c64-4485-46cb-9a11-3f46e536c37a	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 20:58:32.264+00	2026-01-15 20:58:32.415+00	2026-01-15 20:58:32.288512+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
b17f42a4-cebd-47a6-91df-c0839c744ed8	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 21:02:34.828+00	2026-01-15 21:02:35.046+00	2026-01-15 21:02:34.922204+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
a8ccb624-5fba-4d2d-bbd2-c73520ade8a4	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 21:08:13.197+00	2026-01-15 21:08:13.779+00	2026-01-15 21:08:13.252412+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
d51da3d6-5f20-4e87-bcd6-08a8a295c1cc	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 21:15:55.004+00	2026-01-15 21:15:55.481+00	2026-01-15 21:15:55.063616+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
9d99d23a-1757-4ccd-8e3e-6a634621e100	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 21:16:15.71+00	2026-01-15 21:16:16.19+00	2026-01-15 21:16:15.758746+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
5ee34be1-bae4-4433-9e19-c3bf73317a09	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 21:28:43.497+00	2026-01-15 21:28:44.179+00	2026-01-15 21:28:43.545538+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
542832a1-4950-4e9e-8c1f-89d0240ce1a6	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 23:31:44.764+00	2026-01-15 23:31:44.934+00	2026-01-15 23:31:44.80719+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
9817a626-40db-4964-a43f-48f3fc795796	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 23:33:03.095+00	2026-01-15 23:33:03.282+00	2026-01-15 23:33:03.126471+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
4fe286b0-0ef9-4d08-a847-0a31bc954b69	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 23:38:33.422+00	2026-01-15 23:38:34.174+00	2026-01-15 23:38:33.487312+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
ee292abb-dc0f-4176-a636-a4bdeb3f47c8	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	0.00	2026-01-15 23:40:20.458+00	2026-01-15 23:40:20.936+00	2026-01-15 23:40:20.504222+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
ca00c968-8ce5-4664-bc63-a5d1427725e3	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	28.05	2026-01-15 23:49:42.315+00	2026-01-15 23:50:10.586+00	2026-01-15 23:49:42.348739+00	0	0	0.002010	0	0	0	0	hear-think-speak	0.002010	0.000000	0.000000	0	0	0
bea523c7-3fd6-4d56-846c-16a4d09f2b89	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	10.10	2026-01-16 00:16:28.44+00	2026-01-16 00:16:38.829+00	2026-01-16 00:16:28.504888+00	0	0	0.000724	0	0	0	0	hear-think-speak	0.000724	0.000000	0.000000	0	0	0
0da320ca-412d-4bd4-8ff3-14931e61a5a5	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	21.19	2026-01-15 23:58:20.44+00	2026-01-15 23:58:41.847+00	2026-01-15 23:58:20.480941+00	0	0	0.001519	0	0	0	0	hear-think-speak	0.001519	0.000000	0.000000	0	0	0
89e5d792-6c5a-4822-8988-df515d85330d	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	9.07	2026-01-16 00:04:24.184+00	2026-01-16 00:04:33.661+00	2026-01-16 00:04:24.362546+00	0	0	0.000650	0	0	0	0	hear-think-speak	0.000650	0.000000	0.000000	0	0	0
6c9108de-8097-46dc-9100-0a97f66eeec7	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	34.03	2026-01-16 02:08:57.618+00	2026-01-16 02:09:31.904+00	2026-01-16 02:08:57.68042+00	0	0	0.002463	0	0	0	0	hear-think-speak	0.002439	0.000024	0.000000	95	16	0
99472da2-c151-47aa-b6d1-254ba0469a33	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	11.20	2026-01-16 00:10:39.081+00	2026-01-16 00:10:50.601+00	2026-01-16 00:10:39.18356+00	0	0	0.000802	0	0	0	0	hear-think-speak	0.000802	0.000000	0.000000	0	0	0
afc074ab-07fc-4fd8-ac9d-bd26b0296c74	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	10.69	2026-01-16 00:25:01.62+00	2026-01-16 00:25:12.643+00	2026-01-16 00:25:01.758153+00	0	0	0.000766	0	0	0	0	hear-think-speak	0.000766	0.000000	0.000000	0	0	0
4c02acfc-b17d-4392-b594-eb9781bf2282	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 01:50:07.881+00	\N	2026-01-16 01:50:07.993996+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
e43bd376-f49c-4fde-9d8a-3fc41cad0fa5	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	50.24	2026-01-16 01:53:28.442+00	2026-01-16 01:54:18.886+00	2026-01-16 01:53:28.469719+00	0	0	0.003621	0	0	0	0	hear-think-speak	0.003601	0.000020	0.000000	86	12	0
de7f97f3-52ba-4a70-b63c-c5fe948eecb1	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	7.62	2026-01-16 02:22:07.971+00	2026-01-16 02:22:16.084+00	2026-01-16 02:22:08.043856+00	0	0	0.000546	0	0	0	0	hear-think-speak	0.000546	0.000000	0.000000	0	0	0
dc49bdff-a278-466d-9a32-5f69d4d1cd61	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	33.33	2026-01-16 02:26:40.465+00	2026-01-16 02:27:14.033+00	2026-01-16 02:26:40.49133+00	0	0	0.002410	0	0	0	0	hear-think-speak	0.002388	0.000022	0.000000	89	14	0
44cf239e-a428-4f48-a44f-3036ef3dd8bc	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	38.23	2026-01-16 03:25:35.2+00	2026-01-16 03:26:13.659+00	2026-01-16 03:25:35.226411+00	0	0	0.002797	0	0	0	0	hear-think-speak	0.002740	0.000051	0.000006	209	33	115
53800a6b-22bd-425f-a546-2c850e5743b8	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	34.83	2026-01-16 03:27:29.136+00	2026-01-16 03:28:04.381+00	2026-01-16 03:27:29.205963+00	0	0	0.002678	0	0	0	0	hear-think-speak	0.002496	0.000162	0.000019	744	84	388
cee8cb90-69fe-4312-9962-477e6eb37bb7	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	26.09	2026-01-16 03:28:17.185+00	2026-01-16 03:28:43.519+00	2026-01-16 03:28:17.202092+00	0	0	0.001974	0	0	0	0	hear-think-speak	0.001870	0.000091	0.000013	359	62	257
6781c981-03ea-4f43-be87-7c80248c22c4	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	14.02	2026-01-16 06:24:50.584+00	2026-01-16 06:25:05.131+00	2026-01-16 06:24:50.622331+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
1104e386-c0ec-4857-9bd9-77fe210b1960	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	6.81	2026-01-16 03:35:52.859+00	2026-01-16 03:35:59.994+00	2026-01-16 03:35:52.92435+00	0	0	0.000512	0	0	0	0	hear-think-speak	0.000488	0.000023	0.000001	88	16	26
6579be32-6bd7-48e3-97df-6ed6054a50a7	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	58.68	2026-01-16 03:45:16.053+00	2026-01-16 03:46:14.98+00	2026-01-16 03:45:16.07212+00	0	0	0.004802	0	0	0	0	hear-think-speak	0.004205	0.000558	0.000039	2920	200	785
f7b57eac-a550-406e-845e-7db5df942b1a	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	23.36	2026-01-16 06:27:57.892+00	2026-01-16 06:28:21.592+00	2026-01-16 06:27:57.928054+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
89d3bf7b-ffcf-4f3a-8dd9-24a01022333c	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	9.43	2026-01-16 03:55:54.991+00	2026-01-16 03:56:04.66+00	2026-01-16 03:55:55.039012+00	0	0	0.000699	0	0	0	0	hear-think-speak	0.000676	0.000021	0.000002	85	14	49
ad7be2cc-e824-4b1f-b10e-929a2a06e66f	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	61.69	2026-01-16 03:56:30.431+00	2026-01-16 03:57:35.055+00	2026-01-16 03:56:30.477283+00	772	772	0.023160	0	772	0	772	openai-realtime	0.000000	0.000000	0.000000	0	0	0
54ccd6b0-142d-4dba-8d56-5769ebe66612	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	14.34	2026-01-16 03:58:50.527+00	2026-01-16 03:59:05.718+00	2026-01-16 03:58:50.573497+00	180	180	0.005400	0	180	0	180	openai-realtime	0.000000	0.000000	0.000000	0	0	0
87da9a91-d780-4a89-a828-4e84802e7dd2	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	35.93	2026-01-16 03:59:21.581+00	2026-01-16 03:59:57.802+00	2026-01-16 03:59:21.61238+00	0	0	0.002724	0	0	0	0	hear-think-speak	0.002575	0.000130	0.000019	531	84	376
dbbf8aa4-9636-45ed-84a6-6a5b5382378c	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 05:17:49.652+00	\N	2026-01-16 05:17:49.68353+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
1e3926b2-1c28-49e0-9a99-4a58ceee66b0	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 05:18:11.726+00	\N	2026-01-16 05:18:11.757121+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
0b644f5f-e378-4076-81e0-629d4d51eafe	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 05:34:50.873+00	\N	2026-01-16 05:34:50.896035+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
069d2a97-b7f5-4ec4-90d6-e924acbd9563	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 05:46:05.954+00	\N	2026-01-16 05:46:05.987074+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
b0276937-65d3-4357-ab95-24479d129af4	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 05:49:22.405+00	\N	2026-01-16 05:49:22.42805+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
27037989-d0c5-4d82-96f9-352898faa143	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 05:49:40.324+00	\N	2026-01-16 05:49:40.340596+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
d1af4072-9feb-41c6-b9ab-a208c2f60dc7	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 05:51:49.739+00	\N	2026-01-16 05:51:49.756305+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
ebc56d55-5a4d-4896-a199-e1fe5ca8647a	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	29.82	2026-01-16 05:58:07.11+00	2026-01-16 05:58:37.314+00	2026-01-16 05:58:07.149345+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
5448eeff-b424-4636-9a94-b6d9411d374c	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	29.87	2026-01-16 06:00:44.239+00	2026-01-16 06:01:14.517+00	2026-01-16 06:00:44.308018+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
017dff56-6fb6-4131-b762-5be08c6665f8	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	6.21	2026-01-16 06:03:36.318+00	2026-01-16 06:03:43.085+00	2026-01-16 06:03:36.36925+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
0a631c6e-a69e-4d6e-abad-b794d78e5296	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	38.37	2026-01-16 06:07:34.307+00	2026-01-16 06:08:13.138+00	2026-01-16 06:07:34.333021+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
6c6379d4-633c-4c0f-806b-ee69faeb593a	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	4.53	2026-01-16 06:08:44.58+00	2026-01-16 06:08:49.442+00	2026-01-16 06:08:44.604663+00	529	0	0.001587	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
eb1c9975-e974-4df2-88a0-c9ef2c05f6f1	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	21.20	2026-01-16 06:11:15.754+00	2026-01-16 06:11:37.417+00	2026-01-16 06:11:15.819798+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
b9f767d8-1846-42df-ba5b-0a8229fa9245	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	14.32	2026-01-16 06:13:31.291+00	2026-01-16 06:13:46.049+00	2026-01-16 06:13:31.341781+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
df0dcdd9-1d8f-4685-a0aa-4d4c83eddd90	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	14.93	2026-01-16 06:18:48.844+00	2026-01-16 06:19:04.237+00	2026-01-16 06:18:48.874836+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
dde71b14-5744-4306-83bb-1d3c84203811	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	21.74	2026-01-16 06:21:46.439+00	2026-01-16 06:22:08.505+00	2026-01-16 06:21:46.485225+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
86ed286d-e6da-45c1-b7bc-52b64e3d21ab	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	17.51	2026-01-16 06:22:47.903+00	2026-01-16 06:23:05.768+00	2026-01-16 06:22:47.931105+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
02d08cc5-f89c-4261-92fa-b9110e39001c	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	16.99	2026-01-16 06:32:07.642+00	2026-01-16 06:32:24.944+00	2026-01-16 06:32:07.667705+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
d1539f20-48a9-4fe3-a64d-d488c23f22ad	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	28.73	2026-01-16 06:34:39.486+00	2026-01-16 06:35:08.756+00	2026-01-16 06:34:39.532021+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
4ac32817-0070-4ec1-beff-4a313945fec1	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	24.12	2026-01-16 06:37:33.808+00	2026-01-16 06:37:58.318+00	2026-01-16 06:37:33.849945+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
0970cbc2-86cc-41a4-acf0-eeb4ca7bec0e	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	19.28	2026-01-16 17:33:53.78+00	2026-01-16 17:34:13.697+00	2026-01-16 17:33:53.851798+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
f6a0df30-c9c6-4fd6-b88a-75d78e300026	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	14.63	2026-01-16 18:00:24.942+00	2026-01-16 18:00:40.022+00	2026-01-16 18:00:25.014726+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
afaa873a-fc4e-4912-b90c-a4039dc3c8b4	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	16.02	2026-01-16 18:00:46.392+00	2026-01-16 18:01:02.744+00	2026-01-16 18:00:46.420438+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
98596fd2-626c-45de-840b-f4e4dcbd479e	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	7.64	2026-01-16 18:01:05.659+00	2026-01-16 18:01:13.812+00	2026-01-16 18:01:05.689569+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
eb914966-8c3c-4618-91e2-20ad03fdcdf8	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	18.34	2026-01-16 18:28:04.725+00	2026-01-16 18:28:23.447+00	2026-01-16 18:28:04.773874+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
1793c4b2-fde1-4cc1-b922-c6005bbe462f	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	13.54	2026-01-16 18:39:44.333+00	2026-01-16 18:39:58.29+00	2026-01-16 18:39:44.365778+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
a3a955a3-3642-46a9-8157-0ad91fdf4119	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	13.40	2026-01-16 18:50:14.976+00	2026-01-16 18:50:28.927+00	2026-01-16 18:50:15.06911+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
2ee557be-607f-44eb-b8ed-1cfc903833a0	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	15.43	2026-01-16 18:55:20.98+00	2026-01-16 18:55:36.955+00	2026-01-16 18:55:21.037419+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
4ced3344-0103-453d-9198-75afa2c7d269	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	15.58	2026-01-16 20:27:37.145+00	2026-01-16 20:27:53.263+00	2026-01-16 20:27:37.173638+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
c5aca830-9aa5-4c11-ab1e-aeff6b9123ec	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	25.78	2026-01-16 20:33:19.861+00	2026-01-16 20:33:46.078+00	2026-01-16 20:33:19.882184+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
d9e9235f-e632-48c8-99a7-a79ffa5299d1	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	active	\N	2026-01-16 20:35:38.446+00	\N	2026-01-16 20:35:38.480964+00	0	0	0.000000	0	0	0	0	hear-think-speak	0.000000	0.000000	0.000000	0	0	0
f4a4cf29-cd18-4263-b19e-c6eebaba7834	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	23.30	2026-01-16 20:39:04.641+00	2026-01-16 20:39:28.331+00	2026-01-16 20:39:04.659288+00	0	0	0.000000	0	0	0	0	gemini-live	0.000000	0.000000	0.000000	0	0	0
c33a3760-9181-46da-981e-c2bf3f0b8dbc	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	31.67	2026-01-16 20:39:38.427+00	2026-01-16 20:40:10.313+00	2026-01-16 20:39:38.44287+00	0	0	0.002332	0	0	0	0	hear-think-speak	0.002270	0.000057	0.000005	287	24	95
71483496-387b-41bb-b3f0-04463b026133	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	46.58	2026-01-16 20:41:24.478+00	2026-01-16 20:42:12.744+00	2026-01-16 20:41:24.491267+00	583	583	0.017490	0	583	0	583	openai-realtime	0.000000	0.000000	0.000000	0	0	0
9f069662-c2b5-4dba-9c09-127d8529fcbb	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	20.15	2026-01-16 20:40:23.397+00	2026-01-16 20:40:43.785+00	2026-01-16 20:40:23.414558+00	0	0	0.001473	0	0	0	0	hear-think-speak	0.001444	0.000027	0.000002	131	12	44
c59c8050-6446-4048-9700-cb866594693b	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	5.99	2026-01-16 20:50:01.71+00	2026-01-16 20:50:08.671+00	2026-01-16 20:50:01.724+00	75	75	0.002250	0	75	0	75	openai-realtime	0.000000	0.000000	0.000000	0	0	0
da5a4c80-88e1-44a3-ac31-6cc146d42a7e	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	14.71	2026-01-16 20:50:17.231+00	2026-01-16 20:50:32.164+00	2026-01-16 20:50:17.259241+00	0	0	0.001084	0	0	0	0	hear-think-speak	0.001054	0.000029	0.000001	133	15	18
e127bf13-7fdf-44ac-a263-e844d08c7383	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	16.67	2026-01-16 20:52:53.848+00	2026-01-16 20:53:10.734+00	2026-01-16 20:52:53.865603+00	0	0	0.001225	0	0	0	0	hear-think-speak	0.001195	0.000028	0.000002	133	13	46
ec2871fc-70d9-4c2f-b5fc-ebc0d7ce7b69	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	completed	29.59	2026-01-16 20:53:30.708+00	2026-01-16 20:54:00.503+00	2026-01-16 20:53:30.728025+00	0	0	0.002192	0	0	0	0	hear-think-speak	0.002121	0.000064	0.000007	290	34	141
3cf5f6d3-6d4f-4626-82f2-d882a088bf7e	41fda130-9e9e-40f0-af95-679db75ebcd0	active	\N	2026-02-03 00:51:35.626+00	\N	2026-02-03 00:51:35.660863+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
a17530fa-e22c-474e-a78e-ceb612bc1797	41fda130-9e9e-40f0-af95-679db75ebcd0	active	\N	2026-02-03 00:52:06.878+00	\N	2026-02-03 00:52:06.91327+00	0	0	0.000000	0	0	0	0	openai-realtime	0.000000	0.000000	0.000000	0	0	0
\.



COPY "public"."ai_voice_usage" ("id", "user_id", "month", "minutes_used", "conversations_count", "created_at", "updated_at", "total_cost_usd", "openai_minutes", "openai_cost", "hts_minutes", "hts_cost") FROM stdin;
0af900b1-32dd-4d58-89f6-4c250826177b	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	2026-01	22.00	69	2026-01-15 07:00:32.229148+00	2026-01-16 20:54:00.518251+00	0.12	2.45	0.06	8.99	0.00
\.



COPY "public"."allergen_groups" ("id", "category", "ingredient_canonical", "name_en", "name_es", "created_at") FROM stdin;
b8f8360b-83e7-4c3b-87bb-46670f4e4ab9	nuts	almond	Almond	Almendra	2026-02-02 19:56:26.354558+00
af4e2e27-53dc-4ab1-ab54-68b45cb92585	nuts	peanut	Peanut	Cacahuate	2026-02-02 19:56:26.354558+00
af572471-5111-4658-8708-a75f3adb40b8	nuts	walnut	Walnut	Nuez	2026-02-02 19:56:26.354558+00
6a942d5e-b7ae-405a-90db-90dfe0ae2228	nuts	cashew	Cashew	Anacardo	2026-02-02 19:56:26.354558+00
059ad0b5-579b-4640-8bdc-d8f16461ad2d	nuts	pistachio	Pistachio	Pistacho	2026-02-02 19:56:26.354558+00
0ba39bee-94b4-486b-b32a-c07ddbbb3252	nuts	pecan	Pecan	Nuez pecana	2026-02-02 19:56:26.354558+00
abab393c-d68e-4683-91ee-b72a1732459c	nuts	hazelnut	Hazelnut	Avellana	2026-02-02 19:56:26.354558+00
f8ea6315-3373-4f87-b8fd-aa1dedfc1320	nuts	macadamia	Macadamia	Macadamia	2026-02-02 19:56:26.354558+00
bf67d15f-2ba6-4e22-ac5a-db32c8c306fa	nuts	pine_nut	Pine nut	Piñón	2026-02-02 19:56:26.354558+00
25b51346-f2f7-418e-999f-0b4a91805c97	dairy	milk	Milk	Leche	2026-02-02 19:56:26.354558+00
128eef87-469f-4db6-9270-bc7bd0f5df56	dairy	cheese	Cheese	Queso	2026-02-02 19:56:26.354558+00
7db1b581-ee73-4d05-bf5d-0765a3400f9d	dairy	butter	Butter	Mantequilla	2026-02-02 19:56:26.354558+00
6834ac19-08b3-43d6-b6af-971267365a24	dairy	cream	Cream	Crema	2026-02-02 19:56:26.354558+00
82f97aa2-9d4b-466f-9a69-f73bb19907c8	dairy	yogurt	Yogurt	Yogur	2026-02-02 19:56:26.354558+00
21ec16ef-547a-4740-8fa5-ae531ac0aa34	dairy	whey	Whey	Suero de leche	2026-02-02 19:56:26.354558+00
e8caa351-78c8-474f-9f95-fe859c916123	gluten	wheat	Wheat	Trigo	2026-02-02 19:56:26.354558+00
d4009048-843b-49b0-9a6b-eb597a24f1d6	gluten	barley	Barley	Cebada	2026-02-02 19:56:26.354558+00
307eb1d5-79ff-4e42-9dc8-5a160ce13e6f	gluten	rye	Rye	Centeno	2026-02-02 19:56:26.354558+00
96861282-86f8-4fad-a8de-18beb2ab91c5	gluten	spelt	Spelt	Espelta	2026-02-02 19:56:26.354558+00
80836d55-c9b1-4ee8-9c52-3c8b1207b4c8	eggs	egg	Egg	Huevo	2026-02-02 19:56:26.354558+00
b9cbc6e9-150a-4e06-969c-27fb22b416b6	eggs	egg_white	Egg white	Clara de huevo	2026-02-02 19:56:26.354558+00
a5213c12-ed11-4dbe-a5ff-7eba451ef858	eggs	egg_yolk	Egg yolk	Yema de huevo	2026-02-02 19:56:26.354558+00
2c0b4f26-c59b-408a-841d-12689c747cc6	seafood	shrimp	Shrimp	Camarón	2026-02-02 19:56:26.354558+00
3915b798-57ef-4edb-b50d-5a4b9e2585e5	seafood	crab	Crab	Cangrejo	2026-02-02 19:56:26.354558+00
d4b243ed-4bc9-4f14-98d5-cd8217c388b3	seafood	lobster	Lobster	Langosta	2026-02-02 19:56:26.354558+00
0304873c-4728-47fd-8472-3d381fa06f01	seafood	mussel	Mussel	Mejillón	2026-02-02 19:56:26.354558+00
7954d156-ea93-4109-a63c-f7aeb0523690	seafood	oyster	Oyster	Ostra	2026-02-02 19:56:26.354558+00
a5ce842e-95ab-418f-9e02-dd484cf1e4bd	seafood	clam	Clam	Almeja	2026-02-02 19:56:26.354558+00
5bc858fd-b432-4474-841e-1f62c0f4d9f4	seafood	squid	Squid	Calamar	2026-02-02 19:56:26.354558+00
\.



COPY "public"."ingredients" ("id", "image_url", "nutritional_facts", "created_at", "updated_at", "name_en", "name_es", "plural_name_en", "plural_name_es") FROM stdin;
e8a919aa-5136-4279-a56d-57ea8e49a614	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/leche_1742551720159.png	{"per_100g": {"fat": "3.3", "protein": "3.1", "calories": "61", "carbohydrates": "4.8"}}	2024-11-10 19:40:38.238789+00	2025-03-21 10:08:40.369296+00	milk	leche	milk	leche
d93e5598-b219-4f45-a270-392a7d155f58	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/bicarbonato_de_sodio_1743312462605.png	{"per_100g": {"fat": 3.6, "protein": 9.4, "calories": 270, "carbohydrates": 49.2}}	2025-03-30 05:27:43.100801+00	2025-03-30 05:27:43.100801+00	baking soda	bicarbonato de sodio	baking soda	bicarbonato de sodio
54526882-d5d1-48f1-9526-8809233bf5f9	\N	{"por_100ml": {"grasa": 8.7, "calorias": 321, "proteina": 7.9, "carbohidratos": 54.4}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	leche condensada	\N	leche condensada
40bbc2ba-e39d-4906-a8d9-dadb83ee9ba1	\N	{"por_100ml": {"grasa": 7.6, "calorias": 134, "proteina": 6.8, "carbohidratos": 10.0}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	leche evaporada	\N	leche evaporada
444db09f-5e44-4a97-8c14-eb5bc225182e	\N	{"por_100ml": {"grasa": 0, "calorias": 0, "proteina": 0, "carbohidratos": 0}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	agua mineral	\N	agua mineral
83ec3122-93dc-4a50-8dc5-30d314de9b0b	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/lima.png	{"per_100g": {"fat": 0.2, "protein": 0.7, "calories": 30, "carbohydrates": 10.5}}	2024-11-10 20:00:57.269001+00	2024-11-10 20:00:57.269001+00	lemon	lima	lemons	limas
a5d01bdc-1ef7-439e-b948-86f6575e4dd4	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/huevo.png	{"per_100g": {"fat": 10.9, "protein": 12.6, "calories": 155, "carbohydrates": 1.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	egg	huevo	eggs	huevos
d6d419b7-bbc7-49ec-a94a-2e511506847c	\N	{"per_100g": {"fat": 0.6, "protein": 7, "calories": 360, "carbohydrates": 79}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	arroz redondo	\N	arroz redondo
da148df8-dd44-45d9-82de-50e1ec85c8aa	\N	{"por_100ml": {"grasa": 0, "calorias": 231, "proteina": 0, "carbohidratos": 0}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	ron	\N	ron
86a167f0-5add-47a0-b93c-ff9a97205334	\N	{"por_100ml": {"grasa": 0, "calorias": 53, "proteina": 8.1, "carbohidratos": 4.9}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	salsa de soja	\N	salsa de soja
a6814eb2-a30c-4854-952e-5a3493c27242	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/canela_en_polvo_1743313637634.png	{"per_100g": {"fat": 1.2, "protein": 4, "calories": 247, "carbohydrates": 81}}	2025-03-30 05:47:18.004254+00	2025-03-30 05:47:18.004254+00	cinnamon powder	canela en polvo 	cinnamon powder	canela en polvo
aeb31f51-f766-4feb-935c-561020f6dfd7	\N	{"por_100ml": {"grasa": 0, "calorias": 231, "proteina": 0, "carbohidratos": 0}}	2024-11-10 20:04:24.557605+00	2024-11-10 20:04:24.557605+00	\N	ron blanco	\N	ron blanco
cf41b6a8-7aef-431f-b671-4e81ba4e0f81	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pasita_1743616640784.png	{"per_100g": {"fat": 14.3, "protein": 5.8, "calories": 430, "carbohydrates": 69.6}}	2025-04-02 17:57:21.34616+00	2025-04-02 17:57:21.34616+00	raisin	pasita	raisins	pasitas
67413b44-d4d8-41fb-b02e-b12da897c2f4	\N	{"por_100ml": {"grasa": 0.1, "calorias": 288, "proteina": 0.1, "carbohidratos": 12.7}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	vainilla	\N	vainilla
bf00fc24-a8e4-4343-b4f9-c87a7bc59491	\N	{"por_100ml": {"grasa": 0, "calorias": 280, "proteina": 0, "carbohidratos": 70}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	caramelo líquido	\N	caramelo líquido
2f4543fa-b149-4d38-b556-a6faf8efc685	\N	{"por_100ml": {"grasa": 24, "calorias": 230, "proteina": 2.3, "carbohidratos": 5.5}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	leche de coco	\N	leche de coco
99f09309-429d-44d5-a498-eb63202ef492	\N	{"por_100ml": {"grasa": 0, "calorias": 231, "proteina": 0, "carbohidratos": 0}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	tequila	\N	tequila
3fa8daf9-b7bc-45b2-945f-4ca4cdbf0045	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_limon.png	{"por_100ml": {"grasa": 0.2, "calorias": 22, "proteina": 0.4, "carbohidratos": 7}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	lime juice	jugo de limón	lime juice	jugo de limón
57e7893a-e6e1-4820-b42a-1aa2bd553a64	\N	{"per_100g": {"fat": 15, "protein": 27, "calories": 242, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	pernil de cerdo	\N	pernil de cerdo
780ecc6c-f3f4-40b1-ae8e-f935e843bdd6	\N	{"per_100g": {"fat": 13, "protein": 5.9, "calories": 274, "carbohydrates": 65.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	clavo de olor	\N	clavo de olor
db713023-f321-4eff-9fc2-fb92d303e80a	\N	{"per_100g": {"fat": 2.9, "protein": 5.4, "calories": 218, "carbohydrates": 46}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	tortilla de maíz	\N	tortillas de maíz
780b8d3e-3c62-4688-bdcd-15fb67d34657	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ramita_de_canela_1743313696693.png	{"per_100g": {"fat": 82.2, "protein": 0, "calories": 0, "carbohydrates": 0}}	2025-03-30 05:48:17.058642+00	2025-03-30 05:48:17.058642+00	cinnamon stick	ramita de canela 	cinnamon sticks	ramitas de canela
27d3d059-6aa0-4ae1-8ff4-365efce6483f	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/harina_1743622186542.png	{"per_100g": {"fat": 1, "protein": 10, "calories": 364, "carbohydrates": 76}}	2024-11-10 19:40:38.238789+00	2025-04-02 19:29:46.890055+00	flour	harina	flour	harina
73dd46bd-07b7-4206-b944-57ddb8d5a918	\N	{"por_100ml": {"grasa": 0, "calorias": 82, "proteina": 0.1, "carbohidratos": 2.6}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	vino blanco	\N	vino blanco
a9487655-6308-453b-8a70-f01fcd8c3c48	\N	{"por_100ml": {"grasa": 0, "calorias": 18, "proteina": 0, "carbohidratos": 0.9}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	vinagre de vino blanco	\N	vinagre de vino blanco
059438c7-b38e-4ebd-891f-137317cb1b5f	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/limon.png	{"per_100g": {"fat": 0.3, "protein": 1.1, "calories": 29, "carbohydrates": 9.3}}	2024-11-10 20:11:38.176536+00	2024-11-10 20:11:38.176536+00	lime	limón	limes	limones
3a16b60a-e17d-4edd-b09d-e421531b2e53	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/papa_1742832069550.png	{"per_100g": {"fat": "0.1", "protein": "2.0", "calories": "77", "carbohydrates": "17.5"}}	2025-03-24 16:01:10.187017+00	2025-03-24 16:01:10.187017+00	potato	papa	potatoes	papas
852099ab-d3f6-4ee6-8985-750d7a7efd72	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pepino_1743855537643.png	{"per_100g": {"fat": "0.1", "protein": 0.6, "calories": "15", "carbohydrates": "3"}}	2024-11-10 19:40:38.238789+00	2025-04-05 12:21:36.959865+00	cucumber	pepino	cucumbers	pepinos
b7f1f695-6c7e-4042-a356-01f71e12013e	\N	{"por_100ml": {"grasa": 0, "calorias": 0, "proteina": 0, "carbohidratos": 0}}	2024-11-10 20:06:17.907258+00	2024-11-10 20:06:17.907258+00	\N	soda	\N	soda
57125837-d2cb-41c5-a659-21fa18efbe48	\N	{"por_100ml": {"grasa": 0, "calorias": 18, "proteina": 0, "carbohidratos": 0.9}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	vinagre blanco	\N	vinagre blanco
cd62d878-e42f-468c-8600-32b52bf8f88c	\N	{"por_100ml": {"grasa": 0.2, "calorias": 45, "proteina": 0.7, "carbohidratos": 10.4}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	jugo de naranja	\N	jugo de naranja
5f2ac71f-3e9e-4b39-823d-592125d30590	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pina.png	{"per_100g": {"fat": 0.1, "protein": 0.5, "calories": 50, "carbohydrates": 13.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	pineapple	piña	pineapple	piña
2ca4468a-58a0-46c4-972e-35e9ccaae4c5	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/vinagre.png	{"sodium": 1, "sugars": 0.1, "protein": 0, "calories": 3, "total_fat": 0, "cholesterol": 0, "serving_size": 100, "serving_unit": "ml", "dietary_fiber": 0, "saturated_fat": 0, "total_carbohydrates": 0.1}	2024-11-19 21:25:20.657184+00	2025-03-05 20:08:55.67019+00	vinegar	vinagre	vinegar	vinagre
784664ec-93f3-4464-b085-53c2640bba7a	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/polvo_para_hornear.png	{"per_100g": {"fat": 0, "protein": 0, "calories": 53, "carbohydrates": 28}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	baking powder	polvo para hornear	baking powder	polvo para hornear
b561c6f6-db99-4418-9d76-63bda56a7a70	\N	{"por_100ml": {"grasa": 0, "calorias": 21, "proteina": 0, "carbohidratos": 0.9}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	vinagre de manzana	\N	vinagre de manzana
c0dc0e21-1d03-4d5a-875d-2c01929cdef1	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png	{"per_100g": {"fat": 10, "protein": 20, "calories": 176, "carbohydrates": 0}}	2025-03-19 19:03:45.251097+00	2025-03-19 19:20:40.033654+00	ground beef	carne molida	ground beef	carne molida
3caa301c-340e-4787-9a1d-ed069837898b	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png	{"per_100g": {"fat": "0.4", "protein": "2.8", "calories": "34", "carbohydrates": "6.6"}}	2025-03-26 16:55:34.734571+00	2025-03-26 16:55:34.734571+00	broccoli	brocóli	broccoli	brócoli
f8a3d26f-46b2-48de-8079-a7f539cb1258	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/nuez_de_castilla_1743315077571.png	{"per_100g": {"fat": 69.7, "protein": 14.6, "calories": 0, "carbohydrates": 10.9}}	2025-03-30 06:11:18.062244+00	2025-03-30 06:11:18.062244+00	walnut	nuez de castilla	walnuts	nueces de castilla
52b27f5c-888f-4cfe-a38b-ab48d048628c	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/eneldo_1743856158024.png	{"per_100g": {"fat": "1.1", "protein": "3.5", "calories": "43", "carbohydrates": "7"}}	2025-04-05 12:29:18.549044+00	2025-04-05 12:29:18.549044+00	dill	eneldo	dill	eneldo
b40c2601-fc9f-43ca-a3d0-4d5c277d738f	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal_y_pimienta.png?t=2024-11-15T21%3A07%3A48.065Z	{}	2024-11-15 20:36:22.681219+00	2024-11-15 20:36:22.681219+00	salt and pepper	sal y pimienta	salt and pepper	sal y pimienta
8fdf823c-20aa-4d5b-be57-fb69c120dd3e	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/mantequilla_sin_sal.png	{"per_100g": {"fat": 81.1, "protein": 0.9, "calories": 717, "carbohydrates": 0.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	unsalted butter	mantequilla sin sal	unsalted butter	mantequilla sin sal
cacb8def-451c-4b10-929b-82356fd43bee	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	{"fat": 0, "fiber": 0, "sugar": 0.4, "protein": 0.1, "calories": 4, "serving_size": 15, "carbohydrates": 1.2, "servize_size_measurement": "ml"}	2024-11-21 02:43:18.873803+00	2025-03-05 20:07:35.877189+00	lemon juice	jugo de lima	lemon juice	jugo de lima
fa195561-233a-4728-a308-e9e6ee1b4623	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/harina_de_trigo.png	{"per_100g": {"fat": 1.0, "protein": 10.3, "calories": 364, "carbohydrates": 76.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	wheat flour	harina de trigo	wheat flour	harina de trigo
186fa6b2-588c-4941-a6ff-2851c036daaf	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png	{"per_100g": {"fat": 0.6, "protein": 7, "calories": 360, "carbohydrates": 79}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	rice	arroz	rice	arroz
fb008ccd-cb27-4092-98d5-f8224d66c55b	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/echalot.png	{"per_100g": {"fat": 0.1, "protein": 2.5, "calories": 72, "carbohydrates": 16.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	shallot	echalot	shallots	echalot
106230d2-4e83-4c9a-9fc0-693603b0f797	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/mantequilla_sin_sal.png	{"per_100g": {"fat": 81.1, "protein": 0.9, "calories": 717, "carbohydrates": 0.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	butter	mantequilla	butter	mantequilla
cffdf1ba-7b98-4138-8fbd-6bf27ececcb8	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/queso_pecorino.png	{"per_100g": {"fat": 32, "protein": 26, "calories": 387, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	pecorino cheese	queso pecorino	pecorino cheese	queso pecorino
b7bbf8a8-1933-458c-81a5-c5389bbbdae1	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/queso_parmesano.png	{"per_100g": {"fat": 29, "protein": 38, "calories": 431, "carbohydrates": 4.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	parmesan cheese	queso parmesano	parmesan cheese	queso parmesano
ba78e6e9-4cd8-498d-a3d8-a84c69fa1704	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/yema_de_huevo.png	{"per_100g": {"fat": 27, "protein": 16, "calories": 322, "carbohydrates": 3.6}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	egg yolk	yema de huevo	egg yolks	yema de huevo
9cce6518-847b-47f8-9542-db54818da3fb	\N	{"per_100g": {"fat": 0.2, "protein": 2, "calories": 40, "carbohydrates": 9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chile verde	\N	chiles verdes
4858814c-aa16-4ee6-a1eb-751081cc7207	\N	{"per_100g": {"fat": 33, "protein": 61, "calories": 544, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chicharrón	\N	chicharrón
2b04b39f-e806-4174-913a-95669b3c4617	\N	{"per_100g": {"fat": 0.3, "protein": 1.5, "calories": 61, "carbohydrates": 14.2}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	poro	\N	poros
ceb19464-dd48-447f-9c70-ef32ab8c9547	\N	{"per_100g": {"fat": 0.7, "protein": 3.3, "calories": 44, "carbohydrates": 8.4}}	2024-11-10 20:05:36.221517+00	2025-03-19 16:18:19.282765+00	\N	menta fresca	\N	menta fresca
2cf19ceb-2ec1-461d-b95d-084193c03e22	\N	{"per_100g": {"fat": 0.3, "protein": 1.2, "calories": 17, "carbohydrates": 3.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	lechuga romana	\N	lechuga romana
748aa9aa-eba4-4fe7-b187-1c1fc3c65826	\N	{"per_100g": {"fat": 16.3, "protein": 13.4, "calories": 259, "carbohydrates": 17.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	caldo de carne	\N	caldo de carne
f5b55e61-7ab1-4b37-9cbb-80a2867bbd91	\N	{"per_100g": {"fat": 0, "protein": 0, "calories": 380, "carbohydrates": 98.0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	azúcar moscabada	\N	azúcar moscabada
8453cb0e-e744-4008-8368-ac8cd40a31e2	\N	{"per_100g": {"fat": 1.9, "protein": 16.7, "calories": 105, "carbohydrates": 8.9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	levadura prensada fresca	\N	levadura prensada fresca
ef83b683-25d3-46fb-9b01-839ce56c5e2f	\N	{"per_100g": {"fat": 7.6, "protein": 40.4, "calories": 325, "carbohydrates": 35.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	levadura seca instantánea	\N	levadura seca instantánea
e71dcaee-d7e4-44f0-ade5-930e4b8e5fc9	\N	{"per_100g": {"fat": 33.5, "protein": 3.3, "calories": 354, "carbohydrates": 15}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	coco rallado	\N	coco rallado
9e1e4327-f738-420e-a751-978e5288078b	\N	{"per_100g": {"fat": 0.2, "protein": 0.6, "calories": 30, "carbohydrates": 7.6}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	sandía	\N	sandía
7f8aeb4a-9ffb-4024-bc5f-83369d2610dd	\N	{"per_100g": {"fat": 0, "protein": 0, "calories": 247, "carbohydrates": 62}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chamoy	\N	chamoy
ae7dd72a-4562-4df4-bd06-0f3f14e61383	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/cilantro.png	{"per_100g": {"fat": 0.5, "protein": 2.1, "calories": 23, "carbohydrates": 3.7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	cilantro	cilantro	cilantro	cilantro
c7b67c23-2c8b-47c7-9e1c-5941dc4b64e1	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	{"per_100g": {"fat": 3.6, "protein": 31, "calories": 165, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	chicken breast	pechuga de pollo	chicken breasts	pechugas de pollo
eb811f56-9ce6-4805-8a47-98670e6d2890	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	{"per_100g": {"fat": 0.2, "protein": 0.9, "calories": 18, "carbohydrates": 3.9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	roma tomato	jitomate roma	roma tomato	jitomate roma
4466a8c0-c00b-4e70-9df4-1d8c0967fbc7	\N	{"per_100g": {"fat": 47.7, "protein": 28.3, "calories": 557, "carbohydrates": 8.6}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	semillas de melón	\N	semillas de melón
912ade09-cc08-4754-949a-8562e444faa3	\N	{"per_100g": {"fat": 0.9, "protein": 4.3, "calories": 49, "carbohydrates": 8.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	kale	\N	kales
39ec0480-14af-4773-8c4d-e4fd16975c5e	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/espinca.png	{"per_100g": {"fat": 0.4, "protein": 2.9, "calories": 23, "carbohydrates": 3.6}}	2024-11-15 20:36:22.681219+00	2025-03-19 16:18:19.282765+00	spinach	espinaca	spinach	espinacas
7171b7a5-0635-4471-87c5-ea394c8f64ab	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/nuez_pecana_1743315138777.png	{"per_100g": {"fat": 73.3, "protein": 10, "calories": 0, "carbohydrates": 12.7}}	2025-03-30 06:12:19.2263+00	2025-03-30 06:12:19.2263+00	pecan	nuez pecana	pecans	nueces pecanas
da667266-6861-4e6d-9aa3-bddd47efeb07	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/yogur_griego_1743857542292.png	{"per_100g": {"fat": 0.4, "protein": 10.3, "calories": 256, "carbohydrates": 3.6}}	2025-04-05 12:52:22.659343+00	2025-04-05 12:52:22.659343+00	greek yogurt	 yogur griego	greek yogurt	 yogur griego
e4039b52-c436-4000-b62a-ee191fd41062	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/chile_chipotle.png	{"per_100g": {"fat": 4.3, "protein": 4.1, "calories": 140, "carbohydrates": 22.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	canned chipotle pepper	chile chipotle adobado	canned chipotle peppers	chile chipotle adobado
84731c2c-14c3-4e24-ac06-c83516a28fcf	\N	{"per_100g": {"fat": 0.2, "protein": 0.7, "calories": 16, "carbohydrates": 3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	apio	\N	apio
4285c6e0-6c0c-44a9-bdee-005fdcf87c89	\N	{"per_100g": {"fat": 28, "protein": 23, "calories": 356, "carbohydrates": 2.7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	queso chihuahua	\N	queso chihuahua
cbaa7afa-a227-4515-9ad6-dfdeb966ba90	\N	{"per_100g": {"fat": 1.2, "protein": 3.2, "calories": 86, "carbohydrates": 19}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	granos de elote	\N	granos de elote
bf8bcf10-e3dd-4a76-bb5d-bea50c03351a	\N	{"per_100g": {"fat": 0.4, "protein": 2, "calories": 40, "carbohydrates": 9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chile poblano	\N	chile poblano
2cebb2b5-a969-4043-b036-624ac2e632f6	\N	{"per_100g": {"fat": 22.3, "protein": 17.8, "calories": 375, "carbohydrates": 44.2}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	comino	\N	comino
45492ab1-9588-4e51-96f9-8b3aab77b5e3	\N	{"per_100g": {"fat": 0.2, "protein": 1.5, "calories": 38, "carbohydrates": 8.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	puré de tomate	\N	puré de tomate
6df9cd67-2a0b-4c03-9de6-feedc4505be9	\N	{"per_100g": {"fat": 0, "protein": 0, "calories": 380, "carbohydrates": 98}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	azúcar moreno	\N	azúcar moreno
d82fd7d8-f83a-4071-af83-942997bebc32	\N	{"per_100g": {"fat": 0.4, "protein": 3.3, "calories": 35, "carbohydrates": 7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	broccolini	\N	broccolini
daca091a-a5c1-4445-811f-d3c785b3c2d8	\N	{"per_100g": {"fat": 0.1, "protein": 1.1, "calories": 40, "carbohydrates": 9.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	cebolla morada	\N	cebolla morada
46281316-4159-4f7d-b121-b6282f0f6130	\N	{"per_100g": {"fat": 11.2, "protein": 28.5, "calories": 213, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	falda de res	\N	falda de res
08c33ca6-6aab-4a3d-b128-d05b2a94ab86	\N	{"per_100g": {"fat": 14.7, "protein": 2, "calories": 160, "carbohydrates": 8.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	aguacate	\N	aguacate
3ff2f612-7b2b-457d-87bb-66dcd13a68d4	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/consome_de_pollo.png	{"per_100g": {"fat": 16.3, "protein": 13.4, "calories": 259, "carbohydrates": 17.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	chicken bouillon	consomé de pollo	chicken bouillon	consomé de pollo
3adca07e-b392-47ee-9fe0-a59d04c5fe4c	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/cebolla.png	{"per_100g": {"fat": 0.1, "protein": 1.1, "calories": 40, "carbohydrates": 9.3}}	2024-11-10 20:14:52.797477+00	2025-03-19 16:18:19.282765+00	onion	cebolla	onions	cebollas
925cae52-a47b-4b7e-bab0-3a108cdf2d68	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/azucar.png	{"per_100g": {"fat": 0, "protein": 0, "calories": 387, "carbohydrates": 99.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	sugar	azúcar	sugar	azúcar
cf3749a6-b748-437c-9e00-e712e6b3dc0a	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/hielos.png	{"per_100g": {"fat": 0, "protein": 0, "calories": 0, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	ice	hielo	ice	hielos
e4cc8e7e-7611-458a-944f-93a8814a794f	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/fresa.png	{"per_100g": {"fat": 0.3, "protein": 0.7, "calories": 32, "carbohydrates": 7.7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	strawberry	fresa	strawberries	fresa
18f6d718-73ac-4988-957b-d46f41134826	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate.png	{"per_100g": {"fat": 0.2, "protein": 0.9, "calories": 18, "carbohydrates": 3.9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	tomato	jitomate	tomatoes	jitomate
70bc7367-9825-446c-a75b-74cdac397115	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/crema_acida.png	{"per_100g": {"fat": 18.5, "protein": 2.1, "calories": 193, "carbohydrates": 4.6}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	sour cream	crema ácida	sour cream	crema ácida
fe70b469-2fa7-4eb7-863f-d2858f3db856	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/queso_panela.png	{"per_100g": {"fat": 16, "protein": 18, "calories": 215, "carbohydrates": 3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	panela cheese	queso panela	panela cheese	queso panela
2c18d5df-d202-4059-9bc3-7120a9ed30c5	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	{"per_100g": {"fat": 3.3, "protein": 10.4, "calories": 251, "carbohydrates": 63.9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	black pepper	pimienta negra	black pepper	pimienta negra
f85eab9e-475a-4913-88af-ed2965d3ff8c	\N	{"per_100g": {"fat": 7.1, "protein": 13, "calories": 281, "carbohydrates": 54.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chile ancho	\N	chiles anchos
dcd49cc4-7a55-4607-b1ee-ccea3f9741f7	\N	{"per_100g": {"fat": 7.8, "protein": 12.2, "calories": 324, "carbohydrates": 54.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chile mulato	\N	chiles mulatos
006d3093-1b84-4b82-8e04-c93235bbe608	\N	{"per_100g": {"fat": 5.9, "protein": 3.3, "calories": 131, "carbohydrates": 20.7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	romero	\N	romero
c63f283a-80ee-48e0-8d2e-efc2d4a91538	\N	{"per_100g": {"fat": 1.7, "protein": 5.6, "calories": 101, "carbohydrates": 24.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	tomillo	\N	tomillo
e0bb2e1f-c4ac-4739-afec-c7345499fd44	\N	{"per_100g": {"fat": 8.7, "protein": 6.1, "calories": 263, "carbohydrates": 72.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	pimienta gorda	\N	pimientas gordas
93be15c8-50da-4a6f-832b-d6f2c13c09a0	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/surtido_de_nueces_1743207250295.png	{"per_100g": {"fat": 38.9, "protein": 17.4, "calories": 0, "carbohydrates": 36.3}}	2025-03-29 00:14:11.000482+00	2025-03-29 00:14:11.000482+00	mixed nuts	surtido de nueces	mixed nuts	surtido de nueces
0bc82050-76a1-4605-80ea-d0613cf6eb66	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/nuez_de_la_india_1743315185762.png	{"per_100g": {"fat": 38.9, "protein": 17.4, "calories": 0, "carbohydrates": 36.3}}	2025-03-30 06:13:06.247351+00	2025-03-30 06:13:06.247351+00	cashew	nuez de la india	cashews	nueces de la india
c7e2cdde-33c7-4a72-a251-ad39e1063044	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/chile_chipotle.png	{"per_100g": {"fat": "0", "protein": "0", "calories": "0", "carbohydrates": "0"}}	2024-11-10 19:40:38.238789+00	2025-03-21 10:02:40.299505+00	chipotle chile	chile chipotle	chipotle chiles	chiles chipotles
a328a64b-1598-42c5-a241-7b155eb0b24d	\N	{"per_100g": {"fat": 49.9, "protein": 21.2, "calories": 579, "carbohydrates": 21.7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	almendra	\N	almendras
5c2683e5-a71c-4cfc-9536-c4813476f1e0	\N	{"per_100g": {"fat": 49, "protein": 30.2, "calories": 559, "carbohydrates": 10.7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	pepita de calabaza	\N	pepitas de calabaza
b4254921-8292-414f-b512-40054647e11f	\N	{"per_100g": {"fat": 49.2, "protein": 25.8, "calories": 567, "carbohydrates": 16.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	cacahuate	\N	cacahuates
325ca5e3-5d7a-4f82-8476-83f370d4b0fe	\N	{"per_100g": {"fat": 0.5, "protein": 3.1, "calories": 299, "carbohydrates": 79.2}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	pasas	\N	pasas
64889f11-250b-4331-8b3f-6b7262f9393c	\N	{"per_100g": {"fat": 1.2, "protein": 9.1, "calories": 272, "carbohydrates": 56}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	bolillo	\N	bolillo
3876d4bf-1f5f-467a-9dd8-f767e32c0267	\N	{"per_100g": {"fat": 100, "protein": 0, "calories": 902, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	manteca de cerdo	\N	manteca de cerdo
5b7f1de8-cd3b-42b1-9588-91bcee2faf57	\N	{"per_100g": {"fat": 31.3, "protein": 4.7, "calories": 545, "carbohydrates": 59.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chocolate de mesa	\N	chocolate de mesa
add619a3-ebc3-4a71-88e4-583941efc56b	\N	{"per_100g": {"fat": 0.2, "protein": 2.4, "calories": 23, "carbohydrates": 4.9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	alcaparras	\N	alcaparras
90625c88-a943-4544-83fb-2ebe440e2d9b	\N	{"per_100g": {"fat": 15.3, "protein": 1, "calories": 145, "carbohydrates": 3.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	aceitunas verdes	\N	aceitunas verdes
7830ad6c-666b-4c79-83fc-8124f737e26a	\N	{"per_100g": {"fat": 1.3, "protein": 20.5, "calories": 96, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	pescado blanco	\N	pescado blanco
efe728f5-db5a-472f-8051-9ed41d6908d5	\N	{"per_100g": {"fat": 0.2, "protein": 1.9, "calories": 40, "carbohydrates": 9.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chile güero	\N	chiles güeros
2d5cc159-580e-4645-bc36-c531d6f780e4	\N	{"per_100g": {"fat": 4.3, "protein": 9, "calories": 265, "carbohydrates": 69}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	orégano	\N	orégano
95d40d62-4569-477e-8a1a-134e95fbe38d	\N	{"per_100g": {"fat": 18.9, "protein": 13, "calories": 282, "carbohydrates": 21.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	achiote	\N	achiote
a18d8208-fe61-48cc-a099-a54d411f8051	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/espinca.png	{"per_100g": {"fat": 0.4, "protein": 2.9, "calories": 23, "carbohydrates": 3.6}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	fresh spinach	espinaca fresca	fresh spinach	espinaca fresca
55f5c81e-5ab4-4fbb-9f08-811fcb62e8ec	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/tostadas.png	{"per_100g": {"fat": 9.8, "protein": 8.5, "calories": 428, "carbohydrates": 77.2}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	tostada	tostada	tostadas	tostadas
b4cf7b05-e650-4dcc-b19e-cd8fe2b18cde	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/hojas_laurel.png	{"per_100g": {"fat": 8.4, "protein": 7.6, "calories": 313, "carbohydrates": 74.9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	bay leaf	hojas laurel	bay leaves	hojas laurel
eef8d309-12bf-410f-b013-7f1a1f062b0a	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/calabacita.png	{"per_100g": {"fat": 0.3, "protein": 1.2, "calories": 17, "carbohydrates": 3.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	zucchini	calabacita	zucchinis	calabacitas
d50ddc33-5a1c-43ec-a818-81a9648a0cf6	\N	{"per_100g": {"fat": 7.8, "protein": 13.9, "calories": 281, "carbohydrates": 54.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chile pasilla	\N	chile pasilla
30d0337d-3654-4edf-94ce-2049c74e0f1a	\N	{"per_100g": {"fat": 15, "protein": 27, "calories": 242, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	lomo de cerdo	\N	lomo de cerdo
fd4fd4df-0b40-4836-8d5f-6bfc92b749de	\N	{"per_100g": {"fat": 0.2, "protein": 0.9, "calories": 41, "carbohydrates": 9.6}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	zanahoria	\N	zanahoria
e922b7d5-ee4c-4697-94fe-cd1f95ed520d	\N	{"per_100g": {"fat": 0.3, "protein": 1, "calories": 31, "carbohydrates": 6.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	pimiento rojo	\N	pimiento rojo
57d294ce-b86d-4e64-ab25-9db223fc33d9	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/azucar_mascabado_1743308674770.png	{"per_100g": {"fat": 3.9, "protein": 7.2, "calories": "800", "carbohydrates": 75.5}}	2025-03-30 04:24:35.178769+00	2025-03-30 04:24:35.178769+00	brown sugar	azúcar mascabado	brown sugar	azúcar mascabado
d7b7df00-99e8-4bf6-9fe4-a34e6285691b	\N	{"per_100g": {"fat": 0.3, "protein": 3.1, "calories": 22, "carbohydrates": 3.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	champiñones	\N	champiñones
113b4cb8-4fd8-4129-9ab4-f1d2a915ae0b	\N	{"per_100g": {"fat": 30.5, "protein": 14.3, "calories": 332, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	carne molida de res	\N	carne molida de res
48705964-0d3b-487b-98e2-85439c9e88bb	\N	{"per_100g": {"fat": 36.3, "protein": 5.8, "calories": 525, "carbohydrates": 49.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	nuez moscada	\N	nuez moscada
81dbe144-f3c3-45fd-9de8-29df89648478	\N	{"per_100g": {"fat": 1.5, "protein": 13, "calories": 371, "carbohydrates": 75}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	pasta para lasaña	\N	pasta para lasaña
7b709a20-270e-4fbb-833c-38838a46f95d	\N	{"per_100g": {"fat": 28.9, "protein": 24.1, "calories": 355, "carbohydrates": 3.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	queso cotija	\N	queso cotija
c99266c4-7736-462c-a83f-1becc1c2f85e	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/cubos_de_caldo_de_tomate.png	{"per_100g": {"fat": 16.3, "protein": 13.4, "calories": 259, "carbohydrates": 17.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	tomato stock	caldo de tomate	tomato stock	caldo de tomate
a7beb9e1-43bd-4236-9afd-6b8100797934	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/chispa_de_chocolate_semi_amargo_1743873633836.png	{"per_100g": {"fat": "29", "protein": "7", "calories": "516", "carbohydrates": "54"}}	2025-04-05 17:20:34.413054+00	2025-04-05 17:20:34.413054+00	semi-sweet chocolate chip	chispa de chocolate semi-amargo	semi-sweet chocolate chips	chispas de chocolate semi-amargo
34f47708-3549-4c68-8e51-bdd50bfe2a11	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/chile_de_arbol_1742535697970.png	{"per_100g": {"fat": 0, "protein": 0, "calories": 0, "carbohydrates": 0}}	2025-03-21 05:41:38.48195+00	2025-03-21 08:30:58.392396+00	arbol chile	chile de árbol	arbol chile	chile de árbol
0e9dafe8-9561-4dc4-aa7c-11a135af336d	\N	{"per_100g": {"fat": 7.8, "protein": 12.2, "calories": 324, "carbohydrates": 54.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chile cascabel	\N	chile cascabel
5a8fbad4-dcde-4e4a-bdc0-d76ab8478b2f	\N	{"per_100g": {"fat": 1.5, "protein": 13, "calories": 371, "carbohydrates": 75}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	fideos	\N	fideos
d5e2fe57-a1c3-429b-8505-d055ff43a26d	\N	{"per_100g": {"fat": 1.4, "protein": 15.6, "calories": 92, "carbohydrates": 3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	calamar	\N	calamares
369a070c-5bdc-4692-ae03-d7455e586a60	\N	{"per_100g": {"fat": 2.3, "protein": 12.5, "calories": 85, "carbohydrates": 3.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	tinta de calamar	\N	tinta de calamar
39976d2a-f25b-481d-b25b-3f6ec6a01f51	\N	{"per_100g": {"fat": 0.4, "protein": 8.3, "calories": 39, "carbohydrates": 0.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	caldo de pescado	\N	caldo de pescado
3a7785ab-623d-46ea-af50-a07a6457d5c8	\N	{"per_100g": {"fat": 32, "protein": 30, "calories": 413, "carbohydrates": 0.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	queso gruyère	\N	queso gruyère
6c5ead57-fb10-40d5-9c23-1ab5d95f2559	\N	{"per_100g": {"fat": 3, "protein": 9, "calories": 274, "carbohydrates": 52}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	baguette	\N	baguette
304905da-c0b9-4109-92ea-41ed4324f032	\N	{"per_100g": {"fat": 0.8, "protein": 3, "calories": 36, "carbohydrates": 6.3}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	perejil	\N	perejiles
eeb45dbe-5408-4504-b04c-b9660223e7cb	\N	{"per_100g": {"fat": 35, "protein": 2.1, "calories": 345, "carbohydrates": 3.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	crema	\N	crema
b2e7d7b2-6cfe-4abd-bd61-4ecd5db98e52	\N	{"per_100g": {"fat": 34.2, "protein": 5.9, "calories": 342, "carbohydrates": 4.1}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	queso crema	\N	queso crema
2e83a6a4-60cb-4fcc-aac9-0363f59ff4ee	\N	{"per_100g": {"fat": 0.2, "protein": 2.2, "calories": 20, "carbohydrates": 3.9}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	espárragos	\N	espárragos
6c54f9d5-01a0-4b4c-8bf1-2663dec936ca	\N	{"per_100g": {"fat": 27.7, "protein": 20.8, "calories": 334, "carbohydrates": 0.5}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	queso brie	\N	queso brie
badf512c-d47d-487d-8b03-7806478b9ad2	\N	{"per_100g": {"fat": 16.3, "protein": 13.4, "calories": 259, "carbohydrates": 17.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	caldo de verdura	\N	caldo de verdura
c79d0713-10dc-4499-b097-8887cb3111ab	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/tocino_ahumado.png	{"per_100g": {"fat": 42, "protein": 37, "calories": 541, "carbohydrates": 1.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	smoked bacon	tocino ahumado	smoked bacon	tocino ahumado
4ddf1497-55c8-4651-b271-506b5ebca6dd	\N	{"per_100g": {"fat": 0.2, "protein": 0.3, "calories": 52, "carbohydrates": 14}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	manzana verde	\N	manzana verde
fc1252cf-c252-4f3c-90b9-6a219625ccc2	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/mezcla_de_verduras.png	{"per_100g": {"fat": 0.6, "protein": 3.6, "calories": 65, "carbohydrates": 11.8}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	frozen mixed veggies	mezcla de verduras	mixed veggies	mezcla de verduras
cdbf605e-0db8-457a-b544-efea58b19d38	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/extracto_de_vainilla_1743309373327.png	{"per_100g": {"fat": 0.1, "protein": 0.1, "calories": 288, "carbohydrates": 13.2}}	2025-03-30 04:36:13.74822+00	2025-03-30 04:36:13.74822+00	Vanilla extract	extracto de vainilla	vanilla extract	extracto de vainilla
79016c38-8bb5-4e6a-8edc-e15db85403f7	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/chispas_de_chocolate_1743316303097.png	{"per_100g": {"fat": 24, "protein": 4.4, "calories": 480, "carbohydrates": 63}}	2025-03-30 06:31:43.501642+00	2025-03-30 06:31:43.501642+00	chocolate chips	chispas de chocolate	chocolate chips	chispas de chocolate
b5ec64a4-de66-462c-866b-c605936e7491	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/consome_de_verduras_1744251519171.png	{"per_100g": {"fat": 0.3, "protein": 1.6, "calories": 0, "carbohydrates": 5.4}}	2025-04-10 02:18:39.749297+00	2025-04-10 02:18:39.749297+00	Vegetable stock	Consomé de verduras	Vegetable stock	Consomé de verduras
9810ea9b-e777-44b6-8556-fa454d925ae8	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/chile_guajillo_1742545398242.png	{"per_100g": {"fat": 0, "protein": 0, "calories": 0, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-21 08:29:14.026894+00	guajillo chile	chile guajillo	guajillo chile	chile guajillo
1617b0b9-3a02-4145-b655-b94b8e01ccc6	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/vaina_de_vainilla_1743309561753.png	{"per_100g": {"fat": 2.2, "protein": 21.6, "calories": 0, "carbohydrates": 59.8}}	2025-03-30 04:39:22.042998+00	2025-03-30 04:39:22.042998+00	vanilla bean	vaina de vainilla	vanilla beans	vainas de vainilla
d81531c0-4145-48dd-8534-59f971512de3	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/tahini_1744321451111.png	{"per_100g": {"fat": 53, "protein": 17, "calories": 595, "carbohydrates": 21}}	2025-04-10 21:44:11.583364+00	2025-04-10 21:44:11.583364+00	Tahini	Tahini	Tahini	Tahini
284380f3-ba50-4502-876d-edd61913d695	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	{"per_100g": {"fat": 0.5, "protein": 6.4, "calories": 149, "carbohydrates": 33.1}}	2024-11-10 20:17:26.063352+00	2025-03-19 16:18:19.282765+00	garlic	ajo	garlic	ajo
f4800457-fd2b-4c11-b52c-f135b3ad1601	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/chile_morita_1742545962394.png	{"per_100g": {"fat": 0, "protein": 0, "calories": 0, "carbohydrates": 0}}	2025-03-21 08:32:42.792685+00	2025-03-21 08:32:42.792685+00	morita chile	chile morita	morita chile	chile morita
47813fe1-7c3e-43cd-affd-d52f6346b575	\N	{"por_100ml": {"grasa": 0, "calorias": 260, "proteina": 0, "carbohidratos": 67}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	\N	jarabe de maple	\N	jarabe de maple
bb22d1b1-92cc-4e04-886f-81a9f3f2a869	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/avena_en_hojuelas_1743311522428.png	{"per_100g": {"fat": 5.9, "protein": 13.5, "calories": 0, "carbohydrates": 68.7}}	2025-03-30 05:12:02.955814+00	2025-03-30 05:12:02.955814+00	rolled oats	avena en hojuelas	rolled oats	avena en hojuelas
fc10fea8-0c65-431e-9806-e9057f8410d9	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite.png	{"por_100ml": {"grasa": 100, "calorias": 884, "proteina": 0, "carbohidratos": 0}}	2024-11-10 19:40:38.238789+00	2024-11-10 19:40:38.238789+00	oil	aceite	oil	aceite
7d8a4be4-962a-4c20-9b04-5eef71813419	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png	{"por_100ml": {"grasa": 0, "calorias": 0, "proteina": 0, "carbohidratos": 0}}	2024-11-10 19:51:50.616328+00	2024-11-10 19:51:50.616328+00	water	agua	water	agua
33147ac7-c604-439e-9228-e9eda30597b7	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	{"por_100ml": {"grasa": 100, "calorias": 884, "proteina": 0, "carbohidratos": 0}}	2024-11-10 20:18:36.564744+00	2025-03-05 20:06:48.167955+00	olive oil	aceite de oliva	olive oil	aceite de oliva
c1d49a05-71dc-42e3-b0cf-8adb0b5f0a9f	\N	{"per_100g": {"fat": 0.2, "protein": 1.6, "calories": 32, "carbohydrates": 7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	tomate triturado	\N	tomate triturado
acbd4e27-925a-47ca-a80a-9998049bff6f	\N	{"per_100g": {"fat": 0.4, "protein": 5.4, "calories": 81, "carbohydrates": 14}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	chícharos	\N	chícharos
919049db-9f30-456d-a1a3-2277b2a79df5	\N	{"per_100g": {"fat": 16.3, "protein": 13.4, "calories": 259, "carbohydrates": 17.4}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	caldo de res	\N	caldo de res
dbd1ce44-d5a0-40ab-b393-7ae3913e7f58	\N	{"per_100g": {"fat": 65.2, "protein": 15.2, "calories": 654, "carbohydrates": 13.7}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	\N	nuez	\N	nueces
1653a4c8-0005-4e2a-bb95-3d0d7708d6a8	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/mango.png	{"per_100g": {"fat": 0.4, "protein": 0.8, "calories": 60, "carbohydrates": 15}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	mango	mango	mangos	mangos
1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	{"per_100g": {"fat": 0, "protein": 0, "calories": 0, "carbohydrates": 0}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	salt	sal	salt	sal
1b2232b8-3c31-4bfd-a8a1-d97eb6da372c	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/spaghetti.png?t=2024-11-21T17%3A06%3A58.980Z	{"per_100g": {"fat": 1.5, "protein": 13, "calories": 371, "carbohydrates": 75}}	2024-11-10 19:40:38.238789+00	2025-03-19 16:18:19.282765+00	spaghetti	spaghetti	spaghetti	spaghetti
ab1ede88-afb4-4d93-b377-7c291c8ca5fb	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png	{"per_100g": {"fat": 40, "protein": 29.9, "calories": 0, "carbohydrates": 18.7}}	2026-01-12 06:55:31.757952+00	2026-01-12 06:55:31.757952+00	sesame seed	ajonjolí	sesame seeds	ajonjolíes
94755f60-0d7e-4d5c-a0ba-18a6971e6503	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/garbanzo_1768232559347.png	{"per_100g": {"fat": 6.3, "protein": 21.3, "calories": 0, "carbohydrates": 60.4}}	2026-01-12 15:42:40.333985+00	2026-01-12 15:42:40.333985+00	Chickpea	Garbanzo	Chickpeas	Garbanzos
f7ae69ff-d702-4625-af0d-19f82c84c6d6	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/cumin_1768233106896.png	{"per_100g": {"fat": 22.3, "protein": 17.8, "calories": 375, "carbohydrates": 44.2}}	2026-01-12 15:51:47.389232+00	2026-01-12 15:51:47.389232+00	Cumin	Cumin	Cumin	Cumin
4932147a-3a0d-429c-a347-4128ab04e644	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimenton_1768233198100.png	{"per_100g": {"fat": 12.9, "protein": 14.1, "calories": 282, "carbohydrates": 54.3}}	2026-01-12 15:53:18.676676+00	2026-01-12 15:53:18.676676+00	Paprika	Pimentón	Paprika	Pimentón
\.



COPY "public"."measurement_units" ("id", "type", "system", "symbol_en", "name_en", "name_en_plural", "symbol_es", "name_es", "name_es_plural", "updated_at", "created_at", "symbol_en_plural", "symbol_es_plural") FROM stdin;
g	weight	metric	g	gram	grams	g	gramo	gramos	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	g	g
kg	weight	metric	kg	kilogram	kilograms	kg	kilogramo	kilogramos	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	kg	kg
ml	volume	metric	ml	milliliter	milliliters	ml	mililitro	mililitros	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	ml	ml
l	volume	metric	l	liter	liters	l	litro	litros	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	l	l
tbsp	volume	imperial	tbsp.	tablespoon	tablespoons	cda.	cucharada	cucharadas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	tbsp.	cda.
tsp	volume	imperial	tsp.	teaspoon	teaspoons	cdta.	cucharadita	cucharaditas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	tsp.	cdta.
oz	weight	imperial	oz.	ounce	ounces	oz.	onza	onzas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	oz.	oz.
lb	weight	imperial	lb	pound	pounds	lb	libra	libras	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	lb	lb
taste	unit	universal	to taste	to taste	to taste	al gusto	al gusto	al gusto	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	to taste	al gusto
clove	unit	universal	clove	clove	cloves	diente	diente	dientes	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	cloves	dientes
cup	volume	imperial	cup	cup	cups	tza.	taza	tazas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	cups	tzas.
leaf	unit	universal	leaf	leaf	leaves	hoja	hoja	hojas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	leaves	hojas
piece	unit	universal	piece	piece	pieces	unidad	unidad	unidades	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	pieces	unidades
pinch	unit	universal	pinch	pinch	pinches	pizca	pizca	pizcas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	pinches	pizcas
slice	unit	universal	slice	slice	slices	rebanada	rebanada	rebanadas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	slices	rebanadas
sprig	unit	universal	sprig	sprig	sprigs	rama	rama	ramas	2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	sprigs	ramas
unit	unit	universal		unit	units				2026-01-12 07:16:58.267665+00	2025-03-26 19:06:44.724836+00	units	unidades
\.



COPY "public"."recipe_ingredients" ("recipe_id", "ingredient_id", "quantity", "recipe_section_en", "display_order", "optional", "notes_en", "notes_es", "measurement_unit_id", "updated_at", "recipe_section_es", "tip_en", "id", "tip_es", "created_at") FROM stdin;
10cadced-e31b-4846-a7ac-b20742068137	106230d2-4e83-4c9a-9fc0-693603b0f797	225.00	Main	1	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	7c6b6c03-6b7e-457b-9b06-df38d691ebef	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	925cae52-a47b-4b7e-bab0-3a108cdf2d68	150.00	Main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	b3128551-3e27-4f8b-a17c-56fe6773c4f6	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	57d294ce-b86d-4e64-ab25-9db223fc33d9	150.00	Main	3	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	c6f87ba0-35f1-4dc0-84df-d415c6c345ff	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2.00	Main	4	f	\N	\N	unit	2026-02-03 00:39:32.353131+00	Principal	\N	1e1451ff-a124-4cf8-a6ee-30005fa13efb	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	cdbf605e-0db8-457a-b544-efea58b19d38	1.25	Main	5	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	4eabffff-04c1-4953-899f-0dcfc45870ab	\N	2025-04-15 15:33:53.506976+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	94755f60-0d7e-4d5c-a0ba-18a6971e6503	400.00	Main	7	f	cooked and drained	cocidos y escurridos	g	2026-02-03 00:39:32.353131+00	Principal	You can replace tahini with the same amount of toasted sesame seeds. If you prefer a smoother texture, gradually add more water until you reach your desired consistency.	b8cceb18-baca-4c74-ae9e-082f0063c6f6	Puedes reemplazar el tahini por la misma cantidad de ajonjolí tostado. Si quieres una textura más lisa, añade agua poco a poco agua hasta obtener tu consistencia deseada.	2026-01-12 15:59:26.377149+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	f7ae69ff-d702-4625-af0d-19f82c84c6d6	1.00	Main	8	t	\N	\N	pinch	2026-02-03 00:39:32.353131+00	Principal	\N	cdee5009-4822-4ce1-b4ba-cd4f5420402e	\N	2026-01-12 15:59:26.377149+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	4932147a-3a0d-429c-a347-4128ab04e644	1.00	Main	9	t	\N	\N	pinch	2026-02-03 00:39:32.353131+00	Principal	\N	e3af07be-a645-4381-8553-cd5cfe628494	\N	2026-01-12 15:59:26.377149+00
411d8e8c-069c-43a6-af16-98b140dd53e0	106230d2-4e83-4c9a-9fc0-693603b0f797	225.00	Main	1	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	c878c637-7305-4969-8ed7-b49544443df3	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	57d294ce-b86d-4e64-ab25-9db223fc33d9	220.00	Main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	4541942c-3d60-462c-9d3a-36da5dab5481	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2.00	Main	3	f	\N	\N	unit	2026-02-03 00:39:32.353131+00	Principal	\N	18427bea-efe9-4702-9c07-70f5ca42f0ac	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	27d3d059-6aa0-4ae1-8ff4-365efce6483f	375.00	Main	4	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	bb89d744-d331-4c69-b327-43b3167652a0	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	d93e5598-b219-4f45-a270-392a7d155f58	1.00	Main	5	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	df3352f7-5f69-45e6-b03c-291cbae525ff	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.00	Main	6	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	ab3429f7-ae98-4af7-89fd-771106631759	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	784664ec-93f3-4464-b085-53c2640bba7a	1.00	Main	7	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	b22b96e2-185d-46c7-a724-642ca630d49e	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	925cae52-a47b-4b7e-bab0-3a108cdf2d68	100.00	Main	8	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	58f0398b-35db-461e-b7d3-91cc680b5fc1	\N	2025-04-15 18:21:11.227349+00
411d8e8c-069c-43a6-af16-98b140dd53e0	79016c38-8bb5-4e6a-8edc-e15db85403f7	400.00	Main	9	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	dae0e794-f852-47bd-a843-c956c45e2426	\N	2025-04-15 18:21:11.227349+00
4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	925cae52-a47b-4b7e-bab0-3a108cdf2d68	180.00	main	1	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	847e9d01-14fc-419f-8159-b0ee799aa3bd	\N	2025-03-26 19:07:28.982732+00
4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	3fa8daf9-b7bc-45b2-945f-4ca4cdbf0045	10.00	main	2	f	\N	recién exprimido	g	2026-02-03 00:39:32.353131+00	Principal	\N	961b97e6-901e-4428-b90b-033f9c885898	\N	2025-03-26 19:07:28.982732+00
4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	1653a4c8-0005-4e2a-bb95-3d0d7708d6a8	100.00	main	3	f	\N	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	dc465d3a-aec6-4550-953d-acb60c63066c	\N	2025-03-26 19:07:28.982732+00
4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	e4cc8e7e-7611-458a-944f-93a8814a794f	100.00	main	4	f	\N	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	cd481043-6391-4683-bec4-782e7eafa082	\N	2025-03-26 19:07:28.982732+00
4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	5f2ac71f-3e9e-4b39-823d-592125d30590	100.00	main	5	f	\N	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	ae27b1c5-7242-47e2-b213-c539f3dcf093	\N	2025-03-26 19:07:28.982732+00
4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	cf3749a6-b748-437c-9e00-e712e6b3dc0a	1000.00	main	6	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	2126e145-de08-4050-9163-a4b612df5463	\N	2025-03-26 19:07:28.982732+00
6a160e6c-306b-4c2e-b913-3898aaa8e920	fa195561-233a-4728-a308-e9e6ee1b4623	250.00	main	1	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	25f87fa6-399f-4ef3-b07d-3c66e41e675e	\N	2025-03-26 19:07:28.982732+00
6a160e6c-306b-4c2e-b913-3898aaa8e920	925cae52-a47b-4b7e-bab0-3a108cdf2d68	100.00	main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	ddc3ce83-b9b8-4f12-82c2-d16f5f757109	\N	2025-03-26 19:07:28.982732+00
6a160e6c-306b-4c2e-b913-3898aaa8e920	8fdf823c-20aa-4d5b-be57-fb69c120dd3e	100.00	main	3	f	\N	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	b75abfd3-0532-4f06-9830-a4ded0788099	\N	2025-03-26 19:07:28.982732+00
6a160e6c-306b-4c2e-b913-3898aaa8e920	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	1.00	main	4	f	\N	\N	unit	2026-02-03 00:39:32.353131+00	Principal	\N	3a0868fc-61d9-4fa9-9d58-c3cf8bedacc9	\N	2025-03-26 19:07:28.982732+00
6a160e6c-306b-4c2e-b913-3898aaa8e920	784664ec-93f3-4464-b085-53c2640bba7a	1.00	main	5	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	7e089b74-f339-47ff-9d35-3e3b68f2a2fb	\N	2025-03-26 19:07:28.982732+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	284380f3-ba50-4502-876d-edd61913d695	1.00	Meatballs	1	t	\N	\N	clove	2026-02-03 00:39:32.353131+00	Albóndigas	\N	611631da-73c1-4e7a-b2b9-6488a9da42d4	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	c0dc0e21-1d03-4d5a-875d-2c01929cdef1	400.00	Meatballs	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Albóndigas	\N	7498afce-a527-495b-93f4-69754d7e5cba	🙋🏽‍♀️*tip*	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2.00	Meatballs	3	f	\N	\N	unit	2026-02-03 00:39:32.353131+00	Albóndigas	\N	badcb0f9-a999-4496-93b2-33dffc27ab45	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	0.50	Meatballs	4	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Albóndigas	\N	5bf49478-436e-46b4-9230-1d58a86c4425	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	2c18d5df-d202-4059-9bc3-7120a9ed30c5	3.00	Meatballs	5	f	\N	\N	pinch	2026-02-03 00:39:32.353131+00	Albóndigas	\N	83bb4002-fd7d-489b-af31-c5e2b1c2d913	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	100.00	Tomato Sauce	6	f	halved	en mitades	g	2026-02-03 00:39:32.353131+00	Salsa de jitomate	\N	41bcef1b-4f74-426b-bccb-09d0d6c6fdbb	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	284380f3-ba50-4502-876d-edd61913d695	2.00	Tomato Sauce	7	f	\N	\N	clove	2026-02-03 00:39:32.353131+00	Salsa de jitomate	\N	cbee7cbc-a43a-46dd-a55b-ed4234b4a88e	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	fc10fea8-0c65-431e-9806-e9057f8410d9	1.00	Meatballs	8	f	for greasing	para engrasar	g	2026-02-03 00:39:32.353131+00	Albóndigas	\N	4716dba1-2aee-4ffe-8412-3d82e98150be	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	33147ac7-c604-439e-9228-e9eda30597b7	20.00	Tomato Sauce	9	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Salsa de jitomate	\N	f406bff6-c43b-4356-9202-227e063afc5e	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	2c18d5df-d202-4059-9bc3-7120a9ed30c5	1.00	Tomato Sauce	10	f	\N	\N	pinch	2026-02-03 00:39:32.353131+00	Salsa de jitomate	\N	433d10d0-4fdc-45ad-aeec-b04d9526de87	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	18f6d718-73ac-4988-957b-d46f41134826	600.00	Tomato Sauce	11	f	quartered	en cuartos	g	2026-02-03 00:39:32.353131+00	Salsa de jitomate	\N	d0393330-7961-4e60-9ba7-8cd8b432d9d7	\N	2025-04-15 18:18:10.058827+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	2.00	Tomato Sauce	12	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Salsa de jitomate	\N	00db22d6-0355-4ba3-a8f1-d185dbdc6e40	\N	2025-04-15 18:18:10.058827+00
8ef111aa-e965-42a4-a5be-6f7053c53269	284380f3-ba50-4502-876d-edd61913d695	20.00	main	1	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	0c4cdc38-96e3-46be-a365-a24575a1f98c	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	2d5cc159-580e-4645-bc36-c531d6f780e4	2.00	main	2	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	267e6c58-b03f-47ee-a7fc-b6397e27810f	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	95d40d62-4569-477e-8a1a-134e95fbe38d	15.00	main	3	f	\N	en pasta	\N	2026-02-03 00:39:32.353131+00	Principal	\N	6d3ae3d9-d86f-44bf-b291-f06ded94a928	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	2c18d5df-d202-4059-9bc3-7120a9ed30c5	0.50	main	4	f	\N	molida	\N	2026-02-03 00:39:32.353131+00	Principal	\N	dc748065-f03b-4c23-8cd1-42a91b5c85ef	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	2cebb2b5-a969-4043-b036-624ac2e632f6	0.50	main	5	f	\N	en polvo	\N	2026-02-03 00:39:32.353131+00	Principal	\N	98d27333-e687-4545-a324-178055b1e176	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	57125837-d2cb-41c5-a659-21fa18efbe48	100.00	main	6	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	a1731558-7915-4052-8f5e-9ee13301f10e	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	cd62d878-e42f-468c-8600-32b52bf8f88c	300.00	main	7	f	\N	agria	\N	2026-02-03 00:39:32.353131+00	Principal	\N	6f13ed34-99ef-41dc-b312-ac72d09be31a	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	100.00	main	8	f	\N	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	e0bdc095-b102-47d8-ab91-4987dbed0fa9	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	2.00	main	9	f	\N	fina	g	2026-02-03 00:39:32.353131+00	Principal	\N	8f6a5cf7-605e-42a0-8290-e080e81a59dd	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	57e7893a-e6e1-4820-b42a-1aa2bd553a64	1000.00	main	10	f	\N	en cubos (4 x 4 cm)	\N	2026-02-03 00:39:32.353131+00	Principal	\N	5011c3b2-8242-471a-8d4b-50e94ce8560d	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	fc10fea8-0c65-431e-9806-e9057f8410d9	20.00	main	11	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	2b15f63b-c9c0-43b0-9e35-4840f6395fc4	\N	2025-03-26 19:07:28.982732+00
8ef111aa-e965-42a4-a5be-6f7053c53269	3876d4bf-1f5f-467a-9dd8-f767e32c0267	20.00	main	12	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	11f5e455-049d-41e1-b75f-4f1b4ffba9ab	\N	2025-03-26 19:07:28.982732+00
8ef6695c-852b-4471-98e8-71ad417e7185	284380f3-ba50-4502-876d-edd61913d695	1.00	main	3	f	\N	\N	clove	2026-02-03 00:39:32.353131+00	Principal	\N	fc5de172-64ab-40f3-a546-b299dd363abb	\N	2025-04-02 16:52:09.385295+00
8ef6695c-852b-4471-98e8-71ad417e7185	18f6d718-73ac-4988-957b-d46f41134826	180.00	main	4	f	cut in pieces	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	77f1f5f4-cf90-45c0-8c83-2fc8f3eefeb5	\N	2025-04-02 16:52:09.385295+00
8ef6695c-852b-4471-98e8-71ad417e7185	c99266c4-7736-462c-a83f-1becc1c2f85e	2.00	main	5	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	ecbf5b37-1899-4a48-bdf9-eafce4667e28	\N	2025-04-02 16:52:09.385295+00
8ef6695c-852b-4471-98e8-71ad417e7185	fc10fea8-0c65-431e-9806-e9057f8410d9	20.00	main	6	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	917f2d20-6cdf-4d43-a63a-a95ca5c4a3f0	\N	2025-04-02 16:52:09.385295+00
8ef6695c-852b-4471-98e8-71ad417e7185	7d8a4be4-962a-4c20-9b04-5eef71813419	1000.00	main	7	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	4222e750-2d3c-4625-9ada-3112f789aadf	\N	2025-04-02 16:52:09.385295+00
8ef6695c-852b-4471-98e8-71ad417e7185	fc1252cf-c252-4f3c-90b9-6a219625ccc2	100.00	main	8	f	frozen carrots and peas	zanahoria y chícharos congelados	g	2026-02-03 00:39:32.353131+00	Principal	\N	0ae516f3-0bcf-4395-bf10-a339cd939acc	\N	2025-04-02 16:52:09.385295+00
8ef6695c-852b-4471-98e8-71ad417e7185	ae7dd72a-4562-4df4-bd06-0f3f14e61383	1.00	main	9	f	\N	fresco	\N	2026-02-03 00:39:32.353131+00	Principal	\N	921cad7f-67fd-4726-ac3d-52da42cfa97a	\N	2025-04-02 16:52:09.385295+00
9efe6751-3081-426d-836c-1a650cc5c24e	186fa6b2-588c-4941-a6ff-2851c036daaf	300.00	Main	1	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	b2045ec7-d235-4885-9403-346d7423952b	\N	2025-05-01 16:07:36.440057+00
9efe6751-3081-426d-836c-1a650cc5c24e	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.00	Main	2	t	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	ec68cb3e-5c1c-4962-900f-944f9cdb3ad0	\N	2025-05-01 16:07:36.440057+00
9efe6751-3081-426d-836c-1a650cc5c24e	7d8a4be4-962a-4c20-9b04-5eef71813419	1000.00	Main	3	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	c8bb8e2d-d4f1-4758-813c-eb8ae8ba25c1	\N	2025-05-01 16:07:36.440057+00
9efe6751-3081-426d-836c-1a650cc5c24e	fc10fea8-0c65-431e-9806-e9057f8410d9	10.00	Main	4	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	b28410dd-f617-4a79-a9fe-e67a7ffd9add	\N	2025-05-01 16:07:36.440057+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	852099ab-d3f6-4ee6-8985-750d7a7efd72	350.00	Main	1	f	peeled, deseeded, cut in pieces	pelados, sin semillas y cortados en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	fa0904f3-72da-4fb6-ad41-a5acdae1a0e1	\N	2025-04-05 12:57:02.756243+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.00	Main	2	f	plus extra to taste	y un poco más al gusto	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	38b8ef11-9ce1-44d7-9fdf-d45c287f57a0	\N	2025-04-05 12:57:02.756243+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	284380f3-ba50-4502-876d-edd61913d695	2.00	Main	3	f	\N	\N	clove	2026-02-03 00:39:32.353131+00	Principal	\N	33a888c1-1b59-4133-a2e2-f51746ad581d	\N	2025-04-05 12:57:02.756243+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	52b27f5c-888f-4cfe-a38b-ab48d048628c	5.00	Main	4	f	\N	\N	sprig	2026-02-03 00:39:32.353131+00	Principal	\N	344836a3-71ba-405c-8873-f278f5ef0cb9	\N	2025-04-05 12:57:02.756243+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	33147ac7-c604-439e-9228-e9eda30597b7	20.00	Main	5	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	725f17b0-277d-44b6-9d2c-cf90b997bc5c	\N	2025-04-05 12:57:02.756243+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	da667266-6861-4e6d-9aa3-bddd47efeb07	350.00	Main	6	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	922e805d-4134-42a2-b0b4-729b148c6c3c	\N	2025-04-05 12:57:02.756243+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	cacb8def-451c-4b10-929b-82356fd43bee	20.00	Main	7	t	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	6174cb62-242f-423b-b7b3-8ae652cccadd	\N	2025-04-05 12:57:02.756243+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	2c18d5df-d202-4059-9bc3-7120a9ed30c5	0.50	Main	8	f	plus extra to taste	y un poco más al gusto	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	09e5b168-2eac-4518-a1c0-18cd55fcc989	\N	2025-04-05 12:57:02.756243+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	284380f3-ba50-4502-876d-edd61913d695	2.00	main	1	f	\N	\N	clove	2026-02-03 00:39:32.353131+00	Principal	\N	8eb3d8a0-f189-4ccc-b8a7-eff109e77a2e	\N	2025-03-30 23:57:26.807574+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	150.00	main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	1495c10e-2288-4edd-bc5c-865ceb64da97	\N	2025-03-30 23:57:26.807574+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	fc10fea8-0c65-431e-9806-e9057f8410d9	15.00	main	3	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	6ce12674-a831-454b-8aba-9b79d59945fd	\N	2025-03-30 23:57:26.807574+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	eef8d309-12bf-410f-b013-7f1a1f062b0a	800.00	main	4	f	in pieces	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	73734cf6-c182-4293-9e56-8c649c341b1f	\N	2025-03-30 23:57:26.807574+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	7d8a4be4-962a-4c20-9b04-5eef71813419	400.00	main	5	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	506d59a9-f259-4509-a921-149d059574ee	\N	2025-03-30 23:57:26.807574+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	5.00	main	6	f	to taste	al gusto	g	2026-02-03 00:39:32.353131+00	Principal	\N	8e237e13-2691-41ce-a4c0-17362c0317ce	\N	2025-03-30 23:57:26.807574+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	2c18d5df-d202-4059-9bc3-7120a9ed30c5	5.00	main	7	t	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	bedd811f-dd4c-4e32-a8f0-7da6fb45af2e	\N	2025-03-30 23:57:26.807574+00
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	39ec0480-14af-4773-8c4d-e4fd16975c5e	50.00	main	8	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	c6c1f56e-f5d6-49b4-882d-bde885a8e8e1	\N	2025-03-30 23:57:26.807574+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	300.00	main	1	f	\N	en gajos o julianas de 1 cm.	g	2026-02-03 00:39:32.353131+00	Principal	\N	c1caa3de-d415-4d34-bbc1-920ca2e167eb	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	fc10fea8-0c65-431e-9806-e9057f8410d9	30.00	main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	e335f439-0004-4caf-b72a-86883b27ef08	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	eb811f56-9ce6-4805-8a47-98670e6d2890	500.00	main	3	f	\N	en cuartos	g	2026-02-03 00:39:32.353131+00	Principal	\N	a94f2d59-c16f-4430-9ec2-e825d14936f4	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	c7b67c23-2c8b-47c7-9e1c-5941dc4b64e1	1000.00	main	4	f	\N	deshuesada y sin piel, en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	40c78ca8-ea0d-4953-a04b-1bdfe6b513f5	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	3ff2f612-7b2b-457d-87bb-66dcd13a68d4	2.00	main	5	f	\N	o al gusto	\N	2026-02-03 00:39:32.353131+00	Principal	\N	8814eaed-8abf-4cfa-92fa-49affefed3fb	\N	2025-04-15 02:00:01.259527+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	57d294ce-b86d-4e64-ab25-9db223fc33d9	150.00	Main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	82f68c33-7020-4a32-b9b6-a7d2b2aacfe6	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2.00	Main	3	f	large	grandes	unit	2026-02-03 00:39:32.353131+00	Principal	\N	7d2f154d-36b2-49f7-a41a-9110232d4bc8	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	cdbf605e-0db8-457a-b544-efea58b19d38	1.25	Main	4	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	35183e09-c175-4735-8aff-88536f55f6a4	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	cacb8def-451c-4b10-929b-82356fd43bee	0.25	Main	5	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	501472af-6665-40e6-838e-263639a70673	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	27d3d059-6aa0-4ae1-8ff4-365efce6483f	275.00	Main	6	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	440dc74f-f2e4-4bd8-8237-dbf3a88b82bf	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	bb22d1b1-92cc-4e04-886f-81a9f3f2a869	50.00	Main	7	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	5f597002-c8e5-455c-9546-1578851329a3	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	d93e5598-b219-4f45-a270-392a7d155f58	1.00	Main	8	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	7b195a5f-0f83-4e70-8935-768f70303459	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	925cae52-a47b-4b7e-bab0-3a108cdf2d68	150.00	Main	9	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	ce1b310a-c453-4d01-8874-1434c4a25360	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.00	Main	10	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	bc9739ba-0b57-412d-8f84-d45d3feb6612	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	a6814eb2-a30c-4854-952e-5a3493c27242	1.00	Main	11	f	\N	\N	pinch	2026-02-03 00:39:32.353131+00	Principal	\N	b198d865-3cd3-4a7c-9fad-ecac1ec14cd8	\N	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	f8a3d26f-46b2-48de-8079-a7f539cb1258	250.00	Main	12	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	chopped	1a72c0de-fc76-4234-84e0-06f9b67feb38	picadas	2025-04-15 15:33:18.745041+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	a7beb9e1-43bd-4236-9afd-6b8100797934	450.00	Main	13	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	d2647283-0a48-4301-8996-609fb3bb401f	\N	2025-04-15 15:33:18.745041+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	2cf19ceb-2ec1-461d-b95d-084193c03e22	300.00	main	1	f	\N	en trozo	\N	2026-02-03 00:39:32.353131+00	Principal	\N	856cdf63-79e9-4969-9ce1-e24cee228e71	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	7d8a4be4-962a-4c20-9b04-5eef71813419	2300.00	main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	569c03f5-9568-4826-ab01-982eba454b2f	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	a9487655-6308-453b-8a70-f01fcd8c3c48	50.00	main	3	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	37aac08a-b11c-42a4-a8b6-47da834ce86f	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	33147ac7-c604-439e-9228-e9eda30597b7	30.00	main	4	f	\N	extra virgen	\N	2026-02-03 00:39:32.353131+00	Principal	\N	b58e01da-52e6-487b-9200-fca2d1f3b1e5	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.00	main	5	f	\N	fina, o al gusto	g	2026-02-03 00:39:32.353131+00	Principal	\N	19ed730c-160e-4ee6-af8e-2de017d2e77e	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	2c18d5df-d202-4059-9bc3-7120a9ed30c5	1.00	main	6	f	\N	molida, o al gusto	\N	2026-02-03 00:39:32.353131+00	Principal	\N	eabe3247-61bb-49f4-a860-3df4557e242e	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	46281316-4159-4f7d-b121-b6282f0f6130	500.00	main	7	f	\N	en trozos de 4 cm	\N	2026-02-03 00:39:32.353131+00	Principal	\N	d976eaa4-afb7-4d94-8470-0a9a07cb74b7	\N	2025-03-26 19:07:28.982732+00
3239cc54-4e79-4902-b8f7-d3716167bea4	8fdf823c-20aa-4d5b-be57-fb69c120dd3e	510.00	Main	1	f	in chunks	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	9a8db0a7-f1b9-4643-8948-e62a68f90c57	\N	2025-03-29 00:56:51.738196+00
3239cc54-4e79-4902-b8f7-d3716167bea4	33147ac7-c604-439e-9228-e9eda30597b7	50.00	Main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	c524c4f5-4dcb-4321-801b-a9e6ea2d1784	\N	2025-03-29 00:56:51.738196+00
3239cc54-4e79-4902-b8f7-d3716167bea4	34f47708-3549-4c68-8e51-bdd50bfe2a11	10.00	Main	3	f	\N	\N	unit	2026-02-03 00:39:32.353131+00	Principal	Árbol chiles are also known as red dried chiles. Remove the stems from the chiles and, if you prefer it less spicy, remove the seeds too.	0f557e30-cac9-4d46-8a6a-394681783635	Quita los tallos de los chiles y, si prefieres un sabor menos picante, también retira las semillas.	2025-03-29 00:56:51.738196+00
3239cc54-4e79-4902-b8f7-d3716167bea4	f4800457-fd2b-4c11-b52c-f135b3ad1601	5.00	Main	4	f	\N	\N	unit	2026-02-03 00:39:32.353131+00	Principal	\N	feaab7b6-6c07-41e6-9b8d-ca06b8bd8c0e	\N	2025-03-29 00:56:51.738196+00
3239cc54-4e79-4902-b8f7-d3716167bea4	9810ea9b-e777-44b6-8556-fa454d925ae8	3.00	Main	5	f	\N	\N	unit	2026-02-03 00:39:32.353131+00	Principal	\N	5870fe6e-beb0-4220-9fe4-d5225fd11385	\N	2025-03-29 00:56:51.738196+00
3239cc54-4e79-4902-b8f7-d3716167bea4	284380f3-ba50-4502-876d-edd61913d695	8.00	Main	6	f	\N	\N	clove	2026-02-03 00:39:32.353131+00	Principal	\N	2c589678-5cdb-43c8-a91d-ddce7a0d4f93	\N	2025-03-29 00:56:51.738196+00
3239cc54-4e79-4902-b8f7-d3716167bea4	93be15c8-50da-4a6f-832b-d6f2c13c09a0	130.00	Main	7	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	To keep your butter light in color, use shelled mixed nuts.	9bfdd1fc-8e05-4499-81f0-a8b3a7416dbf	Para que tu mantequilla tenga un color claro, usa un surtido de nueces sin cáscara. 	2025-03-29 00:56:51.738196+00
3239cc54-4e79-4902-b8f7-d3716167bea4	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	2.00	Main	8	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	7b8ae580-db60-44d6-89d7-10815c70923b	\N	2025-03-29 00:56:51.738196+00
8ef6695c-852b-4471-98e8-71ad417e7185	186fa6b2-588c-4941-a6ff-2851c036daaf	250.00	main	1	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	1b0d5cb8-774f-4396-b8c4-a6a835fd7455	\N	2025-04-02 16:52:09.385295+00
8ef6695c-852b-4471-98e8-71ad417e7185	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	50.00	main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	1b9afc0d-6cd2-4b64-9207-3894c0b80f18	\N	2025-04-02 16:52:09.385295+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	60.00	main	8	f	\N	blanca, en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	9d2f1054-26be-4522-a95e-0cc92a810990	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	284380f3-ba50-4502-876d-edd61913d695	1.00	main	9	f	\N	pelado	\N	2026-02-03 00:39:32.353131+00	Principal	\N	dd057a50-4603-428e-8d62-a44ccd95d7ee	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	18f6d718-73ac-4988-957b-d46f41134826	2.00	main	10	f	\N	saladet, sin semillas y cortados en tiras	g	2026-02-03 00:39:32.353131+00	Principal	\N	8fdb0482-915f-4fb2-9a5c-b84147571704	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	daca091a-a5c1-4445-811f-d3c785b3c2d8	40.00	main	11	f	\N	cortada en rebanadas finas	\N	2026-02-03 00:39:32.353131+00	Principal	\N	cd0448fc-2ca8-4f33-bafd-4745594e07bd	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	08c33ca6-6aab-4a3d-b128-d05b2a94ab86	1.00	main	12	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	37c22c82-4953-43f6-b179-84e78aef236a	\N	2025-03-26 19:07:28.982732+00
f4b73b2c-43c2-4743-88fb-29ddd739efc0	55f5c81e-5ab4-4fbb-9f08-811fcb62e8ec	10.00	main	13	f	\N	\N	\N	2026-02-03 00:39:32.353131+00	Principal	\N	d2d5adc9-58c0-46d8-89f9-109890066979	\N	2025-03-26 19:07:28.982732+00
10cadced-e31b-4846-a7ac-b20742068137	cacb8def-451c-4b10-929b-82356fd43bee	0.25	Main	6	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	0ada34d5-2c70-4bd7-9a8e-bca554612e87	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	27d3d059-6aa0-4ae1-8ff4-365efce6483f	275.00	Main	7	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	815b3e9f-5247-4e49-a99d-82fe9d559200	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	bb22d1b1-92cc-4e04-886f-81a9f3f2a869	50.00	Main	8	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	36dcc72c-3278-4e1f-84d8-22d21d638417	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	d93e5598-b219-4f45-a270-392a7d155f58	1.00	Main	9	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	8c2f97a5-ef18-440f-9f5e-2453b9e237c3	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.00	Main	10	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	764e0d80-d7dd-47e7-bf04-83c3aaa89719	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	a6814eb2-a30c-4854-952e-5a3493c27242	1.00	Main	11	f	\N	\N	pinch	2026-02-03 00:39:32.353131+00	Principal	\N	3d18a351-340c-4f56-a3df-54779b8e7e8e	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	f8a3d26f-46b2-48de-8079-a7f539cb1258	250.00	Main	12	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	135a8337-24dc-47d7-9365-46bbb2140f22	\N	2025-04-15 15:33:53.506976+00
10cadced-e31b-4846-a7ac-b20742068137	cf41b6a8-7aef-431f-b671-4e81ba4e0f81	400.00	Main	13	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	275fbf6e-e732-4dd9-94a8-e975a88823be	\N	2025-04-15 15:33:53.506976+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	284380f3-ba50-4502-876d-edd61913d695	3.00	Main	1	f	\N	\N	clove	2026-02-03 00:39:32.353131+00	Principal	\N	d8c50178-fa42-443a-9aa5-dfc656773b51	\N	2026-01-12 15:59:26.377149+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	7d8a4be4-962a-4c20-9b04-5eef71813419	60.00	Main	2	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	63956c79-9698-4ef2-911b-b1268690142b	\N	2026-01-12 15:59:26.377149+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	cacb8def-451c-4b10-929b-82356fd43bee	30.00	Main	3	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	783dd951-0b2a-4711-bfbc-6bbed3d0b35c	\N	2026-01-12 15:59:26.377149+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	33147ac7-c604-439e-9228-e9eda30597b7	70.00	Main	4	f	plus extra for serving	más extra para servir	g	2026-02-03 00:39:32.353131+00	Principal	\N	9b844443-174d-4685-b291-7bbbf9d757df	\N	2026-01-12 15:59:26.377149+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	d81531c0-4145-48dd-8534-59f971512de3	40.00	Main	5	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	82f25704-ed60-4083-a07d-c4026daaff66	\N	2026-01-12 15:59:26.377149+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.00	Main	6	f	\N	\N	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	93307ed8-eadd-4e27-9976-65124d097b00	\N	2026-01-12 15:59:26.377149+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	e4039b52-c436-4000-b62a-ee191fd41062	30.00	main	6	f	\N	o al gusto	\N	2026-02-03 00:39:32.353131+00	Principal	\N	882c23f1-894f-4cad-810f-142701206c59	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	b4cf7b05-e650-4dcc-b19e-cd8fe2b18cde	2.00	main	7	f	\N	secas	\N	2026-02-03 00:39:32.353131+00	Principal	\N	5a22d335-578b-41dc-87eb-a7775b3359e2	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	55f5c81e-5ab4-4fbb-9f08-811fcb62e8ec	18.00	main	8	f	\N	para servir	\N	2026-02-03 00:39:32.353131+00	Principal	\N	c1d3f7c1-4ff2-414d-9fc5-51fc963cbb75	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	70bc7367-9825-446c-a75b-74cdac397115	250.00	main	9	f	\N	para servir	g	2026-02-03 00:39:32.353131+00	Principal	\N	ce2b64e4-58a2-4d88-a483-12c2642c9bf2	\N	2025-04-15 02:00:01.259527+00
e50b81a2-b7e3-4802-b276-2a84cf8946e9	fe70b469-2fa7-4eb7-863f-d2858f3db856	200.00	main	10	f	\N	para servir	g	2026-02-03 00:39:32.353131+00	Principal	\N	630694aa-3623-4e57-9bd7-ec5a91bb68ab	\N	2025-04-15 02:00:01.259527+00
eaaa1574-6476-45fc-93e9-8636bc869be8	284380f3-ba50-4502-876d-edd61913d695	1.00	Main	1	f	\N	\N	clove	2026-02-03 00:39:32.353131+00	Principal	\N	0f116e7e-6fd1-410e-9a15-45e05059fb15	\N	2025-03-26 19:33:51.240002+00
eaaa1574-6476-45fc-93e9-8636bc869be8	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	80.00	Main	2	f	in cuarters	en cuartos	g	2026-02-03 00:39:32.353131+00	Principal	\N	45b0f44b-cd7d-40e4-9b8e-4802cd8246cb	\N	2025-03-26 19:33:51.240002+00
eaaa1574-6476-45fc-93e9-8636bc869be8	8fdf823c-20aa-4d5b-be57-fb69c120dd3e	30.00	Main	3	f	in pieces	en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	4409a9ed-6da6-41e6-bdb7-9452a6785dc5	\N	2025-03-26 19:33:51.240002+00
eaaa1574-6476-45fc-93e9-8636bc869be8	3caa301c-340e-4787-9a1d-ed069837898b	300.00	Main	4	f	florets and stalks, cut in pieces	floretes y tallos, en trozos	g	2026-02-03 00:39:32.353131+00	Principal	You can save some broccoli florets to decorate your dish when serving.	9b8f5bd6-5024-4bbc-9bc5-b9c20dec79a2	Puedes reservar algunos floretes de brócoli para decorar el plato al servir.	2025-03-26 19:33:51.240002+00
eaaa1574-6476-45fc-93e9-8636bc869be8	7d8a4be4-962a-4c20-9b04-5eef71813419	700.00	Main	5	f	\N	\N	g	2026-02-03 00:39:32.353131+00	Principal	\N	bdcf5ef8-6ed2-48e3-b696-373f13923801	\N	2025-03-26 19:33:51.240002+00
eaaa1574-6476-45fc-93e9-8636bc869be8	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.50	Main	6	f	to taste	al gusto	tsp	2026-02-03 00:39:32.353131+00	Principal	\N	01a42ac3-fd28-4cf0-bb96-b852905fcd22	\N	2025-03-26 19:33:51.240002+00
eaaa1574-6476-45fc-93e9-8636bc869be8	3a16b60a-e17d-4edd-b09d-e421531b2e53	100.00	Main	7	f	cut in pieces	cortada en trozos	g	2026-02-03 00:39:32.353131+00	Principal	\N	2ccbf2b1-626f-46f7-9dc7-f61b80523c18	\N	2025-03-26 19:33:51.240002+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	106230d2-4e83-4c9a-9fc0-693603b0f797	225.00	Main	1	f	at room temperature	a temperatura ambiente	g	2026-02-03 00:39:32.353131+00	Principal	\N	7f929d16-8c13-4573-b7e1-aec83eda77f3	\N	2025-04-15 15:33:18.745041+00
\.



COPY "public"."recipe_step_ingredients" ("id", "recipe_step_id", "ingredient_id", "quantity", "measurement_unit_id", "created_at", "updated_at", "display_order", "optional") FROM stdin;
34da43cb-bee7-4dba-915e-aa3e4176fb6d	1e71a2bb-40ae-40e5-944c-7197499fdfcc	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	80	g	2025-03-26 19:33:52.083292+00	2026-02-03 00:39:32.353131+00	1	f
72d25c80-523e-40ad-af75-38f02808732f	1e71a2bb-40ae-40e5-944c-7197499fdfcc	284380f3-ba50-4502-876d-edd61913d695	1	clove	2025-03-26 19:33:52.083292+00	2026-02-03 00:39:32.353131+00	2	f
c7b6c48a-837e-4fdb-af13-8fbaf17d6851	20759250-1e1b-452a-8666-0ed5f7ca3c16	c7b67c23-2c8b-47c7-9e1c-5941dc4b64e1	1000	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	1	f
93262396-4de5-4f0a-89e6-f6c4278c3e8b	273f2f4c-0d4b-4cad-abcd-385a41281b13	852099ab-d3f6-4ee6-8985-750d7a7efd72	350	g	2025-04-05 12:57:03.193832+00	2026-02-03 00:39:32.353131+00	1	f
1d50b695-ae95-4b72-8c3a-dbd7e982ce0c	273f2f4c-0d4b-4cad-abcd-385a41281b13	cacb8def-451c-4b10-929b-82356fd43bee	20	g	2025-04-05 12:57:03.193832+00	2026-02-03 00:39:32.353131+00	2	f
2b8d4472-e11d-42a1-8a14-23fa1bd94b02	273f2f4c-0d4b-4cad-abcd-385a41281b13	2c18d5df-d202-4059-9bc3-7120a9ed30c5	0.5	tsp	2025-04-05 12:57:03.193832+00	2026-02-03 00:39:32.353131+00	3	f
1f66147d-d291-448d-a755-e50adffa5cfb	31109c9b-b5fe-4e0a-8e86-54aa164a5a2d	a7beb9e1-43bd-4236-9afd-6b8100797934	450	g	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	1	f
31ec1c04-a530-4ce7-9e1f-424ccf1abf51	31109c9b-b5fe-4e0a-8e86-54aa164a5a2d	f8a3d26f-46b2-48de-8079-a7f539cb1258	250	g	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	2	f
1fca121a-3423-4d18-8dbc-e787a7ae4bd0	33e09cf6-91d8-4b4e-a0da-d63357560db7	925cae52-a47b-4b7e-bab0-3a108cdf2d68	180.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	1	f
8a9d9a7c-89f5-42b4-98ec-ab23f8228427	35c1d452-7ed1-40dd-a12b-a35b93824614	c7b67c23-2c8b-47c7-9e1c-5941dc4b64e1	1000	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	1	f
b4133515-64c4-460f-93ea-23bca2a09e3e	35c1d452-7ed1-40dd-a12b-a35b93824614	3ff2f612-7b2b-457d-87bb-66dcd13a68d4	2	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	2	f
8c7e9896-cbfc-40bf-8383-3dec90a2d3eb	35c1d452-7ed1-40dd-a12b-a35b93824614	e4039b52-c436-4000-b62a-ee191fd41062	30	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	3	f
6fe05610-9665-493e-bcd7-c40514c5f846	3ad1cabc-76cb-4c00-9d7e-6f82421a329e	5f2ac71f-3e9e-4b39-823d-592125d30590	100.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	1	f
70fea754-bd01-4dc6-9fe1-d1dda5cab887	3ad1cabc-76cb-4c00-9d7e-6f82421a329e	1653a4c8-0005-4e2a-bb95-3d0d7708d6a8	100.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	2	f
a0c5e292-547f-4faa-a718-4b027579f052	3ad1cabc-76cb-4c00-9d7e-6f82421a329e	e4cc8e7e-7611-458a-944f-93a8814a794f	100.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	3	f
7e86028b-b5ec-4c8c-b183-10a05e325535	3f06a86b-eea0-429c-9eb7-925c1fea8138	eb811f56-9ce6-4805-8a47-98670e6d2890	500	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	1	f
96566352-45f1-4c3d-8fb8-274c8d6b6616	3f6f7af6-6814-4852-a460-969f409e9f13	186fa6b2-588c-4941-a6ff-2851c036daaf	350	g	2025-05-01 16:07:37.000592+00	2026-02-03 00:39:32.353131+00	1	f
d2e1ea56-44c9-4e49-9f17-0821182d54c9	4014e876-9ed6-4e39-9d10-e618fa5abdca	27d3d059-6aa0-4ae1-8ff4-365efce6483f	275	g	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	1	f
88e3e165-eb5b-425d-9cc4-da0e9383711b	4014e876-9ed6-4e39-9d10-e618fa5abdca	bb22d1b1-92cc-4e04-886f-81a9f3f2a869	50	g	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	2	f
5df0d388-a3fa-4ec1-a0f5-78dd6c47985c	4014e876-9ed6-4e39-9d10-e618fa5abdca	d93e5598-b219-4f45-a270-392a7d155f58	1	tsp	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	3	f
3fd716a4-6c91-449c-bb7f-0a31cdf2d71a	4014e876-9ed6-4e39-9d10-e618fa5abdca	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1	tsp	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	4	f
1716ed7d-8d0b-400b-82ea-47809a4050e5	4014e876-9ed6-4e39-9d10-e618fa5abdca	a6814eb2-a30c-4854-952e-5a3493c27242	1	pinch	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	5	f
d72995c3-f875-49cb-a269-3bde287d449f	46a47e2a-be61-497f-9906-c474479d3be5	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	50	g	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	1	f
f3f14a2d-1ca1-4eae-b152-d4eba03c5f17	46a47e2a-be61-497f-9906-c474479d3be5	18f6d718-73ac-4988-957b-d46f41134826	180	g	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	2	f
a60f98b0-4d2d-4d81-bc5b-f5de5f75a289	46a47e2a-be61-497f-9906-c474479d3be5	284380f3-ba50-4502-876d-edd61913d695	1	clove	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	3	f
651854c4-7e3d-42c9-8698-911f4f3a5080	46a47e2a-be61-497f-9906-c474479d3be5	c99266c4-7736-462c-a83f-1becc1c2f85e	2	\N	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	4	f
8add3cd6-372e-438f-b148-a5dc6cfe6f07	46a47e2a-be61-497f-9906-c474479d3be5	fc10fea8-0c65-431e-9806-e9057f8410d9	20	g	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	5	f
ea29a373-d48b-40e1-b095-d0827fba0413	47b3a1bc-63ea-4b54-83e0-083c73834163	3caa301c-340e-4787-9a1d-ed069837898b	300	g	2025-03-26 19:33:52.083292+00	2026-02-03 00:39:32.353131+00	1	f
f2d66961-7f26-441a-8cb1-b827cd0e5576	47b3a1bc-63ea-4b54-83e0-083c73834163	3a16b60a-e17d-4edd-b09d-e421531b2e53	100	g	2025-03-26 19:33:52.083292+00	2026-02-03 00:39:32.353131+00	2	f
3f1ee478-5454-4dc6-b9da-56b85c46e6ac	48cda1d1-2055-441e-a6f4-a6a85109051d	186fa6b2-588c-4941-a6ff-2851c036daaf	250	g	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	1	f
e91fd312-e7c0-43c1-bac1-5476a54a8181	4948de6e-717b-4008-865b-1cd4e1d3782b	284380f3-ba50-4502-876d-edd61913d695	2	piece	2025-04-05 12:57:03.193832+00	2026-02-03 00:39:32.353131+00	1	f
6c7dfa71-88d5-4d34-bbac-276cd23a697e	4948de6e-717b-4008-865b-1cd4e1d3782b	33147ac7-c604-439e-9228-e9eda30597b7	20	g	2025-04-05 12:57:03.193832+00	2026-02-03 00:39:32.353131+00	2	f
7bc5ad22-ce8d-464e-a908-3d7b42291a18	4b14dffa-fae5-4271-9c11-73f20c08e59a	39ec0480-14af-4773-8c4d-e4fd16975c5e	50	g	2025-03-30 23:57:27.303609+00	2026-02-03 00:39:32.353131+00	1	f
e20f4ca1-b5f2-491b-a33a-d578cf33616d	544080ff-f889-4e1d-9f51-cc021d6df868	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2	unit	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	1	f
0958db67-429e-4e25-806c-35b570b627a2	544080ff-f889-4e1d-9f51-cc021d6df868	cdbf605e-0db8-457a-b544-efea58b19d38	1.25	tsp	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	2	f
19577efd-aa1a-4eb1-b6c4-34d1bbb96526	544080ff-f889-4e1d-9f51-cc021d6df868	cacb8def-451c-4b10-929b-82356fd43bee	0.25	tsp	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	3	f
dd8f17a8-fe42-4c4f-89d6-a2186c1397d3	54730980-5e78-4f11-8b83-95e60812fe67	106230d2-4e83-4c9a-9fc0-693603b0f797	225	g	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	1	f
a160d036-058b-41df-81ab-9284c68f49e5	54730980-5e78-4f11-8b83-95e60812fe67	925cae52-a47b-4b7e-bab0-3a108cdf2d68	150	g	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	2	f
ece72f51-6a09-44a4-841a-9fd0c9ae1448	54730980-5e78-4f11-8b83-95e60812fe67	57d294ce-b86d-4e64-ab25-9db223fc33d9	150	g	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	3	f
d0f750e4-6a2d-4b47-adfc-774fd135d96c	588ac3e2-41e9-4ff2-83eb-d8325d60c50c	27d3d059-6aa0-4ae1-8ff4-365efce6483f	275	g	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	1	f
87510e8d-f16e-4f1d-b94d-ad1c8d9ea4cf	588ac3e2-41e9-4ff2-83eb-d8325d60c50c	bb22d1b1-92cc-4e04-886f-81a9f3f2a869	50	g	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	2	f
b195229f-c5a8-4083-8825-605944745ed6	588ac3e2-41e9-4ff2-83eb-d8325d60c50c	d93e5598-b219-4f45-a270-392a7d155f58	1	tsp	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	3	f
682c2bb5-2b48-4a41-8405-b6ad93c965af	588ac3e2-41e9-4ff2-83eb-d8325d60c50c	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1	tsp	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	4	f
5b40b024-65ad-4c12-a836-3a43b55152ac	5b7692ca-f4ba-4eb3-8834-ef7620d838f5	7d8a4be4-962a-4c20-9b04-5eef71813419	400	g	2025-03-30 23:57:27.303609+00	2026-02-03 00:39:32.353131+00	1	f
c55068e9-9248-4082-a77f-86e0118a3f27	5b7692ca-f4ba-4eb3-8834-ef7620d838f5	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	3	tsp	2025-03-30 23:57:27.303609+00	2026-02-03 00:39:32.353131+00	2	f
418b02a1-1e4e-4cd1-a12f-573ae3d0c789	693d353a-c99a-4f65-bbe2-bc6e0708f775	34f47708-3549-4c68-8e51-bdd50bfe2a11	10	unit	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	1	f
11e10474-b750-4f74-a653-68c9f14fdeed	693d353a-c99a-4f65-bbe2-bc6e0708f775	f4800457-fd2b-4c11-b52c-f135b3ad1601	5	unit	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	2	f
a43341d8-0652-4ee0-9126-58466b947068	693d353a-c99a-4f65-bbe2-bc6e0708f775	9810ea9b-e777-44b6-8556-fa454d925ae8	3	unit	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	3	f
344cf0a9-2d6d-41d9-9804-ed337a8dbe4b	693d353a-c99a-4f65-bbe2-bc6e0708f775	284380f3-ba50-4502-876d-edd61913d695	8	clove	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	4	f
d6837149-6d91-4da5-b783-cd09a0d8e1f4	693d353a-c99a-4f65-bbe2-bc6e0708f775	93be15c8-50da-4a6f-832b-d6f2c13c09a0	130	g	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	5	f
7ba2240f-ac52-4648-91e0-f45bd4efecdf	6eac8059-dbb0-408e-9587-326d7406c717	f8a3d26f-46b2-48de-8079-a7f539cb1258	250	g	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	1	f
8c9abb7b-3b48-4106-8cd8-cad6d39825b0	6eac8059-dbb0-408e-9587-326d7406c717	cf41b6a8-7aef-431f-b671-4e81ba4e0f81	400	g	2025-04-15 15:33:54.045438+00	2026-02-03 00:39:32.353131+00	2	f
97eedc18-f47d-4a77-b50a-4a596a45484a	70386dc4-5fb7-43a5-8a4d-5df69fba9597	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2	unit	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	1	f
87e795a4-afd4-40fd-a8c1-bfdc9b176b52	70386dc4-5fb7-43a5-8a4d-5df69fba9597	cdbf605e-0db8-457a-b544-efea58b19d38	1.25	tsp	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	2	f
951cd1c4-2ed8-4ba1-8221-ccbb49f6df85	70386dc4-5fb7-43a5-8a4d-5df69fba9597	cacb8def-451c-4b10-929b-82356fd43bee	0.25	tsp	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	3	f
6e0ee630-eb26-4fb7-a503-d13789cb410e	76597468-07e7-46cd-bbe7-04381255e3b3	cf3749a6-b748-437c-9e00-e712e6b3dc0a	1000.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	1	f
87de08a6-2e85-4691-ae3a-c56520ee9b76	784309b1-5c5f-4eb9-b7b7-6a231caebb03	7d8a4be4-962a-4c20-9b04-5eef71813419	1000	g	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	1	f
14ef0cf7-8b88-4a80-99d8-aad385548ee4	784309b1-5c5f-4eb9-b7b7-6a231caebb03	fc1252cf-c252-4f3c-90b9-6a219625ccc2	100	g	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	2	f
af7af48e-b480-41eb-853b-2fa02128d87d	784309b1-5c5f-4eb9-b7b7-6a231caebb03	ae7dd72a-4562-4df4-bd06-0f3f14e61383	1	sprig	2025-04-02 16:52:09.818987+00	2026-02-03 00:39:32.353131+00	3	f
02c78567-384d-49ca-8e23-fcd64e20a7fa	85cfdd0d-c845-42e0-9b7d-8ea56b86b15b	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	100	g	2025-04-15 18:18:10.720006+00	2026-02-03 00:39:32.353131+00	1	f
8eef1914-ab29-4af7-95c5-d1033f70fe74	85cfdd0d-c845-42e0-9b7d-8ea56b86b15b	33147ac7-c604-439e-9228-e9eda30597b7	20	g	2025-04-15 18:18:10.720006+00	2026-02-03 00:39:32.353131+00	2	f
e9dc5922-5f38-424d-9793-27638baa85aa	8a5a2b82-bbc1-452d-a74d-75b7f7036965	106230d2-4e83-4c9a-9fc0-693603b0f797	225	g	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	1	f
86fa97ff-5052-4a2f-97aa-3989c40b60da	8a5a2b82-bbc1-452d-a74d-75b7f7036965	57d294ce-b86d-4e64-ab25-9db223fc33d9	150	g	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	2	f
e84c948b-3c04-4625-860a-36cb0eeedc15	8a5a2b82-bbc1-452d-a74d-75b7f7036965	925cae52-a47b-4b7e-bab0-3a108cdf2d68	150	g	2025-04-15 15:33:19.286634+00	2026-02-03 00:39:32.353131+00	3	f
203323f5-756b-4c14-9169-ec9bf8a675ba	b71abc71-2d78-4d19-b7df-49d4191bb599	94755f60-0d7e-4d5c-a0ba-18a6971e6503	400	g	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	7	f
0f7affe8-ca7f-40b2-8a0d-5b4b1006b0ef	bbd468c7-d906-40e9-b149-40422ac3cf86	cf3749a6-b748-437c-9e00-e712e6b3dc0a	1000.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	1	f
921d90a1-b9b5-41fc-9f3f-7af2d02f8a03	c25bb724-0505-4b28-b5e7-b2b2f144d087	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1	tsp	2025-05-01 16:07:37.000592+00	2026-02-03 00:39:32.353131+00	1	t
d80d3d1e-0dba-499c-8efd-cced9d741b45	c25bb724-0505-4b28-b5e7-b2b2f144d087	7d8a4be4-962a-4c20-9b04-5eef71813419	1000	g	2025-05-01 16:07:37.000592+00	2026-02-03 00:39:32.353131+00	2	f
58eb6613-5057-42bc-974d-fccad91d336b	12e177d7-a551-436a-9c32-fe2d94316491	852099ab-d3f6-4ee6-8985-750d7a7efd72	350	g	2025-04-05 12:57:03.193832+00	2026-02-03 00:39:32.353131+00	1	f
4baa6eed-c833-4c37-adfd-eef628471aa0	12e177d7-a551-436a-9c32-fe2d94316491	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1	tsp	2025-04-05 12:57:03.193832+00	2026-02-03 00:39:32.353131+00	2	f
93017da7-b9ca-46ff-a154-5ccdfda7d990	131be1a2-5550-4139-bc39-2ab0052cba3e	8fdf823c-20aa-4d5b-be57-fb69c120dd3e	30	g	2025-03-26 19:33:52.083292+00	2026-02-03 00:39:32.353131+00	1	f
8612be0f-e86e-458a-a499-a1699be234b8	c25bb724-0505-4b28-b5e7-b2b2f144d087	fc10fea8-0c65-431e-9806-e9057f8410d9	15	g	2025-05-01 16:07:37.000592+00	2026-02-03 00:39:32.353131+00	3	f
70882abe-51dc-4a20-abbb-7aac8dfc8793	c31be125-8502-4180-85da-201164f7d427	8fdf823c-20aa-4d5b-be57-fb69c120dd3e	100.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	1	f
8eb86980-ffae-4631-a400-c9568c9dee39	c31be125-8502-4180-85da-201164f7d427	925cae52-a47b-4b7e-bab0-3a108cdf2d68	100.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	2	f
9f65789b-7e5f-4c2c-9c79-73e5b32fff2b	c31be125-8502-4180-85da-201164f7d427	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	1.00	unit	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	3	f
bee0b1da-8911-412c-b5db-81bc829998e4	c31be125-8502-4180-85da-201164f7d427	fa195561-233a-4728-a308-e9e6ee1b4623	250.00	g	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	4	f
dc7ce63c-35ea-4d33-8b79-07332be2c2b1	c31be125-8502-4180-85da-201164f7d427	784664ec-93f3-4464-b085-53c2640bba7a	1.00	tsp	2025-02-11 21:48:30.967373+00	2026-02-03 00:39:32.353131+00	5	f
ebce6aa9-3708-4fb0-a047-f731a12e3574	c52927df-852b-4753-9e9c-647fe09eaca9	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	0.5	tsp	2025-04-15 18:18:10.720006+00	2026-02-03 00:39:32.353131+00	1	f
5c3dd27b-a877-4242-b15f-10aed9efe7c9	c52927df-852b-4753-9e9c-647fe09eaca9	18f6d718-73ac-4988-957b-d46f41134826	600	g	2025-04-15 18:18:10.720006+00	2026-02-03 00:39:32.353131+00	2	f
945b8ac8-cf9b-478c-8a15-dd6e4414ab33	cc6d84c7-317e-4b83-8f1d-79e72bbe5e88	33147ac7-c604-439e-9228-e9eda30597b7	1	taste	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	1	f
c8295177-36c4-4518-aaf4-8ed4c031bd95	cc6d84c7-317e-4b83-8f1d-79e72bbe5e88	f7ae69ff-d702-4625-af0d-19f82c84c6d6	1	taste	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	2	t
7905a507-4481-4892-9542-f46eafe03674	cc6d84c7-317e-4b83-8f1d-79e72bbe5e88	4932147a-3a0d-429c-a347-4128ab04e644	1	taste	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	3	t
8f7fbb6c-4828-4ab7-b077-890181a43125	cd695949-cc15-4d5a-a548-67229b9e741c	c0dc0e21-1d03-4d5a-875d-2c01929cdef1	400	g	2025-04-15 18:18:10.720006+00	2026-02-03 00:39:32.353131+00	1	f
cfbb126c-66c8-4bf0-b7ad-d731376bfd6e	cd695949-cc15-4d5a-a548-67229b9e741c	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2	unit	2025-04-15 18:18:10.720006+00	2026-02-03 00:39:32.353131+00	2	f
c62568b5-2639-4cac-b5b8-9da39ee8c815	cd695949-cc15-4d5a-a548-67229b9e741c	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	0.5	tsp	2025-04-15 18:18:10.720006+00	2026-02-03 00:39:32.353131+00	3	f
c0da02d3-1d93-4d07-ad3f-e729a7a42283	ce291ca9-5386-49ca-ba4d-5f31170b7d55	8fdf823c-20aa-4d5b-be57-fb69c120dd3e	455	g	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	1	f
d5e72cb5-5a87-4125-81b8-d1f9b550efa0	cf84baf2-d3b9-4751-aa36-c9450a338ee3	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	150	g	2025-03-30 23:57:27.303609+00	2026-02-03 00:39:32.353131+00	1	f
7df5475a-eb81-4415-ad2b-69d70f66b9c8	cf84baf2-d3b9-4751-aa36-c9450a338ee3	284380f3-ba50-4502-876d-edd61913d695	2	clove	2025-03-30 23:57:27.303609+00	2026-02-03 00:39:32.353131+00	2	f
e1c76467-f5db-4972-8377-70bc5b3dcf65	cf84baf2-d3b9-4751-aa36-c9450a338ee3	fc10fea8-0c65-431e-9806-e9057f8410d9	15	g	2025-03-30 23:57:27.303609+00	2026-02-03 00:39:32.353131+00	3	f
c01426ca-27e2-4465-8589-279772e261ce	da8610fb-5cd6-4238-8ea0-93386333fb20	70bc7367-9825-446c-a75b-74cdac397115	250	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	1	f
181e89c1-79c7-463f-8f92-b56d8e661968	da8610fb-5cd6-4238-8ea0-93386333fb20	fe70b469-2fa7-4eb7-863f-d2858f3db856	200	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	2	f
aad8992c-5584-418a-81b4-9a490cf744af	e63440f5-e4a0-4779-ab6c-6b5e5ece65b3	eef8d309-12bf-410f-b013-7f1a1f062b0a	800	g	2025-03-30 23:57:27.303609+00	2026-02-03 00:39:32.353131+00	1	f
f560b99a-ddc0-4721-8d58-638a321bc65d	f9e95847-a87f-4f39-8d7a-46ecc69102f6	79016c38-8bb5-4e6a-8edc-e15db85403f7	400	g	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	1	f
91753265-8023-4b0a-bec2-eaae2e91572e	987de18e-9af0-4b10-9e98-60e271783569	8fdf823c-20aa-4d5b-be57-fb69c120dd3e	55	g	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	1	f
1a89b31e-f8f7-4d5e-895b-2ae6edc9f29f	987de18e-9af0-4b10-9e98-60e271783569	33147ac7-c604-439e-9228-e9eda30597b7	50	g	2025-03-29 00:56:52.30683+00	2026-02-03 00:39:32.353131+00	2	f
0fa4d8db-87e3-418d-bbc7-986d352be492	9ab72830-1cce-4ee9-aa5a-4940e1ab463f	a5d01bdc-1ef7-439e-b948-86f6575e4dd4	2	unit	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	1	f
5fefa8bc-5b62-48be-8d31-afb071d2b784	9c0ae9a3-76ac-4822-ab82-d519e5c44249	7d8a4be4-962a-4c20-9b04-5eef71813419	700	g	2025-03-26 19:33:52.083292+00	2026-02-03 00:39:32.353131+00	1	f
c42bdca0-04c0-4159-892c-c86f96e0017a	9c0ae9a3-76ac-4822-ab82-d519e5c44249	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1.5	tsp	2025-03-26 19:33:52.083292+00	2026-02-03 00:39:32.353131+00	2	f
418b01b0-e051-4ffc-8953-73c9eff13e5b	a85b48c2-9b01-4315-95ff-595bb8537074	3adca07e-b392-47ee-9fe0-a59d04c5fe4c	300	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	1	f
7b907459-1ce0-4e51-b16c-ae6f21853e06	a85b48c2-9b01-4315-95ff-595bb8537074	fc10fea8-0c65-431e-9806-e9057f8410d9	30	g	2025-04-15 02:00:01.641266+00	2026-02-03 00:39:32.353131+00	2	f
9a557c1b-6247-473c-b6a4-2abd3fb48038	af76b950-62b6-4e1a-baa4-adaa723b15b0	106230d2-4e83-4c9a-9fc0-693603b0f797	225	g	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	1	f
749e88cb-2c07-410a-942f-b90edd35dddc	af76b950-62b6-4e1a-baa4-adaa723b15b0	57d294ce-b86d-4e64-ab25-9db223fc33d9	220	g	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	2	f
a30b04a9-0378-4d6b-8cb3-a3b0372d8d15	af76b950-62b6-4e1a-baa4-adaa723b15b0	925cae52-a47b-4b7e-bab0-3a108cdf2d68	100	g	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	3	f
ad880610-7627-482f-a630-28ab14bc872a	b0a7fee5-ea07-4589-858d-d076b7924621	27d3d059-6aa0-4ae1-8ff4-365efce6483f	375	g	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	1	f
2b22c223-653f-47ae-832c-921208d37c44	b0a7fee5-ea07-4589-858d-d076b7924621	d93e5598-b219-4f45-a270-392a7d155f58	1	tsp	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	2	f
16088b1e-c513-4b16-9ae1-00f000b888bd	b0a7fee5-ea07-4589-858d-d076b7924621	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1	tsp	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	3	f
78e01bf2-ff89-41a4-a398-4404f363dee7	b0a7fee5-ea07-4589-858d-d076b7924621	784664ec-93f3-4464-b085-53c2640bba7a	1	tsp	2025-04-15 18:21:11.767775+00	2026-02-03 00:39:32.353131+00	4	f
36f9f635-50b2-4d36-946b-f1446811c84e	b71abc71-2d78-4d19-b7df-49d4191bb599	284380f3-ba50-4502-876d-edd61913d695	3	clove	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	1	f
42dfce0c-d697-4197-a908-986725bdeb08	b71abc71-2d78-4d19-b7df-49d4191bb599	7d8a4be4-962a-4c20-9b04-5eef71813419	60	g	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	2	f
f7aca10a-af69-4d17-8890-c3efaa7245a6	b71abc71-2d78-4d19-b7df-49d4191bb599	cacb8def-451c-4b10-929b-82356fd43bee	30	g	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	3	f
45402b34-20c1-433e-b85a-4d92549ab818	b71abc71-2d78-4d19-b7df-49d4191bb599	1d31eb37-74cf-4ed1-9281-4d6dcce02dc2	1	tsp	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	4	f
e8f1a2fb-f046-4ee8-ad8c-86d391736f52	b71abc71-2d78-4d19-b7df-49d4191bb599	33147ac7-c604-439e-9228-e9eda30597b7	70	g	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	5	f
266a05cc-0b26-4e48-b00a-2af8875ca559	b71abc71-2d78-4d19-b7df-49d4191bb599	d81531c0-4145-48dd-8534-59f971512de3	40	g	2026-01-12 15:59:26.720676+00	2026-02-03 00:39:32.353131+00	6	f
\.



COPY "public"."recipe_steps" ("id", "recipe_id", "order", "instruction_en", "instruction_es", "thermomix_time", "thermomix_temperature", "recipe_section_en", "recipe_section_es", "created_at", "updated_at", "thermomix_temperature_unit", "tip_en", "tip_es", "thermomix_is_blade_reversed", "thermomix_speed", "thermomix_speed_start", "thermomix_speed_end") FROM stdin;
3f6f7af6-6814-4852-a460-969f409e9f13	9efe6751-3081-426d-836c-1a650cc5c24e	1	Weigh the rice in the simmering basket, rinse well, and set aside.	Pesa el arroz en el cestillo, enjuaga bien y reserva.	\N	\N	Main	Principal	2025-05-01 16:07:36.801376+00	2025-05-01 16:07:36.801376+00	\N	\N	\N	\N	\N	\N	\N
c25bb724-0505-4b28-b5e7-b2b2f144d087	9efe6751-3081-426d-836c-1a650cc5c24e	2	Place the oil, water, salt in the Thermomix® bowl, insert the simmering basket with the rice, and cook %thermomix%.	Coloca el aceite, el agua, y la sal en el bowl de tu Thermomix®, introduce el cestillo con el arroz y cocina %thermomix%. 	1500	100	Main	Principal	2025-05-01 16:07:36.801376+00	2025-05-01 16:07:36.801376+00	C	\N	\N	\N	1	\N	\N
33e09cf6-91d8-4b4e-a0da-d63357560db7	4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	1	Add the sugar and pulverize %thermomix%	Coloca el azúcar en el vaso y pulveriza %thermomix%	15	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	10	\N	\N
c0d588f7-4a42-458e-9cf8-39aa32c4f89e	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	1	Preheat the oven to 150°C/300°F. Line a baking sheet with parchment paper.	Precalienta el horno a 150°C/300°F. Forra una bandeja para hornear con papel para hornear.	\N	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	\N	\N	\N	\N
8a5a2b82-bbc1-452d-a74d-75b7f7036965	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	2	Place the butter, granulated sugar, and brown sugar in the mixing bowl. Cream **45 sec/speed 3**.	Coloca la mantequilla, el azúcar granulada y azúcar moreno en el vaso. Acrema programando **45 seg/vel 3**.	45	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	\N	3	\N	\N
82d85fce-e16a-4204-9659-020eee1b3f49	eaaa1574-6476-45fc-93e9-8636bc869be8	5	Make your soup creamy by blending for **1 min**, gradually increasing the **speed 4-8**.	Para lograr una textura cremosa licúa **1 min**, aumentando gradualmente la **velocidad 4-8**.	60	\N	Main	Principal	2025-03-26 19:33:51.846224+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	\N	4	8
48cda1d1-2055-441e-a6f4-a6a85109051d	8ef6695c-852b-4471-98e8-71ad417e7185	1	Weigh the rice in the basket, rinse well, and set aside.	Pesa el arroz en el cestillo, enjuagua bien y reserva.	\N	\N	Main	Principal	2025-04-02 16:52:09.679892+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	\N	\N
46a47e2a-be61-497f-9906-c474479d3be5	8ef6695c-852b-4471-98e8-71ad417e7185	2	Place the onion, tomato, garlic clove, tomato stock, and oil in the mixing bowl, and blend %thermomix%.	Coloca en el vaso la cebolla, el jitomate, el diente de ajo, los cubos de caldo y el aceite, licúa %thermomix%.	20	\N	Main	Principal	2025-04-02 16:52:09.679892+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	10	\N	\N
35e5a4e3-9974-421e-bc59-58452645a724	8ef6695c-852b-4471-98e8-71ad417e7185	3	Scrape down the sides of the mixing bowl and sauté %thermomix%.	Baja los restos de las paredes del vaso y sofríe %thermomix%.	300	120	Main	Principal	2025-04-02 16:52:09.679892+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
784309b1-5c5f-4eb9-b7b7-6a231caebb03	8ef6695c-852b-4471-98e8-71ad417e7185	4	Add the water, place the basket inside the mixing bowl, add the frozen vegetable and cilantro to the basket, cook %thermomix%.	Añade el agua, coloca el cestillo dentro del vaso, añade al cestillo la mezcla de verduras congeladas y la rama de cilantro, cocina|**28 min. / 100 °C / vel. 4**.	1680	100	Main	Principal	2025-04-02 16:52:09.679892+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	4	\N	\N
a4cceabb-1fdd-4b68-b79d-7095dcfe02ae	8ef6695c-852b-4471-98e8-71ad417e7185	5	Remove the basket using the spatula, transfer to a baking dish, and stir with the spatula to loosen the rice. Serve hot.	Saca el cestillo con ayuda de la espátula, vierte en un refractario y mueve con la espátula para soltar el arroz. Sirve caliente.	\N	\N	Main	Principal	2025-04-02 16:52:09.679892+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	\N	\N
12e177d7-a551-436a-9c32-fe2d94316491	c376bc2c-e1fb-493a-9bcb-5d7746f2410e	1	Place cucumbers and salt in mixing bowl then chop 3 sec/speed 5.	Coloca los pepinos y la sal el bowl de tu Thermomix® y pica 3 seg/vel 5.	3	\N	Main	Principal	2025-04-05 12:57:03.0524+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	5	\N	\N
f5728519-c252-44c3-994e-6f05c950b294	c376bc2c-e1fb-493a-9bcb-5d7746f2410e	2	Transfer to simmering basket and, using a large spoon or your hands, squeeze as much water out of chopped cucumber as possible then set aside.	Transfiere al cestillo y con una cuchara grande o con las manos, exprime el pepino picado al máximo y reserva.	\N	\N	Main	Principal	2025-04-05 12:57:03.0524+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	\N	\N
273f2f4c-0d4b-4cad-abcd-385a41281b13	c376bc2c-e1fb-493a-9bcb-5d7746f2410e	4	Add reserved chopped cucumbers, yogurt, lemon juice and pepper then mix 20 sec/reverse blades/speed 2.5.	Agrega los pepinos picados escurridos reservados, el yogur, el jugo de limón y la pimienta, y mezcla 20 seg/giro a la izquierda/vel 2.5.	20	\N	Main	Principal	2025-04-05 12:57:03.0524+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	t	2.5	\N	\N
6cd97aaf-61d7-4a5e-8c92-1afdef088921	c376bc2c-e1fb-493a-9bcb-5d7746f2410e	5	Adjust seasoning to taste, transfer to a bowl and refrigerate before serving (🙋🏽‍♀️ tip).	Rectifica la sazón al gusto, transfiere a un tazón y refrigera antes de servir (🙋🏽‍♀️ tip).	\N	\N	Main	Principal	2025-04-05 12:57:03.0524+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	\N	\N
70386dc4-5fb7-43a5-8a4d-5df69fba9597	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	3	Add the eggs, vanilla, and lemon juice. Mix **30 sec/speed 3.5**.	Añade los huevos, la vainilla y el jugo de limón. Mezcla **30 seg/vel 3.5**.	30	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	\N	3.5	\N	\N
588ac3e2-41e9-4ff2-83eb-d8325d60c50c	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	4	Add the flour, oats, baking soda, salt, and cinnamon. Mix **35 sec/speed 4**. Do not overmix.	Agrega la harina, la avena, el bicarbonato, la sal y la canela. Mezcla **35 seg/vel 4**. No sobre mezcles.	35	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	\N	4	\N	\N
987de18e-9af0-4b10-9e98-60e271783569	3239cc54-4e79-4902-b8f7-d3716167bea4	1	Add **55 g** of butter and the olive oil to the mixing bowl and set %thermomix%\n	Agrega **55 g** de mantequilla y el aceite de oliva al vaso y programa %thermomix%\n	240	120	Main	Principal	2025-03-29 00:56:52.145206+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
693d353a-c99a-4f65-bbe2-bc6e0708f775	3239cc54-4e79-4902-b8f7-d3716167bea4	2	Add the chiles, garlic, and nuts. Sauté for %thermomix% or until everything is lightly toasted.	Añade los chiles, los ajos y las nueces. Sofríe %thermomix% o hasta que todo esté ligeramente dorado.	360	120	Main	Principal	2025-03-29 00:56:52.145206+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
31109c9b-b5fe-4e0a-8e86-54aa164a5a2d	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	5	Fold in the chocolate chips and walnuts. Mix %thermomix%	Incorpora las chispas de chocolate y las nueces. Mezcla %thermomix%	40	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	t	3	\N	\N
50ebcc32-b047-4137-9ecf-3d258e1615d8	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	6	Using a spoon, drop portions of dough onto the lined baking sheet, leaving 5cm between each.	Con la ayuda de una cuchara, coloca montoncitos de masa sobre la charola de horno forrada, dejando 5cm de separación entre cada una.	\N	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	\N	\N	\N	\N
071fa93f-104d-4fae-8e03-9cbf7ae65876	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	7	Bake at 150°C/300°F for 20-23 min or until the edges are golden brown and the center is still soft.	Hornea a 150°C/300°F por 20-23 min o hasta que los bordes estén dorados y el centro aún suave.	\N	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	\N	\N	\N	\N
2edfd714-07aa-4ba3-a209-4bcbc968844a	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	8	Remove from the oven and let cool before serving.	Retira del horno y deja enfriar antes de servir.	\N	\N	Main	Principal	2025-04-15 15:33:19.102568+00	2025-04-15 15:33:19.102568+00	\N	\N	\N	\N	\N	\N	\N
e0bdd77a-8b7d-4247-bfcc-8647c470dbe6	10cadced-e31b-4846-a7ac-b20742068137	1	Preheat the **oven** to **150°C/300°F**. Line a **baking sheet** with **parchment paper**.	Precalienta **el horno** a **150°C/300°F**. Forra **una bandeja** para hornear con **papel para hornear**.	\N	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	\N	\N	\N	\N	\N	\N	\N
54730980-5e78-4f11-8b83-95e60812fe67	10cadced-e31b-4846-a7ac-b20742068137	2	Place the **butter**, **granulated sugar**, and **brown sugar** in the mixing bowl. Cream %thermomix%.	Coloca **la mantequilla**, **el azúcar** y **azúcar moreno** en el vaso. Acrema programando %thermomix%.	45	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	C	\N	\N	\N	3	\N	\N
544080ff-f889-4e1d-9f51-cc021d6df868	10cadced-e31b-4846-a7ac-b20742068137	3	Add the **eggs**, **vanilla**, and **lemon juice**. Mix %thermomix%.	Añade **los huevos**, **la vainilla** y **el jugo de limón**. Mezcla %thermomix%.	30	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	C	\N	\N	\N	3.5	\N	\N
20759250-1e1b-452a-8666-0ed5f7ca3c16	e50b81a2-b7e3-4802-b276-2a84cf8946e9	4	Shred the chicken (reverse the direction of the blades) %thermomix%	Deshebre el pollo (revierte el sentido de giro) %thermomix%.	4	\N	Main	Principal	2025-04-15 02:00:01.479204+00	2025-04-15 02:00:01.479204+00	C	\N	\N	t	4	\N	\N
4014e876-9ed6-4e39-9d10-e618fa5abdca	10cadced-e31b-4846-a7ac-b20742068137	4	Add **the flour**, **oats**, **baking soda**, **salt**, and **cinnamon**. Mix %thermomix%. Do not overmix.	Agrega **la harina**, **la avena**, **el bicarbonato**, **la sal** y **la canela**. Mezcla %thermomix%. No sobre mezcles.	35	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	\N	\N	\N	\N	4	\N	\N
6eac8059-dbb0-408e-9587-326d7406c717	10cadced-e31b-4846-a7ac-b20742068137	5	Fold in the **raisins** and **walnuts**. Mixing %thermomix%.	Incorpora **las pasitas** y **las nueces**. Mezclando %thermomix%.	40	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	C	\N	\N	t	3	\N	\N
e8cd820f-7464-4715-85d2-58c15b98dfda	10cadced-e31b-4846-a7ac-b20742068137	6	Using a **spoon**, drop portions of dough onto the **lined baking sheet**, leaving 5cm between each.	Con la ayuda de **una cuchara**, coloca montoncitos de masa sobre **la charola de horno forrada**, dejando 5cm de separación entre cada una.	\N	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	\N	\N	\N	\N	\N	\N	\N
ba36185c-ca34-4cb1-9f5f-b78da8eeb427	10cadced-e31b-4846-a7ac-b20742068137	7	Bake at **150°C/300°F** for **20-23 min** or until the edges are golden brown and the center is still soft.	Hornea a **150°C/300°F** por **20-23 min** o hasta que los bordes estén dorados y el centro aún suave.	\N	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	\N	\N	\N	\N	\N	\N	\N
a49a7ba9-e8b6-40cf-ba3a-741b466007e9	10cadced-e31b-4846-a7ac-b20742068137	8	Remove from the oven and let cool before serving.	Retira del horno y deja enfriar antes de servir.	\N	\N	Main	Principal	2025-04-15 15:33:53.885613+00	2025-04-15 15:33:53.885613+00	\N	\N	\N	\N	\N	\N	\N
fafc5b35-4595-4dfd-a4e1-fb2f8d917c3a	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	1	Place the parsley and garlic in the mixing bowl, chop for **5 sec/speed 7**, and scrape down the sides with the spatula.	Coloca en el vaso el perejil y el diente de ajo, pica **5 seg/vel 7** y baja los restos de las paredes del vaso con la espátula.	5	\N	Meatballs	Albóndigas	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	\N	\N	\N	\N	7	\N	\N
cd695949-cc15-4d5a-a548-67229b9e741c	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	2	Add the ground beef, eggs, salt, and pepper. Mix for **10 sec/speed 5**, transfer to a bowl, and set aside.	Añade la carne molida de res, los huevos, la sal, y la pimienta. Mezcla **10 seg/vel 5**, transfiere a un tazón y reserva.	10	\N	Meatballs	Albóndigas	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	\N	\N	🙋🏽‍♀️*tip*	\N	5	\N	\N
63cd282c-cbc2-4ec1-89f3-7c73e0f6235d	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	3	Grease the Varoma tray and container. With greased hands, shape the meatballs (🙋🏽‍♀️ *tip*) and place them in the greased Varoma tray and container. Cover and set aside.	Engrasa el recipiente y la charola Varoma. Con las manos engrasadas, forma las albóndigas (🙋🏽‍♀️*tip*) y colóquelas en el recipiente y la charola Varoma engrasados. Tapa y reserva.	\N	\N	Meatballs	Albóndigas	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	\N	\N	🙋🏽‍♀️*tip*	\N	\N	\N	\N
85cfdd0d-c845-42e0-9b7d-8ea56b86b15b	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	4	Place the garlic, onion, and olive oil in the mixing bowl, chop for **5 sec/speed 5**.	Coloca en el vaso los diente de ajo, la cebolla y el aceite de oliva, pica **5 seg/vel 5**.	5	\N	Tomato Sauce	Salsa de jitomate	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	\N	\N	\N	\N	5	\N	\N
62775aa0-2603-4ddc-b46c-8158569ee223	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	5	Scrape down the sides with a spatula. Sauté for **3 min/120°C/speed 1**.	Baja los restos de las paredes del vaso con la espátula. Sofríe **3 min/120°C/vel 1**.	180	120	Tomato Sauce	Salsa de jitomate	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	\N	\N	\N	\N	1	\N	\N
c52927df-852b-4753-9e9c-647fe09eaca9	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	6	Add the tomatoes, salt, oregano, thyme, and pepper, and purée for **7 sec/speed 6**.	Añade el jitomate, la sal, el orégano, el tomillo y la pimienta y tritura **7 seg/vel 6**.	7	\N	Tomato Sauce	Salsa de jitomate	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	\N	\N	\N	\N	6	\N	\N
6550b2ca-ea51-4324-9a10-12cbf841adf3	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	7	Place the Varoma in position and cook for **20 min/Varoma/speed 2**.	Coloca el Varoma en su posición y cocina **20 min/Varoma/vel 2**.	1200	Varoma	Meatballs with tomato sauce	Albóndigas en salsa de jitomate	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	\N	\N	\N	\N	2	\N	\N
15b3981d-ea1a-4a29-ad70-bc7ac829bacc	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	8	Serve the meatballs hot with the tomato sauce.	Sirve las albóndigas calientes con la salsa.	\N	\N	Meatballs with tomato sauce	Albóndigas en salsa de jitomate	2025-04-15 18:18:10.492046+00	2025-04-15 18:18:10.492046+00	C	\N	\N	\N	\N	\N	\N
af76b950-62b6-4e1a-baa4-adaa723b15b0	411d8e8c-069c-43a6-af16-98b140dd53e0	1	Place the butter, brown sugar, and sugar in the mixing bowl and cream for **45 sec/speed 3**.	Coloca en el vaso la mantequilla, el azúcar mascabado y el azúcar regular y acrema durante **45 seg/vel 3**.	45	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	3	\N	\N
9ab72830-1cce-4ee9-aa5a-4940e1ab463f	411d8e8c-069c-43a6-af16-98b140dd53e0	2	Add the eggs and mix for **15 sec/speed 3**.	Añade los huevos y mezcle **15 seg/vel 3**.	15	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	3	\N	\N
b0a7fee5-ea07-4589-858d-d076b7924621	411d8e8c-069c-43a6-af16-98b140dd53e0	3	Add the flour, cornstarch, baking soda, salt, and baking powder, then mix for **20 sec/speed 4**.	Agrega la harina, la fécula de maíz, el bicarbonato, la sal y el polvo para hornear e integra todo por **20 seg/vel 4**.	20	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	4	\N	\N
dd97c98d-1013-4c29-892e-f10262b1c487	411d8e8c-069c-43a6-af16-98b140dd53e0	4	Scrape down the sides and loosen the dough from the bottom of the bowl using the spatula. If the ingredients are not fully incorporated, mix again for **15 sec/speed 4**.	Baja los restos de las paredes y despega la masa del fondo del vaso con ayuda de la espátula y , si los ingredientes aún no se han integrado, repite **15 seg/vel 4**.	15	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	4	\N	\N
f9e95847-a87f-4f39-8d7a-46ecc69102f6	411d8e8c-069c-43a6-af16-98b140dd53e0	5	Add the chocolate chips and mix **30 sec/reverse blades/speed 3**.	Añade las chispas de chocolate y mezcla **30 seg/giro a la izquierda /vel 3**.	30	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	t	3	\N	\N
c8773fa9-b6f8-464b-b332-1d8aad7b0b72	411d8e8c-069c-43a6-af16-98b140dd53e0	6	Scrape the dough from the bottom of the bowl and mix again for **40 sec/reverse blades/speed 3**.	Despega la masa del fondo del vaso con ayuda de la espátula y mezcla nuevamente **40 seg/giro a la izquierda /vel 3**.	40	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	t	3	\N	\N
cbaba89f-b389-4eac-97e3-7e3231fbdee8	411d8e8c-069c-43a6-af16-98b140dd53e0	7	Transfer the dough to a bowl and use a spoon to shape 60 g dough balls.	Transfiere la masa a un tazón y usando una cuchara forma bolitas de 60 g.	\N	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	\N	\N	\N
7bf856c6-de51-46d5-8608-adf8bbaa0f5e	411d8e8c-069c-43a6-af16-98b140dd53e0	8	Freeze overnight or for at least three hours before baking.	Congélalas toda la noche o por un mínimo tres horas antes de hornear.	\N	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	\N	\N	\N
49476737-7e48-4da9-a985-f40adb64960f	411d8e8c-069c-43a6-af16-98b140dd53e0	9	Preheat the oven to **210°C (400°F)**. Place the cookie dough balls on a parchment-lined baking sheet, leaving **2 cm** between them, and bake for **13-15 minutes**, or until golden on the outside but soft on the inside.	Precalienta el horno a **210°C**, coloca tus galletas en una charola para hornear forrada con papel para hornear dejando 2 cm de separación y hornea de **13-15 mins** o hasta que se vean doraditas por fuera, pero blandas por dentro.	\N	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	\N	\N	\N
ea1f2325-c46a-49d9-a3c5-6e979a8ce14e	411d8e8c-069c-43a6-af16-98b140dd53e0	10	Let them rest on the baking sheet for a few minutes. The cookies will continue baking from the residual heat and need time to set before transferring them to a cooling rack.	Deja reposar en la charola por unos minutos. Las galletas aún se están cociendo con el calor que tienen dentro y les toma un tiempo endurecer lo suficiente para que puedas transferirlas a un rack a enfriar por completo.	\N	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	\N	\N	\N
a9496adb-25a1-45d6-935f-16b0e2f50f9b	411d8e8c-069c-43a6-af16-98b140dd53e0	11	Enjoy them with coffee, a glass of milk, or your favorite drink.	Acompáñalas con un cafecito, un vaso de leche o tu bebida favorita y disfrute.	\N	\N	Main	Principal	2025-04-15 18:21:11.591051+00	2025-04-15 18:21:11.591051+00	\N	\N	\N	\N	\N	\N	\N
33456191-63ed-4750-8acb-24d0a4c9f178	3239cc54-4e79-4902-b8f7-d3716167bea4	3	Blend for %thermomix% and then scrape down the sides with the spatula.	Licúa %thermomix% y luego aja los restos con la espátula.	10	\N	Main	Principal	2025-03-29 00:56:52.145206+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	8	\N	\N
bbd468c7-d906-40e9-b149-40422ac3cf86	4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	3	Add the ice and crush it %thermomix%.	Añade los hielos y tritúralos %thermomix%.	45	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	9	\N	\N
b0ae6840-cd74-4fc0-b248-5ba60715313e	6a160e6c-306b-4c2e-b913-3898aaa8e920	1	Preheat the oven to **180 °C / 350 °F**. Line a baking sheet with parchment paper and set aside.	Precalienta el horno a **180 °C / 350 °F**. Cubre una charola de horno con papel encerado y reserva.	\N	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	\N	\N
ce291ca9-5386-49ca-ba4d-5f31170b7d55	3239cc54-4e79-4902-b8f7-d3716167bea4	4	Add the salt and the remaining 455 g of butter in chunks and mix for  %thermomix% until smooth. 	Agrega la sal y los 455 g restantes de mantequilla en trozos y mezcla %thermomix% hasta obtener una textura homogénea. 	60	50	Main	Principal	2025-03-29 00:56:52.145206+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	5	\N	\N
35d597f6-29d0-4018-a6ae-cd1596578295	6a160e6c-306b-4c2e-b913-3898aaa8e920	3	Place some sugar on a plate. Form a ball with a tablespoon of dough and dip one part of the dough ball into the sugar. Place it on the baking sheet and flatten it with a fork to form a round cookie (approx. Ø 4 cm).	Coloca un poco de azúcar en un plato. Forma una bolita con una cucharada de masa y hunde una parte de la bolita de masa en el azúcar.  Colócala en la charola de horno y aplana con un tenedor formando una galleta redonda (aprox. Ø 4 cm). 	\N	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	\N	\N
fe24ae2b-0110-47ba-9c91-b6f35a2dd168	6a160e6c-306b-4c2e-b913-3898aaa8e920	4	Repeat with the rest of the dough and bake for **15-20 minutes** at **180 °C / 350 °F** or until slightly golden. Let cool on a cooling rack before serving or storing in an airtight container.	Repite con el resto de la masa y hornea por **15-20 minutos** a **180 °C / 350 °F** o hasta que doren ligeramente. Deja enfriar en una rejilla antes de servir o guardar en un recipiente hermético.	\N	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	\N	\N
86542485-9948-48f5-b596-601a416d3608	3239cc54-4e79-4902-b8f7-d3716167bea4	5	Transfer to a airtight container, let it cool and store in the fridge.	Vierte en un recipiente hermético, deja enfriar y guárdala en el refri.	\N	\N	Main	Principal	2025-03-29 00:56:52.145206+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	\N	\N	\N
e63440f5-e4a0-4779-ab6c-6b5e5ece65b3	d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	3	Add the zucchini in pieces to your Thermomix® and chop %thermomix%	Añade las calabacitas en trozos al vaso de tu Thermomix®, pica %thermomix%	5	\N	Main	Principal	2025-03-30 23:57:27.145023+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	5	\N	\N
de98b104-70e4-4f36-a5e2-37b532da991e	d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	7	Add a creamy touch to your soup by blending|**1 min.** incrementing progressively **vel. 4-8**	Dale un toque cremosito a tu sopa licuando **1 min.** incrementando progresivamente **vel. 4-8**	60	\N	Main	Principal	2025-03-30 23:57:27.145023+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	\N	4	8
054a0f19-2feb-43c7-951b-cf29db90c76c	d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	4	Scrape the walls of the bowl and cook %thermomix%	Baja los restos de las paredes del vaso y sofríe %thermomix%	420	120	Main	Principal	2025-03-30 23:57:27.145023+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
3ad1cabc-76cb-4c00-9d7e-6f82421a329e	4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	2	Add the lemon juice and the fruit in pieces, mix %thermomix%.	Añade el jugo de limón y la fruta en trozos, muele %thermomix%.	10	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	5	\N	\N
76597468-07e7-46cd-bbe7-04381255e3b3	4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	4	Scrape the walls of the bowl with the spatula and crush again %thermomix%.	Baja los restos de las paredes del vaso con ayuda de la espátula, mezcla bien con la espátula y tritura nuevamente %thermomix%	45	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	9	\N	\N
cf84baf2-d3b9-4751-aa36-c9450a338ee3	d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	1	Add garlic, onion and oil to your Thermomix® and chop %thermomix%	Añade el ajo, la cebolla y el aceite al vaso de tu Thermomix® y pica %thermomix%	3	\N	Main	Principal	2025-03-30 23:57:27.145023+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	5	\N	\N
78d9d7f2-957b-41b3-ae9f-1690f174f27c	d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	2	Scrape the walls of the bowl and cook %thermomix%	Baja los restos de las paredes del vaso y sofríe %thermomix%	300	120	Main	Principal	2025-03-30 23:57:27.145023+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
4b14dffa-fae5-4271-9c11-73f20c08e59a	d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	6	Add the spinach and cook for %thermomix%	Añade la espinaca y cocina por otros %thermomix%	180	100	Main	Principal	2025-03-30 23:57:27.145023+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	2	\N	\N
5b7692ca-f4ba-4eb3-8834-ef7620d838f5	d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	5	Add the water, salt and pepper and cook %thermomix%	Añade el agua, la sal y la pimienta y cocina %thermomix%	720	100	Main	Principal	2025-03-30 23:57:27.145023+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
1e71a2bb-40ae-40e5-944c-7197499fdfcc	eaaa1574-6476-45fc-93e9-8636bc869be8	1	Place garlic and onions in mixing bowl then chop %thermomix%. Scrape down sides of mixing bowl with spatula.\n	Coloca el ajo y la cebolla en el vaso de tu Thermomix® y pica %thermomix%. Baja los restos con la espátula.	5	\N	Main	Principal	2025-03-26 19:33:51.846224+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	5	\N	\N
131be1a2-5550-4139-bc39-2ab0052cba3e	eaaa1574-6476-45fc-93e9-8636bc869be8	2	Add butter and sauté %thermomix%.	Agrega la mantequilla y sofríe %thermomix%.	180	120	Main	Principal	2025-03-26 19:33:51.846224+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
47b3a1bc-63ea-4b54-83e0-083c73834163	eaaa1574-6476-45fc-93e9-8636bc869be8	3	Add potato and broccoli then chop %thermomix%. Scrape down sides of mixing bowl with spatula.	Añade la papa y el brócoli, luego pica %thermomix%. Baja los restos con la espátula.	10	\N	Main	Principal	2025-03-26 19:33:51.846224+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	6	\N	\N
9c0ae9a3-76ac-4822-ab82-d519e5c44249	eaaa1574-6476-45fc-93e9-8636bc869be8	4	Add water, salt then cook %thermomix%. 	Agrega el agua, la sal, y cocina %thermomix%.	1800	100	Main	Principal	2025-03-26 19:33:51.846224+00	2025-04-08 20:56:43.748954+00	C	\N	\N	\N	1	\N	\N
c31be125-8502-4180-85da-201164f7d427	6a160e6c-306b-4c2e-b913-3898aaa8e920	2	Place the flour, sugar, butter, egg, and baking powder in the mixing bowl. Mix %thermomix%. (TIP*)	Coloca en el vaso la harina, el azúcar, la mantequilla, el huevo y el polvo para hornear. Mezcla **20 seg. / vel. 6**. (TIP*)	20	\N	\N	\N	2025-02-11 21:48:30.967373+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	6	\N	\N
4948de6e-717b-4008-865b-1cd4e1d3782b	c376bc2c-e1fb-493a-9bcb-5d7746f2410e	3	Place garlic, dill and oil in mixing bowl then chop 3 sec/speed 5.	Añade al bowl el ajo, el eneldo y el aceite en un bol, luego pica 3 seg/vel 5.	3	\N	Main	Principal	2025-04-05 12:57:03.0524+00	2025-04-08 20:56:43.748954+00	\N	\N	\N	\N	5	\N	\N
a85b48c2-9b01-4315-95ff-595bb8537074	e50b81a2-b7e3-4802-b276-2a84cf8946e9	1	Place the onion and oil in the mixing bowl, sauté %thermomix%	Coloca en el vaso la cebolla y el aceite, sofríe %thermomix%	240	120	Main	Principal	2025-04-15 02:00:01.479204+00	2025-04-15 02:00:01.479204+00	C	\N	\N	\N	1	\N	\N
3f06a86b-eea0-429c-9eb7-925c1fea8138	e50b81a2-b7e3-4802-b276-2a84cf8946e9	2	Place the tomato in the mixing bowl and chop %thermomix% Scrape down the sides of the mixing bowl with the spatula.	Coloca en el vaso el jitomate y pica %thermomix% Baja los restos de las paredes del vaso con la espátula.	3	\N	Main	Principal	2025-04-15 02:00:01.479204+00	2025-04-15 02:00:01.479204+00	\N	\N	\N	\N	4	\N	\N
35c1d452-7ed1-40dd-a12b-a35b93824614	e50b81a2-b7e3-4802-b276-2a84cf8946e9	3	Add the boneless, skinless chicken breast in pieces, the chicken bouillon cubes, the chipotle in adobo, and the bay leaves, cook %thermomix%	Añade la pechuga de pollo deshuesada y sin piel, en trozos, los cubos de caldo de pollo, el chile chipotle adobado y las hojas de laurel, cocine %thermomix%	1080	100	Main	Principal	2025-04-15 02:00:01.479204+00	2025-04-15 02:00:01.479204+00	C	\N	\N	\N	1	\N	\N
da8610fb-5cd6-4238-8ea0-93386333fb20	e50b81a2-b7e3-4802-b276-2a84cf8946e9	5	Serve the tinga on tostadas, garnishing with sour cream and panela cheese.	Sirve la tinga sobre tostadas, decorando con crema y queso panela.	10	\N	Main	Principal	2025-04-15 02:00:01.479204+00	2025-04-15 02:00:01.479204+00	\N	\N	\N	\N	1	\N	\N
b71abc71-2d78-4d19-b7df-49d4191bb599	3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	1	Place garlic, cooked chickpeas, water, lemon juice, tahini, salt, and olive oil in the mixing bowl. Blend %thermomix% progressively.	Pon en el vaso los ajos, los garbanzos cocidos, el agua, el zumo de limón, el tahini, la sal y el aceite y tritura %thermomix% progresivamente.	60	\N	Main	Principal	2026-01-12 15:59:26.615125+00	2026-01-12 15:59:26.615125+00	C	🙋🏽‍♀️ tip	🙋🏽‍♀️ tip	\N	\N	5	10
cc6d84c7-317e-4b83-8f1d-79e72bbe5e88	3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	2	Transfer the hummus to a plate, drizzle with extra virgin olive oil, and sprinkle with paprika or cumin.	Vierte el hummus en un plato, rocíe con un chorrito de aceite de oliva virgen extra y espolvorea con pimentón o comino.	\N	\N	Main	Principal	2026-01-12 15:59:26.615125+00	2026-01-12 15:59:26.615125+00	C	\N	\N	\N	\N	\N	\N
\.



COPY "public"."recipe_tags" ("id", "name_en", "name_es", "categories", "updated_at", "created_at") FROM stdin;
3f6bca93-397e-4a51-b744-4d853406943a	avocadooil	aceiteaguacate	{INGREDIENTS,OILS_AND_FATS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
4ad1b2c6-f8d5-4d50-85bb-8cc75931ead0	oliveoil	aceiteoliva	{INGREDIENTS,OILS_AND_FATS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
dd997c47-9235-402d-836f-1526b11229a4	sides	acompañamiento	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c3315a9f-c283-407c-b49a-1d70d17340e3	african	africano	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
fdb7d96a-c1ca-43ec-ab2b-be30c6f7601e	avocado	aguacate	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
195a2edb-6a1f-4dca-8a94-7240d8c336b0	garlic	ajo	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ad76da86-73ea-429c-b987-b2a7e2ffb9e0	garlicpowder	ajoenpolvo	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1a79d1a4-d483-4b8c-9e0d-9c5e1db5bff5	basil	albahaca	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
dee271a1-3cb8-488a-9491-8b6503605498	almonds	almendras	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b03b70d5-6330-453a-885a-ddc70d3eac9c	cornstarch	maicena	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
93aec079-04a6-4a13-9781-771e8f763ebe	kidneybeans	alubias	{INGREDIENTS,LEGUMES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c85bd830-8740-4c54-803c-ec68cb74f340	cashews	nuezdelaindia	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d250922a-3aca-475e-b9cd-9e44e023d175	new year	año nuevo	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b421ec80-3872-4e73-9e69-770d0bfa1ca1	appetizers	antojitos	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
bbbe8ed7-c55d-4c0c-bf51-b9da6322d32a	appetizer	aperitivo	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1a582c81-c6ad-46d9-9cce-edb31f8f5223	pregnancyfriendly	aptoembarazo	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1a220e6b-14fd-4b1c-a359-3fb3d4bb68b1	babyfriendly	aptoparabebe	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ca96917e-2a3b-4976-91c2-a392c37cc284	rice	arroz	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
48d4dcb4-0cec-4d1d-af79-cd4f1dda480e	brownrice	arrozintegral	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d4ae5dcd-9356-4a31-9f0b-a003457ce97e	asian	asiático	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
98cc671b-589a-41ea-ac62-2c62f0adade2	hazelnuts	avellanas	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b6cf83a0-ec81-4a0d-a94f-b5a75cadb84c	oats	avena	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1ab37e04-a7e2-42d7-9ba0-9fdbadff99bc	saffron	azafrán	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
378bcbc3-a4af-419f-8220-121fca51dcd4	sugar	azúcar	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
cecd597e-c678-4748-9eab-2b8589ba3345	darkbrownsugar	azúcarmascabado	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e0c29392-4042-491e-bf64-36e1f5ce2b77	brownsugar	azúcarmorena	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
2763681b-5892-476f-9c4f-7c198e98ebf2	lowcarb	bajocarbohidratos	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
a7190e44-5089-423b-8813-7c680349b2c7	lowfat	bajoengrasas	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3c5a90f9-d4e9-4d5c-b24d-60cbb00175d9	lowsugar	bajosugar	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0ba92f7f-d9a8-4a9c-bcc7-2f7c53cdcd4a	banana	banana	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b7c66a31-a09b-404c-afe8-54dc070c3320	kitchenbasics	básicosdelacocina	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
93ba9fda-e1f6-426b-9ffd-d49f87f06e51	pantrybasics	básicosdelaalacena	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
16ae0e8f-6b77-43e9-979e-ea536c035a45	basics	básicos	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
2df97fe3-24f8-45e4-bf0d-898cad761bb8	drink	bebida	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1d88b0fe-09a0-407c-86d3-61c3b75f57fd	watercress	berros	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
43390fbd-d252-4cc3-bbe8-7c2ce2e79ab8	bakingsoda	bicarbonato de sodio	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6e803305-9870-4ee6-bf8b-7d391dc5f62a	brazilian	brasileño	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7b27c9af-ff23-414e-8e70-1c2d980051b4	broccoli	brócoli	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
a81a3073-45a9-4a11-87d0-efc319e93bc0	peanuts	cacahuates	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6fc0b679-c23e-4e84-914f-0115cf5c5e41	zucchini	calabacitas	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c253de85-5a8c-4080-a816-545efdb36bb4	cinnamon	canela	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
41041ffe-59bb-4df1-96ad-a660fb4a7b23	cantonese	cantonés	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
005f871a-930e-443c-a97d-c4a6bb546a47	carnival	carnaval	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d50361ab-8895-4500-aa7d-d3db0f23773a	meat	carne	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
78f390d9-3db9-46fd-883a-0b537f48d4d6	homemade	casero	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
a9560bf1-c748-4508-b5c7-5ab9594b758e	onion	cebolla	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6cf2be28-4161-4c33-a2b6-f384eb8bbdd4	onionpowder	cebollaenpolvo	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d321c06d-88ee-4ed1-90f0-42cff665b4ab	dinner	cena	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
11b7a1ef-4e38-4a12-9519-a5b7a7070036	pork	cerdo	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d7745b47-2d6a-4485-956c-037089a2350b	mushrooms	champiñones	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
187280ba-1c18-4bf2-a0c4-c03d95896a3e	arbolchili	chiledearbol	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d48d729b-6358-49fe-a5d0-88936b734df7	guajillopepper	chileguajillo	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
9971b8fe-6d7b-4122-b8c2-40d491ec75fd	moritapepper	chilemorita	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
bbce3613-b86f-4e42-9db3-b402c735a34c	chinese	chino	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
daa88d61-2b98-43f4-a64a-bfaa1bc0c79e	cilantro	cilantro	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d6cab71b-be25-421b-8536-ff56aa09c599	cloves	clavo	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
27125c14-c8c5-4f27-bcd3-f68fb39a2ec3	coconut	coco	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c3ff2277-209f-4ec9-b178-4cff51f034e3	colombian	colombiano	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
034ace2c-48d2-4ce8-a40f-5a97c471f2e2	lunch	comida	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7e8272fc-d18f-448b-9b21-69cadcd1e3f0	comfortfood	comidadeconsuelo	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0b232543-8d32-466f-a831-67dab2d616d3	cumin	comino	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
37ad722f-76b4-44f9-81f8-5ffb89aa43d8	containssugar	contieneazúcar	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7807de2f-0dd1-4699-b26a-f28570b30145	containspeanuts	contienecacahuates	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
abf65a2e-5955-497b-b9f6-996f26ca6737	containsdriedfruits	contienefrutossecos	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7f3ec958-7288-49b0-a01d-9857437d92db	containsgluten	contienegluten	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
fa18cdff-de02-4e28-915e-d358a54bde81	containsegg	contienehuevo	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f20749f4-fced-40f9-91b4-c2f8d7abcbf4	containsdairy	contienelácteos	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0093d7ed-601d-41d7-a76f-2126be96115e	containsmilk	contieneleche	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d833d42e-a729-47fd-82f8-d552d34fd227	containshoney	contienemiel	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6f0cd36d-8a49-4467-bdde-4c2dfae0e3b3	containsnuts	contienenueces	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d23dfc18-ed9d-4eee-adcc-f5a2008977e3	containsfish	contienepescado	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3552cdd7-66a7-47df-a1fb-499f20e3c932	containschicken	contienepollo	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
08bfc5e6-bead-433a-9c7d-45ec5075afb6	containstofu	contienetofu	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
8835bca7-6a90-4aa9-b999-7db88e9f0017	cream	crema	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6784af0c-62b7-443a-b05b-2908eb49cd2f	couscous	cuscús	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f5bc3a3e-f1a8-4364-b2ea-a19a370a1169	delicious	deliciosa	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
78f179ea-e8f8-4f19-9953-f983f9b8866b	breakfast	desayuno	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d10e6423-ccba-45a7-a713-afd6ef12deb1	fathersday	día del padre	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5a28fc52-6678-4b5e-a742-fee8c4cfa531	independenceday	díadelaindependencia	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e15fa04d-e0a3-46c1-86be-96368fb630e2	mothersday	díadelasmadres	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
29d95f0b-02a3-4109-afa2-6ca86f40341b	labourday	díadeltrabajo	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
80e79387-767b-4e96-8c0f-c149e752dda5	dayofthedead	díademuertos	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d6f22ccd-082b-493d-8b8b-48d1ffe60dca	dip	dip	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ade7bc71-b1d5-459a-94ba-48595b974bf1	peach	durazno	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3765266c-7314-4d50-8014-950fb3fc48e0	budgetfriendly	económico	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5eba7d9b-5ec4-4c78-ac5c-ecd90dcc0ba3	salad	ensalada	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
90e32502-c7bd-4356-adf0-31f54ff807f8	starter	entrada	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ec99f7e7-17d3-40e1-87ad-f8077da92357	asparagus	espárragos	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e06d6f2e-b489-49fb-b7a7-7e2fa7407cca	spinach	espinacas	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
82ca6484-947b-4a70-b874-9d6326d6afa4	european	europeo	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ef40d004-a7f9-4298-a31c-ca1e22bc12c5	easy	fácil	{GENERAL,CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f391601f-0074-44ab-ab11-e5c5ca45d7eb	family	familia	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b69fc3a4-a201-44b1-9def-22805f60155e	familiar	familiar	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0109ae93-4553-4af4-a0a7-c6609e7fba0c	patrioticholidays	fiestaspatrias	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
373c482d-0830-44ca-a8a1-19a5c8df8021	strawberries	fresas	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1ded3714-38a2-451a-82b4-b90eaf1a6e83	fresh	fresca	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
58b5074c-eef4-406a-809f-6aa77f9141dc	beans	frijoles	{INGREDIENTS,LEGUMES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b7f4a76a-d3b8-4fdc-876d-e0320653d19b	cookies	galletas	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
26af0192-847a-4cfe-8069-0000e742fe66	chickpeas	garbanzos	{INGREDIENTS,LEGUMES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f947e2fb-5b34-4581-b37e-b19ccc5577bc	greek	griego	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
14178c9d-2594-486e-86e1-1d546a466685	peas	chícharos	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
dc04b074-d6e6-42e8-a987-e1a928a6521f	broadbeans	habas	{INGREDIENTS,LEGUMES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7c96655b-24d2-4c2b-aeec-361bb39eb35a	halloween	halloween	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
010c6eb9-86b5-4877-87a4-a2769d483743	flour	harina	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
61d8e9bb-d7fb-498a-bdce-3ebf4827bb7f	cornmeal	harinademaíz	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b88371a0-a9da-4790-b777-90ce1ec0f320	ice	hielos	{INGREDIENTS,LIQUID}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
a0493025-9ca9-4a33-92d7-4968b3921047	oven	horno	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c960d2a5-5e2d-4355-8754-8068824ce6ef	eggs	huevos	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
de40edda-5d32-4eb8-9575-e1b466772aca	indian	indio	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ea3d5b13-2644-4fdc-a6fa-690ab702e48d	italian	italiano	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ef9e16d9-1b8c-4562-840b-839c88cf0fbc	ham	jamón	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
af061fe1-2d39-4268-8614-966d3d606ad0	japanese	japonés	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
72d8925b-d4a7-4d37-b5dd-f390d2a649cc	syrup	jarabe	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6d2239bc-00d4-453f-85ae-1dfc8ebc5f5c	agavesyrup	jarabeagave	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3aa2b317-f9ab-4bf5-8893-3f7f92e4c46e	ginger	jengibre	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c8d88609-e93e-4d93-8bf7-1f605d7c986b	greenbeans	judías	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
eac1e477-6b52-48df-a009-75c54628985e	juice	jugo	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d6fcb4f7-37f4-41dc-b105-a6eacc434165	keto	keto	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
158df003-f8ea-47cc-9604-7477a668034d	kiwi	kiwi	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
906da1f8-f613-4ceb-9c87-f06251852c63	latinamerican	latinoamericano	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5fefe6d4-f48a-4cf7-bd8c-7584f5bacde3	bayleaf	laurel	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
90439c79-bdd5-4713-b139-984aa955895a	milk	leche	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
872e205b-bda9-4475-9d62-011210f29d74	almondmilk	lechealmendras	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e212dc25-b3ef-4f28-93dc-b030a639155e	oatmilk	lecheavena	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
354495c8-bd13-4e71-a4e4-b8deee39699a	coconutmilk	lechecoco	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6fdc862a-c8d8-460e-a88d-73325c73af66	sweetenedcondensedmilk	lechecondensada	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
98c75b26-2ad7-410c-bd93-8ecd520f21b9	lettuce	lechuga	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
534a92e1-7feb-40a2-9242-8bbe845903f6	lentils	lentejas	{INGREDIENTS,LEGUMES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0a474bb0-8366-4d19-b34c-934d8da7c647	lebanese	libanés	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5e0d33e7-cce2-44f8-afe7-fbb712c0f38f	light	ligero	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0f5c8807-153e-40df-858d-f0629c9024d3	lemon	limón	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d85f0a4c-82d1-455e-9c21-14d7164163d5	corn	maíz	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
decb1253-39c7-4652-b456-e0d9d413e6d9	mango	mango	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
13dc9773-3503-4333-9b79-6ca7faa67d7e	lard	manteca	{INGREDIENTS,OILS_AND_FATS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
51a3986e-4520-421e-b6b1-81a1b2982a29	shortening	mantecavegetal	{INGREDIENTS,OILS_AND_FATS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f211cd2b-f7af-4626-8e33-dd3ebcfe5831	crisco	grasavegetal	{INGREDIENTS,OILS_AND_FATS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
20478573-0cb6-4aef-87ad-ef3ecb4408c3	butter	mantequilla	{INGREDIENTS,OILS_AND_FATS,DAIRY_AND_ALTERNATIVES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f8c274b5-2b7a-47fa-9224-d199c0125823	apple	manzana	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
8b01d3a3-2d9e-421a-95c0-fc97a438277c	margarine	margarina	{INGREDIENTS,OILS_AND_FATS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0a356b53-5169-401c-94db-8aad216129be	seafood	mariscos	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
18d807a0-0f0d-42c4-864a-c441f384444d	mediterranean	mediterráneo	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5737d381-9188-494e-8d44-a93fd29b6ea8	molasses	melaza	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b83c9d82-a489-40d7-8e6a-bc9a914636c0	mint	menta	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6f6deea2-2252-4967-810c-735faa55c84b	snack	merienda	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5a6d3ba4-9d87-4473-9c2a-104d50060aa8	mexican	mexicano	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5a7f8733-1f93-44ea-993f-6a2bfab62a38	honey	miel	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
a760bc27-8e2d-4ace-a0c4-1e640e3f8454	orange	naranja	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3b6e8bcf-e416-445d-80f3-9ea784beaaf5	christmas	navidad	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
cb9f5d4d-5b25-45af-823e-3d0b2122a9fb	christmaseve	nochebuena	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7b507ac9-67e7-4bb3-b8f0-be12408172fd	nuts	nuez	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7bb2a1d7-a9d4-4788-a497-6bce4a8af4da	macadamianuts	nuecesdemacadamia	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3af67874-af70-49a2-90ef-9f72bd4cb0a5	walnuts	nuecesdenogal	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
836055f8-1bcc-421c-9f41-5d5b34c5582a	pecans	nuecespecanas	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
8ad0fe30-ea08-423d-85b9-61c36fd82a53	veganoption	opciónvegana	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
248fde98-aba9-4748-8c16-058d37e34523	oregano	oregano	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1dd2a335-341c-48c8-90a2-3d79d51f4617	oriental	oriental	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
bcd92531-2387-41d3-aa82-e389f4ee8156	paleo	paleo	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
54101442-7310-48ae-a8aa-8040db8ddc29	bread	pan	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
6a6eec3f-6887-4145-b011-f94cd357c3c2	bakery	panadería	{GENERAL,CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0f4119ae-01ba-4f74-a3e9-2be6ae6aae68	easter	pascua	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e43f8b77-44df-4214-8c5d-8ea668d5132f	pasta	pasta	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
09aa195f-2eaf-4a9d-b91b-e7b3f5a41f61	potatoes	patatas	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
67bb2dee-6638-4220-ae7b-587bc47a2d23	turkey	pavo	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
50922e38-37ed-4ec7-94f7-7847d19124fc	cucumber	pepino	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
1408e147-9c36-4733-b9cb-7f9b7c55041c	pears	peras	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
550d333e-0ed9-4086-81a9-371c903a21dd	fish	pescado	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
aa97f4ca-5fac-4296-bcdc-d6525b3eb56c	spicy	picante	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
905167f4-ae35-4099-894d-69bf58325369	paprika	pimentón	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b688ca0b-be4d-4dc1-a73c-a9c995ec3f08	blackpepper	pimienta	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
4604cf49-bc48-4f1d-b087-ac76029af7bb	peppers	pimientos	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7e27a98c-68c0-4854-ad2f-7232bc46a666	pineapple	piña	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
367efc81-0aed-4c26-bfdb-657885a9948a	pistachios	pistaches	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
19b84341-e407-499f-9393-f19f418be1df	chicken	pollo	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
8741c947-c3e1-4f37-a7e5-eed7ca052e06	bakingpowder	polvoparahornear	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f32dee2e-a078-496f-bd40-e119a334e202	dessert	postre	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
749beb53-a691-4e34-9eef-567cfd2cae9a	cheese	queso	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
2d65fd73-4aac-4764-9c99-bc0285698aec	lactose-freecheese	quesosinlactosa	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0e78fd38-9082-46db-81c5-7fbf41100a18	quinoa	quinoa	{GRAINS_AND_STARCHES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
2558002c-28dc-4865-adab-42bd0feb9bd1	quick	rápido	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
a3feb23d-b502-4194-8808-4d57f0cdf7cd	refreshing	refrescante	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
d4b06448-7cc0-4706-8ffc-2f02f59a9795	pastry	repostería	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f508e552-96a6-4d49-be9e-811197f22a6a	beef	res	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5fe53c15-3c24-41d1-89f2-4dc9df45eff0	rosemary	romero	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
49c241e3-f06c-4a4a-a78b-307e4a0a7215	salt	sal	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e1aac72a-9186-43cf-b5d0-8efb26159040	healthy	saludable	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f6f3e9a4-9e55-4d0a-8acf-d589bc407ee5	watermelon	sandía	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3f62f6f5-7cdd-4483-8a3a-fbb1436d3142	holyweek	semanasanta	{GENERAL,HOLIDAY}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
4bf36028-7acc-496a-87d4-51cc46363e58	corianderseeds	semillascilantro	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
2961d66e-ee90-4f3c-bb34-7336675d8154	chiaseeds	semillasdechía	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
060eb25a-f8f3-4182-9f09-4f312fd33912	sunflowerseeds	semillasdegirasol	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
08de9dc4-2224-4e3c-940a-9eb4300107ca	sesameseeds	semillasdesesamo	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
5d1b3810-9b84-4ea3-ac31-6d02e5fcdfaf	sesame	ajonjolí	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
ef3d5ad2-9a1c-4a1b-a77b-23351c0c5755	pumpkinseeds	pepitas	{INGREDIENTS,NUTS_AND_SEEDS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
582b3231-045a-4ea8-adf8-b250f6025844	sugarfree	sinazúcar	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
9cf7fcf2-6e51-423f-aa70-aee67a0fd57e	nutfree	sinfrutossecos	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c10e63fe-f55d-4d93-840a-29a4c61794fc	glutenfree	singluten	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
305c17b1-abaf-42fc-b3d3-d8707d2ad6a6	lactosefree	sinlácteos	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c460de9f-3fd5-44e7-bfa3-52bab454484d	dairyfree	sinmantequilla	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f75c5c15-cf44-47ed-a489-fcab42b6dafc	honeyfree	sinmiel	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
16034f6d-50c5-4e86-b53e-3515c20642ec	soyfree	sinsoya	{DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
73b78291-8ae7-48b6-8b5e-99c0c23ed7fc	soybeans	soja	{INGREDIENTS,LEGUMES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
7eebd622-060c-49b4-9abc-071d1009d0f6	stevia	stevia	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e97df3b5-46a8-44bc-93a2-eeb3e2bc50da	smooth	suave	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
77c1c986-da87-4557-9a7d-5c9ca09ac971	thai	tailandés	{CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
3f2d5b54-4804-4a8f-bf26-8c3845d3efb2	tempeh	tempeh	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
12abbce6-d4eb-4471-b8d8-3b2bf4baa5e7	Thermomix®	Thermomix®	{GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
36e19949-a665-453c-b9b4-c747fa1976b9	tofu	tofu	{INGREDIENTS,PROTEINS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
4ea88eaf-3b40-4df3-8a9b-8c73538b44f0	tomato	tomate	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
f20f35c8-3179-4298-8470-ae9b737b5904	thyme	tomillo	{HERBS_AND_SPICES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
0654df07-6e09-42b3-b7ae-c3fd9e1b847f	traditional	tradicional	{GENERAL,CULTURAL_CUISINE}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e0cab3ad-a7c8-4798-94c1-15cc360a1f36	grapes	uvas	{FRUITS,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
118c7341-27cf-49be-9c9b-e12d0c954f19	vegan	vegano	{CULTURAL_CUISINE,DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
a0ccac4e-7409-4f93-b26c-27437fbba1ce	vegetarian	vegetariano	{CULTURAL_CUISINE,DIETARY_RESTRICTIONS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
e0bb22d3-07da-4cfb-aacd-1d49f5555325	vinegar	vinagre	{INGREDIENTS,LIQUID}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
19fed8ac-0e95-45b5-8cc9-fff54ed10580	agua	water	{INGREDIENTS,LIQUID}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
b4fd9a98-5c85-4a93-bdbc-d1a63be1d81d	vino	wine	{INGREDIENTS,LIQUID}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
aaa93b7c-2ab7-4af6-82ba-d12d8a8641d7	yogurt	yogur	{DAIRY_AND_ALTERNATIVES,INGREDIENTS}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
4fe99d4d-71ec-4915-874b-a49c6f3c8ca1	carrots	zanahorias	{INGREDIENTS,VEGETABLES}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
c714fd3f-f04c-487e-999f-00a36dd66033	soup	sopa	{LIQUID,GENERAL}	2025-03-26 19:08:26.502531+00	2025-03-26 19:08:37.619755+00
baafcdd8-8edb-49c3-949b-c5318f2aa4bf	egg	huevo	{DIETARY_RESTRICTIONS,INGREDIENTS}	2025-04-15 16:25:13.372465+00	2025-04-15 16:25:13.372465+00
bc279d5e-604d-4007-96aa-2d0d4b1b1b50	testing	testsetstes	{GRAINS_AND_STARCHES,DAIRY_AND_ALTERNATIVES,HOLIDAY,PROTEINS,SWEETENERS_AND_BAKING}	2025-03-26 19:17:32.566531+00	2025-03-26 19:08:37.619755+00
e9497678-3587-468d-8844-23e0b4076c9f	salty	salado	{GENERAL}	2025-03-26 19:31:34.566317+00	2025-03-26 19:31:34.566317+00
be51bff5-d252-4e61-b2a5-7050df5b3374	sweet	dulce	{SWEETENERS_AND_BAKING}	2025-03-30 07:03:32.603795+00	2025-03-30 07:03:32.603795+00
ee09aa60-fd9d-44da-8bb3-e60542c97225	raisins	pasitas	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-04-02 17:58:14.175966+00	2025-04-02 17:58:14.175966+00
e90060fe-cb1c-4a75-9a5c-8eab5f42e9a6	nut free	sinnueces	{DIETARY_RESTRICTIONS}	2025-04-05 11:59:50.583313+00	2025-04-05 11:59:50.583313+00
a9191e68-0f04-43f7-9a3d-87877961fa27	chocolate	chocolate	{INGREDIENTS,SWEETENERS_AND_BAKING}	2025-04-05 13:35:34.172544+00	2025-04-05 13:35:34.172544+00
02bc6733-309b-41e3-a204-d8b18d1824e4	oil	aceite	{INGREDIENTS,OILS_AND_FATS}	2025-04-15 15:56:24.335377+00	2025-03-26 19:08:37.619755+00
65467320-5bd6-42e9-9ac2-ca51dd7f266f	thanksgiving	accióndegracias	{GENERAL,HOLIDAY,CULTURAL_CUISINE}	2025-04-15 15:57:15.160453+00	2025-03-26 19:08:37.619755+00
14de98ac-0121-4fd9-b30d-1792e27a7df2	thermomix	thermomix	{GENERAL}	2025-04-15 17:51:45.068757+00	2025-04-15 17:51:45.068757+00
45ddd337-a042-495b-87e1-466d5c421a7d	varoma	varoma	{GENERAL}	2025-04-15 17:52:02.654596+00	2025-04-15 17:52:02.654596+00
\.



COPY "public"."recipe_to_tag" ("recipe_id", "tag_id", "created_at", "updated_at") FROM stdin;
8ef6695c-852b-4471-98e8-71ad417e7185	dd997c47-9235-402d-836f-1526b11229a4	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	195a2edb-6a1f-4dca-8a94-7240d8c336b0	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	ca96917e-2a3b-4976-91c2-a392c37cc284	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	78f390d9-3db9-46fd-883a-0b537f48d4d6	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	a9560bf1-c748-4508-b5c7-5ab9594b758e	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	daa88d61-2b98-43f4-a64a-bfaa1bc0c79e	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	3765266c-7314-4d50-8014-950fb3fc48e0	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	90e32502-c7bd-4356-adf0-31f54ff807f8	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	5a6d3ba4-9d87-4473-9c2a-104d50060aa8	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	2558002c-28dc-4865-adab-42bd0feb9bd1	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	305c17b1-abaf-42fc-b3d3-d8707d2ad6a6	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
eaaa1574-6476-45fc-93e9-8636bc869be8	7b27c9af-ff23-414e-8e70-1c2d980051b4	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
eaaa1574-6476-45fc-93e9-8636bc869be8	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
eaaa1574-6476-45fc-93e9-8636bc869be8	c10e63fe-f55d-4d93-840a-29a4c61794fc	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
eaaa1574-6476-45fc-93e9-8636bc869be8	9cf7fcf2-6e51-423f-aa70-aee67a0fd57e	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
eaaa1574-6476-45fc-93e9-8636bc869be8	8ad0fe30-ea08-423d-85b9-61c36fd82a53	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
eaaa1574-6476-45fc-93e9-8636bc869be8	a0ccac4e-7409-4f93-b26c-27437fbba1ce	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
eaaa1574-6476-45fc-93e9-8636bc869be8	e9497678-3587-468d-8844-23e0b4076c9f	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
eaaa1574-6476-45fc-93e9-8636bc869be8	c714fd3f-f04c-487e-999f-00a36dd66033	2025-03-26 19:33:51.572676+00	2025-03-26 19:33:51.572676+00
3239cc54-4e79-4902-b8f7-d3716167bea4	187280ba-1c18-4bf2-a0c4-c03d95896a3e	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	d48d729b-6358-49fe-a5d0-88936b734df7	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
8ef6695c-852b-4471-98e8-71ad417e7185	9cf7fcf2-6e51-423f-aa70-aee67a0fd57e	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
3239cc54-4e79-4902-b8f7-d3716167bea4	9971b8fe-6d7b-4122-b8c2-40d491ec75fd	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	195a2edb-6a1f-4dca-8a94-7240d8c336b0	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	4ad1b2c6-f8d5-4d50-85bb-8cc75931ead0	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	20478573-0cb6-4aef-87ad-ef3ecb4408c3	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	7807de2f-0dd1-4699-b26a-f28570b30145	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	abf65a2e-5955-497b-b9f6-996f26ca6737	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	f20749f4-fced-40f9-91b4-c2f8d7abcbf4	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	6f0cd36d-8a49-4467-bdde-4c2dfae0e3b3	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
3239cc54-4e79-4902-b8f7-d3716167bea4	aa97f4ca-5fac-4296-bcdc-d6525b3eb56c	2025-03-29 00:56:51.932985+00	2025-03-29 00:56:51.932985+00
8ef6695c-852b-4471-98e8-71ad417e7185	16034f6d-50c5-4e86-b53e-3515c20642ec	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	e97df3b5-46a8-44bc-93a2-eeb3e2bc50da	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	12abbce6-d4eb-4471-b8d8-3b2bf4baa5e7	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	0654df07-6e09-42b3-b7ae-c3fd9e1b847f	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
8ef6695c-852b-4471-98e8-71ad417e7185	a0ccac4e-7409-4f93-b26c-27437fbba1ce	2025-04-02 16:52:09.551365+00	2025-04-02 16:52:09.551365+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	bbbe8ed7-c55d-4c0c-bf51-b9da6322d32a	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	d6f22ccd-082b-493d-8b8b-48d1ffe60dca	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	c10e63fe-f55d-4d93-840a-29a4c61794fc	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	f947e2fb-5b34-4581-b37e-b19ccc5577bc	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	9cf7fcf2-6e51-423f-aa70-aee67a0fd57e	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	5eba7d9b-5ec4-4c78-ac5c-ecd90dcc0ba3	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	e90060fe-cb1c-4a75-9a5c-8eab5f42e9a6	2025-04-05 12:57:02.913173+00	2025-04-05 12:57:02.913173+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	6f0cd36d-8a49-4467-bdde-4c2dfae0e3b3	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	a0493025-9ca9-4a33-92d7-4968b3921047	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	a9191e68-0f04-43f7-9a3d-87877961fa27	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	b6cf83a0-ec81-4a0d-a94f-b5a75cadb84c	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	b7f4a76a-d3b8-4fdc-876d-e0320653d19b	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	be51bff5-d252-4e61-b2a5-7050df5b3374	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	f20749f4-fced-40f9-91b4-c2f8d7abcbf4	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	f32dee2e-a078-496f-bd40-e119a334e202	2025-04-15 15:33:18.925543+00	2025-04-15 15:33:18.925543+00
10cadced-e31b-4846-a7ac-b20742068137	6f0cd36d-8a49-4467-bdde-4c2dfae0e3b3	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	a0493025-9ca9-4a33-92d7-4968b3921047	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	b6cf83a0-ec81-4a0d-a94f-b5a75cadb84c	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	b7f4a76a-d3b8-4fdc-876d-e0320653d19b	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	be51bff5-d252-4e61-b2a5-7050df5b3374	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	ee09aa60-fd9d-44da-8bb3-e60542c97225	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	f20749f4-fced-40f9-91b4-c2f8d7abcbf4	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
10cadced-e31b-4846-a7ac-b20742068137	f32dee2e-a078-496f-bd40-e119a334e202	2025-04-15 15:33:53.681814+00	2025-04-15 15:33:53.681814+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	f508e552-96a6-4d49-be9e-811197f22a6a	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	baafcdd8-8edb-49c3-949b-c5318f2aa4bf	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	c460de9f-3fd5-44e7-bfa3-52bab454484d	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	d50361ab-8895-4500-aa7d-d3db0f23773a	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	fa18cdff-de02-4e28-915e-d358a54bde81	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	14de98ac-0121-4fd9-b30d-1792e27a7df2	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	12abbce6-d4eb-4471-b8d8-3b2bf4baa5e7	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	45ddd337-a042-495b-87e1-466d5c421a7d	2025-04-15 18:18:10.293256+00	2025-04-15 18:18:10.293256+00
411d8e8c-069c-43a6-af16-98b140dd53e0	be51bff5-d252-4e61-b2a5-7050df5b3374	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	b7f4a76a-d3b8-4fdc-876d-e0320653d19b	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	010c6eb9-86b5-4877-87a4-a2769d483743	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	a0493025-9ca9-4a33-92d7-4968b3921047	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	20478573-0cb6-4aef-87ad-ef3ecb4408c3	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	f32dee2e-a078-496f-bd40-e119a334e202	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	fa18cdff-de02-4e28-915e-d358a54bde81	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	baafcdd8-8edb-49c3-949b-c5318f2aa4bf	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
411d8e8c-069c-43a6-af16-98b140dd53e0	c960d2a5-5e2d-4355-8754-8068824ce6ef	2025-04-15 18:21:11.398934+00	2025-04-15 18:21:11.398934+00
9efe6751-3081-426d-836c-1a650cc5c24e	12abbce6-d4eb-4471-b8d8-3b2bf4baa5e7	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	16034f6d-50c5-4e86-b53e-3515c20642ec	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	16ae0e8f-6b77-43e9-979e-ea536c035a45	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	78f390d9-3db9-46fd-883a-0b537f48d4d6	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	9cf7fcf2-6e51-423f-aa70-aee67a0fd57e	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	a0ccac4e-7409-4f93-b26c-27437fbba1ce	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	c460de9f-3fd5-44e7-bfa3-52bab454484d	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	ca96917e-2a3b-4976-91c2-a392c37cc284	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
3239cc54-4e79-4902-b8f7-d3716167bea4	7b507ac9-67e7-4bb3-b8f0-be12408172fd	2025-03-29 00:56:51.932985+00	2026-02-03 00:39:32.561773+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	7b507ac9-67e7-4bb3-b8f0-be12408172fd	2025-04-15 15:33:18.925543+00	2026-02-03 00:39:32.561773+00
10cadced-e31b-4846-a7ac-b20742068137	7b507ac9-67e7-4bb3-b8f0-be12408172fd	2025-04-15 15:33:53.681814+00	2026-02-03 00:39:32.561773+00
8ef6695c-852b-4471-98e8-71ad417e7185	4ea88eaf-3b40-4df3-8a9b-8c73538b44f0	2025-04-02 16:52:09.551365+00	2026-02-03 00:39:32.561773+00
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	fa18cdff-de02-4e28-915e-d358a54bde81	2025-04-15 15:33:18.925543+00	2026-02-03 00:39:32.561773+00
10cadced-e31b-4846-a7ac-b20742068137	fa18cdff-de02-4e28-915e-d358a54bde81	2025-04-15 15:33:53.681814+00	2026-02-03 00:39:32.561773+00
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	e9497678-3587-468d-8844-23e0b4076c9f	2025-04-05 12:57:02.913173+00	2026-02-03 00:39:32.561773+00
9efe6751-3081-426d-836c-1a650cc5c24e	dd997c47-9235-402d-836f-1526b11229a4	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
9efe6751-3081-426d-836c-1a650cc5c24e	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2025-05-01 16:07:36.623055+00	2025-05-01 16:07:36.623055+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	118c7341-27cf-49be-9c9b-e12d0c954f19	2026-01-12 15:59:26.481361+00	2026-01-12 15:59:26.481361+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	26af0192-847a-4cfe-8069-0000e742fe66	2026-01-12 15:59:26.481361+00	2026-01-12 15:59:26.481361+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	bbbe8ed7-c55d-4c0c-bf51-b9da6322d32a	2026-01-12 15:59:26.481361+00	2026-01-12 15:59:26.481361+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	c10e63fe-f55d-4d93-840a-29a4c61794fc	2026-01-12 15:59:26.481361+00	2026-01-12 15:59:26.481361+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	c460de9f-3fd5-44e7-bfa3-52bab454484d	2026-01-12 15:59:26.481361+00	2026-01-12 15:59:26.481361+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	d6f22ccd-082b-493d-8b8b-48d1ffe60dca	2026-01-12 15:59:26.481361+00	2026-01-12 15:59:26.481361+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	ef40d004-a7f9-4298-a31c-ca1e22bc12c5	2026-01-12 15:59:26.481361+00	2026-01-12 15:59:26.481361+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	18d807a0-0f0d-42c4-864a-c441f384444d	2026-01-12 15:59:26.481361+00	2026-02-03 00:39:32.561773+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	e9497678-3587-468d-8844-23e0b4076c9f	2026-01-12 15:59:26.481361+00	2026-02-03 00:39:32.561773+00
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	e90060fe-cb1c-4a75-9a5c-8eab5f42e9a6	2026-01-12 15:59:26.481361+00	2026-02-03 00:39:32.561773+00
\.



COPY "public"."recipe_useful_items" ("id", "recipe_id", "useful_item_id", "display_order", "created_at", "updated_at", "notes_en", "notes_es") FROM stdin;
75ac2737-0771-4233-b27c-f736994e09c6	10cadced-e31b-4846-a7ac-b20742068137	b854e4bb-43e0-4f67-810d-bff7a8e342d4	1	2025-04-15 15:33:54.227531+00	2026-02-03 00:39:32.353131+00	\N	\N
5c72d6f9-1f14-4171-ae29-fa3e68284f28	10cadced-e31b-4846-a7ac-b20742068137	247a0421-7020-49ca-a875-25c4cf38d476	2	2025-04-15 15:33:54.227531+00	2026-02-03 00:39:32.353131+00	\N	\N
bebae8e6-1810-413c-933e-1c4c3f53e4a9	10cadced-e31b-4846-a7ac-b20742068137	fc21e27e-bed0-4726-92a3-ac33ae97ea2c	3	2025-04-15 15:33:54.227531+00	2026-02-03 00:39:32.353131+00	\N	\N
6f9d7f84-afd0-4595-9499-8054584ff627	10cadced-e31b-4846-a7ac-b20742068137	9d4592b2-97e6-47ba-8cc8-952783808265	4	2025-04-15 15:33:54.227531+00	2026-02-03 00:39:32.353131+00	\N	\N
967e2334-663d-4bcb-92d1-21655b793a0a	10cadced-e31b-4846-a7ac-b20742068137	d9881fa7-3fa5-4bdf-b0d3-574bad4cacfc	5	2025-04-15 15:33:54.227531+00	2026-02-03 00:39:32.353131+00	\N	\N
c2059464-8299-4b04-b15b-93eb724783a4	10cadced-e31b-4846-a7ac-b20742068137	a732ed2d-0fc8-409e-8b03-d58b00a0ce9b	6	2025-04-15 15:33:54.227531+00	2026-02-03 00:39:32.353131+00	\N	\N
acb5ea8d-efee-4caa-8a42-19e1cdae92e8	3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	896a071d-01fd-4b3b-a1d5-cf1c4a6d4813	1	2026-01-12 15:59:26.836912+00	2026-02-03 00:39:32.353131+00	\N	\N
05bea7ac-b785-4e9d-8e3f-97866170dc8a	3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	450cbc67-5b48-49b1-86c1-358717b01c65	3	2026-01-12 15:59:26.836912+00	2026-02-03 00:39:32.353131+00	\N	\N
69e09e88-5100-4e65-b2b1-f87b25e1d24a	3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	9d4592b2-97e6-47ba-8cc8-952783808265	4	2026-01-12 15:59:26.836912+00	2026-02-03 00:39:32.353131+00	\N	\N
06d5fcd2-ece2-4239-9ae4-7bc4dfbbc765	3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	a9dbf032-04fa-4114-aa4b-834b282d7545	5	2026-01-12 15:59:26.836912+00	2026-02-03 00:39:32.353131+00	\N	\N
cc348bfd-265d-4c72-87ac-ad4289d529e3	411d8e8c-069c-43a6-af16-98b140dd53e0	896a071d-01fd-4b3b-a1d5-cf1c4a6d4813	1	2025-04-15 18:21:11.924072+00	2026-02-03 00:39:32.353131+00	\N	\N
10e9f25d-d17c-485b-93fa-d8092dbf21f9	411d8e8c-069c-43a6-af16-98b140dd53e0	9d4592b2-97e6-47ba-8cc8-952783808265	2	2025-04-15 18:21:11.924072+00	2026-02-03 00:39:32.353131+00	\N	\N
78bfb496-48a4-420b-b20a-f1539be6ec32	411d8e8c-069c-43a6-af16-98b140dd53e0	d9881fa7-3fa5-4bdf-b0d3-574bad4cacfc	3	2025-04-15 18:21:11.924072+00	2026-02-03 00:39:32.353131+00	\N	\N
2d3a8c8c-e30a-4389-9c4d-0e5297c82b6a	411d8e8c-069c-43a6-af16-98b140dd53e0	b854e4bb-43e0-4f67-810d-bff7a8e342d4	4	2025-04-15 18:21:11.924072+00	2026-02-03 00:39:32.353131+00	\N	\N
77f02aca-3ff1-4367-8996-1da0495a3728	411d8e8c-069c-43a6-af16-98b140dd53e0	a732ed2d-0fc8-409e-8b03-d58b00a0ce9b	5	2025-04-15 18:21:11.924072+00	2026-02-03 00:39:32.353131+00	\N	\N
67e2c578-b2ae-4d11-8581-74058a48d301	411d8e8c-069c-43a6-af16-98b140dd53e0	247a0421-7020-49ca-a875-25c4cf38d476	6	2025-04-15 18:21:11.924072+00	2026-02-03 00:39:32.353131+00	\N	\N
01cfea50-0027-4a02-b399-f864e54ba355	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	fc21e27e-bed0-4726-92a3-ac33ae97ea2c	1	2025-04-15 18:18:10.899777+00	2026-02-03 00:39:32.353131+00	\N	\N
cb8cee9e-1eb0-4f73-854d-30a84c6c1264	761c0c0a-b2a3-4f42-a1fe-da72190fccb0	896a071d-01fd-4b3b-a1d5-cf1c4a6d4813	2	2025-04-15 18:18:10.899777+00	2026-02-03 00:39:32.353131+00	\N	\N
c7f3db21-6517-4d88-a590-f246bc4c8cab	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	b854e4bb-43e0-4f67-810d-bff7a8e342d4	1	2025-04-15 15:33:19.503183+00	2026-02-03 00:39:32.353131+00	\N	\N
690fca65-f6a1-46ef-82f1-305cb7705f09	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	fc21e27e-bed0-4726-92a3-ac33ae97ea2c	2	2025-04-15 15:33:19.503183+00	2026-02-03 00:39:32.353131+00	\N	\N
9ff6b364-4c08-4cd7-bf2a-febb5e26de96	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	d9881fa7-3fa5-4bdf-b0d3-574bad4cacfc	3	2025-04-15 15:33:19.503183+00	2026-02-03 00:39:32.353131+00	\N	\N
596ddc8e-7ad2-45b0-8aae-f8944977debe	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	9d4592b2-97e6-47ba-8cc8-952783808265	4	2025-04-15 15:33:19.503183+00	2026-02-03 00:39:32.353131+00	\N	\N
734ac1ca-0fa6-4fff-b9b3-d33ddc3de5af	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	fec070d5-50ae-433a-a383-cf7200b001b0	5	2025-04-15 15:33:19.503183+00	2026-02-03 00:39:32.353131+00	\N	\N
bf92a3ee-8558-4649-bc89-a33421573f85	ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	a732ed2d-0fc8-409e-8b03-d58b00a0ce9b	6	2025-04-15 15:33:19.503183+00	2026-02-03 00:39:32.353131+00	\N	\N
27b09e86-3e60-40cc-8eaa-7ace384b8604	3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	91e5fdc1-d126-4bff-ae08-17880462a52e	2	2026-01-12 15:59:26.836912+00	2026-02-03 00:39:32.561773+00	\N	\N
\.



COPY "public"."recipes" ("id", "image_url", "prep_time", "total_time", "created_at", "updated_at", "is_published", "name_en", "name_es", "tips_and_tricks_en", "tips_and_tricks_es", "portions", "difficulty", "nutritional_facts") FROM stdin;
ef2cbab8-9585-48a2-8ac1-cd13cfc0fc75	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/galletas_con_chispas_de_chocolate_1743872086776.jpeg	15	90	2025-04-05 16:54:47.439576+00	2025-04-15 15:33:18.540489+00	t	V's Chocolate Chip Cookies	Galletas con Chispas de Chocolate de V	You can chop the walnuts in your Thermomix® by setting **5 sec/speed 5**. You can shape the dough into balls and freeze them to bake later. When you're ready to bake, there’s no need to thaw them, simply preheat the oven to 150°C and place the frozen dough balls directly on a parchment-lined baking sheet, leaving about 2 inches of space between each one. Bake until the edges are golden brown and the center is still soft.	Puedes picar la nueces en tu Thermomix® programando **5 seg/vel 5.** Puedes formar bolitas con la masa y congelarlas para hornearlas después. Cuando quieras hornearlas, no es necesario descongelarlas, simplemente precalienta el horno a 150°C y colócalas directamente sobre una bandeja forrada con papel para hornear, dejando 5 cm de separación entre cada una. Hornea hasta que los bordes estén dorados y el centro aún suave.	24	easy	\N
9efe6751-3081-426d-836c-1a650cc5c24e	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/arroz_al_vapor_1742857692756.jpeg	5	25	2025-03-19 03:43:37.717296+00	2025-05-01 16:07:36.222396+00	t	Steamed Rice	Arroz al Vapor			8	easy	\N
c376bc2c-e1fb-493a-9bcb-5d7746f2410e	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/tzatziki_1743857822031.jpeg	10	20	2025-04-05 12:57:02.605305+00	2025-04-05 12:57:02.605305+00	t	Tzatziki	Tzatziki	Serve tzatziki with pitta bread, grilled meat or baked potatoes.	Sirve el tzatziki con pan pita, carne a la parrilla o papas al horno.	4	easy	\N
eaaa1574-6476-45fc-93e9-8636bc869be8	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/sopa_de_brocoli_1742857711455.jpeg	15	45	2025-03-19 15:27:57.093256+00	2025-03-26 19:33:50.926084+00	t	Broccoli Soup	Sopa de brócoli	- You can replace the butter with oil in order to make your soup vegan\n\n- You can save some broccoli florets to decorate your dish when serving.\n\n- You can make your own vegetable stock paste in with your Thermomix®.\n\n- Serve with croutons, feta cheese or your favourite cheese!	- Puedes reemplazar la mantequilla por aceite para hacer tu sopita vegana\n\n- Puedes reservar algunos floretes de brócoli para decorar el plato al servir.\n\n- Puedes hacer tu propio concentrado de caldo de verduras con tu Thermomix®.\n\n- Acompaña tu sopita con crutones, quesito feta o tu quesito favorito.	4	easy	\N
761c0c0a-b2a3-4f42-a1fe-da72190fccb0	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/albondigas_en_salsa_de_jitomate_1744741089046.jpeg	20	45	2025-04-15 18:18:09.773617+00	2026-01-11 04:38:47.887717+00	f	Meatballs with tomato sauce	Albóndigas en salsa de jitomate	To make your own ground meat, place 400 g of partially frozen beef, cut into chunks (3 cm), in the bowl and chop for 10-13 sec/speed 8. Cutting the meat into even-sized pieces will help achieve a uniform result. You can add 50 g of grated Parmesan cheese in step 2 for extra flavor. You can stuff your meatballs with hard-boiled egg or mozzarella cheese for a delicious variation.	Para hacer tu propia carne molida, coloca 400 g de carne de res parcialmente congelada y cortada en trozos (3 cm) en el vaso y pica 10-13 seg/vel 8. Cortar la carne en trozos de tamaño uniforme ayudará a obtener un resultado homogéneo. Puedes añadir 50 g de queso parmesano rallado en el paso 2.	4	easy	\N
3fbebf1c-0ff1-4a16-a53c-f8a5ff02baa5	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/hummus_1744318149886.jpeg	10	15	2025-04-10 20:49:10.986763+00	2026-01-12 15:59:26.266428+00	t	Hummus	Hummus	You can replace tahini with the same amount of toasted sesame seeds. If you prefer a smoother texture, gradually add more water until you reach your desired consistency.	Puedes reemplazar el tahini por la misma cantidad de ajonjolí tostado. Si quieres una textura más lisa, añade agua poco a poco agua hasta obtener tu consistencia deseada.	1	easy	\N
e50b81a2-b7e3-4802-b276-2a84cf8946e9	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/tinga_de_pollo.jpg?t=2024-11-18T18%3A50%3A38.056Z	10	30	2024-11-10 17:22:37.835926+00	2025-04-15 02:00:01.129134+00	t	Tinga de pollo	Tinga de pollo	Serve with avocado and pickled vegetables.	También puedes acompañar con aguacate y verduras en escabeche.	6	easy	{"fat": "47.6 g", "fiber": "2 g", "sodium": "1802.2 mg", "protein": "68.8 g", "calories": "8 kcal", "carbohydrates": "121.8 g", "saturated_fat": "22.2 g", "nutritional_info": "per 1 serving"}
6a160e6c-306b-4c2e-b913-3898aaa8e920	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/galleta_de_mantequilla.jpg	20	50	2024-11-10 17:22:37.835926+00	2024-11-10 17:22:37.835926+00	t	Butter Cookies	Galletas de mantequilla	In step 2, add other flavors such as vanilla sugar, lemon zest, orange zest, ground cinnamon, or chopped candied fruit.	En el paso 2, añada otros sabores como azúcar de vainila, ralladura de limón, ralladura de naranja, canela molida o fruta confitada picada.	30	easy	{"fat": "3 g", "fiber": "0 g", "protein": "1 g", "calories": "82 kcal", "carbohydrates": "12 g", "nutritional_info": "per 1 piece"}
4e497a1e-4245-4efb-bc3a-0b7a1d116e3e	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/nieve_de_fruta.jpg?t=2024-11-18T18%3A50%3A23.329Z	5	5	2024-11-10 17:22:37.835926+00	2024-11-10 17:22:37.835926+00	t	Fruit Sorbet	Nieve de fruta	For a creamier consistency, add an egg white in step 2.	Para una consistencia más cremosa, añade una clara de huevo en el paso 2.	8	easy	{"fat": "0 g", "fiber": "0.4 g", "sodium": "6.4 mg", "protein": "0.2 g", "calories": "6 kcal", "carbohydrates": "25.6 g", "saturated fat": "0 g", "nutritional_info": "per 1 serving"}
8ef6695c-852b-4471-98e8-71ad417e7185	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/arroz_a_la_mexicana.jpg	20	50	2024-11-10 17:22:37.835926+00	2025-04-02 16:52:09.210038+00	t	Mexican Rice	Arroz a la mexicana	\N		6	easy	{"fat": "5 g", "fiber": "1 g", "protein": "4 g", "calories": "197 kcal", "carbohydrates": "44 g", "nutritional_info": "per 1 serving"}
3239cc54-4e79-4902-b8f7-d3716167bea4	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/mantequilla_macha_1743209810453.jpeg	20	10	2025-03-29 00:56:51.567076+00	2026-01-11 04:38:02.120149+00	t	Macha Butter	Mantequilla Macha			10	easy	\N
d1cad0e8-3295-4da1-ba4a-e2a789c6b9ee	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/sopa_verde.jpg	20	90	2024-11-15 20:36:22.681219+00	2025-03-30 23:57:26.635038+00	t	Zucchini Soup	Sopa de Calabacita	Serve with crutons, and feta cheese (or your favourite cheese!)	Acompaña tu sopita con crutones, quesito feta ó tu queso favorito.	4	easy	{"fat": "17.1 g", "fiber": "10.5 g", "sodium": "6876 mg", "protein": "11.4 g", "calories": "352 kcal", "carbohydrates": "44.4 g"}
10cadced-e31b-4846-a7ac-b20742068137	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/galletas_de_pasitas_de_ian_1743621257930.jpeg	15	90	2025-04-02 19:14:18.422692+00	2025-04-15 15:33:53.293767+00	t	Ian's Raisin Cookies	Galletas de Pasitas de Ian	You can chop the walnuts in your Thermomix® by setting **5 sec/speed 5**. You can shape the dough into balls and freeze them to bake later. When you're ready to bake, there's no need to thaw them, simply preheat the oven to 150°C and place the frozen dough balls directly on a parchment-lined baking sheet, leaving about 2 inches of space between each one. Bake until the edges are golden brown and the center is still soft.	Puedes picar la nueces en tu Thermomix® programando **4 seg/vel 5.** Puedes formar bolitas con la masa y congelarlas para hornearlas después. Cuando quieras hornearlas, no es necesario descongelarlas, simplemente precalienta el horno a 150°C y colócalas directamente sobre una bandeja forrada con papel para hornear, dejando 5 cm de separación entre cada una. Hornea hasta que los bordes estén dorados y el centro aún suave.	24	easy	\N
8ef111aa-e965-42a4-a5be-6f7053c53269		15	240	2024-11-10 17:22:37.835926+00	2026-01-11 04:38:12.251781+00	f	\N	Cochinita pibil	\N	Sirva la cochinita pibil con cebollitas preparadas usando 3 chiles habaneros cortados en juliana, 1 cucharada de orégano seco, 1 diente de ajo picado, 120 g de vinagre blanco, el jugo de 2 limones, 200 g de cebolla morada en juliana y sal al gusto. Deje marinar la salsa por lo menos 30 minutos antes de servir.	6	easy	{"fibra": "1.5 g", "grasa": "42.3 g", "sodio": "872.6 mg", "calorías": "7 kcal", "proteína": "29.5 g", "carbohidratos": "7.6 g", "grasa saturada": "14.8 g", "inf. nutricional": "por 1 porción"}
411d8e8c-069c-43a6-af16-98b140dd53e0	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/recipes/images/galletas_de_chispas_de_chocolate_1744741270282.jpeg	30	240	2025-04-15 18:21:10.999739+00	2026-01-11 04:38:46.100212+00	f	Chocolate Chip Cookies	Galletas de chispas de chocolate	You can make your cookies with nuts by using 360 g chocolate chips and 200 g of your preferred nuts. This recipe is perfect for making "Levain-style" cookies—just shape each cookie into 150 g portions.	Puedes hacer tus galletas con nueces usando 360g de chispas de chocolate y 200 g de las nueces de tu preferencia. Esta receta es perfecta para hacer galletas tipo “Levian”, lo único que necesitas es hacer cada galleta de 150g.	20	easy	\N
f4b73b2c-43c2-4743-88fb-29ddd739efc0		10	60	2024-11-10 17:22:37.835926+00	2026-01-11 04:38:13.035957+00	f	\N	Salpicón de res	\N		6	easy	{"fibra": "2 g", "grasa": "16 g", "calorías": "326 kcal", "proteína": "23 g", "carbohidratos": "24 g", "inf. nutricional": "por 1 porción"}
\.



COPY "public"."useful_items" ("id", "name_en", "name_es", "image_url", "created_at", "updated_at") FROM stdin;
b6088d7a-a855-4dc7-9545-6ee872401791	Blowtorch	Soplete de cocina	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/blowtorch_1743786971778.png	2025-04-04 17:16:12.38636+00	2025-04-04 17:16:12.38636+00
896a071d-01fd-4b3b-a1d5-cf1c4a6d4813	Bowl	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	2025-04-04 17:16:24.902201+00	2025-04-04 17:16:24.902201+00
b11bc1b6-7216-4023-92bf-eb7c66f2980d	Can opener	Abrelatas	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/can_opener_1743786995677.png	2025-04-04 17:16:36.163074+00	2025-04-04 17:16:36.163074+00
36e67223-aa86-4a02-b3d8-8941cb4d1fde	Cake mold	Molde para tartas	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cake_mold_1743787010409.png	2025-04-04 17:16:51.009171+00	2025-04-04 17:16:51.009171+00
ede8c619-666d-4d64-a0ad-bafeb20c4af5	Colander	Colador	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/colander_1743787030159.png	2025-04-04 17:17:10.763161+00	2025-04-04 17:17:10.763161+00
07272385-3fde-4732-acba-120d995cb1e1	Casserole dish	Refractario para horno	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/casserole_dish_1743787169608.png	2025-04-04 17:19:30.227176+00	2025-04-04 17:19:30.227176+00
204fe8c7-497d-403f-8fb0-5ed1ed434901	Cooking tongs	Pinzas de cocina	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cooking_tongs_1743787197002.png	2025-04-04 17:19:57.478004+00	2025-04-04 17:19:57.478004+00
21a7b556-77e2-4013-ad12-e60a63c132fb	Cooking twine	Hilo bramante	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cooking_twine_1743787209175.png	2025-04-04 17:20:09.725625+00	2025-04-04 17:20:09.725625+00
450cbc67-5b48-49b1-86c1-358717b01c65	Cutting board	Tabla de cortar	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	2025-04-04 17:20:25.51149+00	2025-04-04 17:20:25.51149+00
1b5eb8eb-743a-4a17-9e26-c2cb38e6152b	Dough scraper	Rasqueta de cocina	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/dough_scraper_1743787238660.png	2025-04-04 17:20:39.167922+00	2025-04-04 17:20:39.167922+00
de244b5f-68a9-4754-96f2-d6156877c819	Fine mesh sieve	Cernidor	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/fine_mesh_sieve_1743787250708.png	2025-04-04 17:20:51.219897+00	2025-04-04 17:20:51.219897+00
e687b31b-5c96-44d8-b1b5-73bb806d678b	Frying pan	Sartén	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	2025-04-04 17:21:06.701833+00	2025-04-04 17:21:06.701833+00
d522eb2d-98f4-434f-94fe-0e93b441084f	Grater	Rallador	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/grater_1743787285908.png	2025-04-04 17:21:26.461275+00	2025-04-04 17:21:26.461275+00
3a567f5e-d055-4de2-88ad-91971141c29a	Ice cream scoop	Cuchara para helado	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/ice_cream_scoop_1743787299675.png	2025-04-04 17:21:40.261712+00	2025-04-04 17:21:40.261712+00
ae406f3b-9534-435b-aa09-899647b2ffeb	Fork	Tenedor	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/fork_1743787323676.png	2025-04-04 17:22:04.153512+00	2025-04-04 17:22:04.153512+00
344daa16-c541-46f6-9a62-ed836e28cf78	Kitchen brush	Brocha de cocina	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/kitchen_brush_1743787339474.png	2025-04-04 17:22:19.993237+00	2025-04-04 17:22:19.993237+00
bd4a13e1-e848-4a2d-9157-bffd08efafcc	Kitchen scissors	Tijeras de cocina	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/kitchen_scissors_1743787352857.png	2025-04-04 17:22:33.420939+00	2025-04-04 17:22:33.420939+00
413ff4f9-5753-4ccf-8d4d-e128265eda38	Kitchen scale	Báscula de cocina	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/kitchen_scale_1743787373474.png	2025-04-04 17:22:53.962781+00	2025-04-04 17:22:53.962781+00
c5037f42-ced2-4115-93ce-21a857b62c7f	Ladle	Cucharón	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/ladle_1743787385710.png	2025-04-04 17:23:06.239953+00	2025-04-04 17:23:06.239953+00
7c9d3196-19b1-4e57-a4df-ba86fa0a4f14	Mandoline slicer	Mandolina	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/mandoline_slicer_1743787396843.png	2025-04-04 17:23:17.619407+00	2025-04-04 17:23:17.619407+00
9aea6fc5-ab60-4715-b6bb-3ece49c0f461	Measuring cup	Tazas medidora	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/measuring_cup_1743787416676.png	2025-04-04 17:23:37.212876+00	2025-04-04 17:23:37.212876+00
fc21e27e-bed0-4726-92a3-ac33ae97ea2c	Measuring spoons	Cucharas medidoras	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/measuring_spoons_1743787444413.png	2025-04-04 17:24:05.021729+00	2025-04-04 17:24:05.021729+00
7f41707a-fd9f-477a-b588-93a30f45239a	Meat mallet	Martillo para carne	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/meat_mallet_1743787459540.png	2025-04-04 17:24:19.99092+00	2025-04-04 17:24:19.99092+00
110adba5-9e25-4221-8079-822c6c62b7bb	Muffin tin	Molde para muffins	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/muffin_tin_1743787491393.png	2025-04-04 17:24:51.963584+00	2025-04-04 17:24:51.963584+00
875be981-467c-4b73-a9bd-06218133c3ff	Offset spatula	Espátula pastelera	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png	2025-04-04 17:25:02.860376+00	2025-04-04 17:25:02.860376+00
26294e11-3d61-4ea8-8925-00b30be7f05c	Oven mittens	Guantes de horno	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/oven_mittens_1743787523340.png	2025-04-04 17:25:23.824775+00	2025-04-04 17:25:23.824775+00
1de6e6b1-bcb5-4236-8cd9-518582f867b5	Pipping bag	Manga pastelera	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/pipping_bag_1743787541839.png	2025-04-04 17:25:42.291913+00	2025-04-04 17:25:42.291913+00
64b12877-56b6-42bd-9d21-c92acb608970	Ovenproof dish	Recipiente para horno	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/ovenproof_dish_1743787558825.png	2025-04-04 17:25:59.466768+00	2025-04-04 17:25:59.466768+00
2494c90a-bf48-4604-9344-01c10f1efc66	Peeler	Pelador	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/peeler_1743787570589.png	2025-04-04 17:26:11.120737+00	2025-04-04 17:26:11.120737+00
f369898e-d801-41b5-b688-83b6b181e82b	Piping nozzle	Boquilla para manga pastelera	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/piping_nozzle_1743787601024.png	2025-04-04 17:26:41.533721+00	2025-04-04 17:26:41.533721+00
f8529541-83ef-4402-8334-9f7936b42bbe	Plastic wrap	Film transparente	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/plastic_wrap_1743787612422.png	2025-04-04 17:26:52.920666+00	2025-04-04 17:26:52.920666+00
b854e4bb-43e0-4f67-810d-bff7a8e342d4	Baking tray	Bandeja de hornos	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/baking_trays_1743786436882.png	2025-04-04 16:38:41.426823+00	2025-04-04 16:38:41.426823+00
e2154d2c-0143-4f8c-bc92-ea5111108773	Rolling pin	Rodillo	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/rolling_pin_1743787670357.png	2025-04-04 17:27:51.078809+00	2025-04-04 17:27:51.078809+00
a4078af9-76ee-4075-af5f-bb3bf88b559f	Saucepan	Caserola	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	2025-04-04 17:28:06.125122+00	2025-04-04 17:28:06.125122+00
9c2ed579-1094-4478-a401-683888fde7ae	Slotted spoon	Cuchara escurridora	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/slotted_spoon_1743787696527.png	2025-04-04 17:28:17.048252+00	2025-04-04 17:28:17.048252+00
64b41448-f68c-4a45-ae61-97f3e39fe358	Soup plate	Plato para sopa	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/soup_plate_1743787706423.png	2025-04-04 17:28:26.941931+00	2025-04-04 17:28:26.941931+00
a9dbf032-04fa-4114-aa4b-834b282d7545	Spatula	Espátula	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spatula_1743787718709.png	2025-04-04 17:28:39.181171+00	2025-04-04 17:28:39.181171+00
652326c8-edd2-43f9-b709-6325bbc70aca	Spring form pan	Molde desmontable	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png	2025-04-04 17:28:49.164243+00	2025-04-04 17:28:49.164243+00
c95fae0a-60cf-405e-80fd-857727c05248	Steak knife	Cuchillo de sierra	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png	2025-04-04 17:28:59.826697+00	2025-04-04 17:28:59.826697+00
9a2a94f2-d9cb-4415-ab54-1b3c08550d3f	Tea strainer	Infusor de té	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tea_strainer_1743787799089.png	2025-04-04 17:29:59.785936+00	2025-04-04 17:29:59.785936+00
16d1db42-f052-4ee6-b3b4-b130eb07a15e	Thermometer	Termómetro	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png	2025-04-04 17:30:12.505666+00	2025-04-04 17:30:12.505666+00
84756e53-f516-4dcc-9f7a-cd7ab02ea044	Thermomix® simmering basket	Cestillo Thermomix®	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_simmering_basket_1743787828042.png	2025-04-04 17:30:28.782394+00	2025-04-04 17:30:28.782394+00
fec070d5-50ae-433a-a383-cf7200b001b0	Thermomix® spatula	Espátula Thermomix®	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_spatula_1743787839523.png	2025-04-04 17:30:40.075716+00	2025-04-04 17:30:40.075716+00
7ce9ca90-a75e-416a-9e6a-b17260d5b6d3	Thermomix® Varoma	Varoma Thermomix®	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_1743787852547.png	2025-04-04 17:30:53.036689+00	2025-04-04 17:30:53.036689+00
08ff30e3-27f1-4704-b9f0-9c080d75ae65	Thermomix® Varoma tray	Bandeja Varoma Thermomix®	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_tray_1743787866973.png	2025-04-04 17:31:07.480245+00	2025-04-04 17:31:07.480245+00
56185ea2-5c8d-4196-ba91-10696ba1b0ca	Whisk	Batidor de globo	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/whisk_1743787879456.png	2025-04-04 17:31:19.962846+00	2025-04-04 17:31:19.962846+00
62ab182e-c378-4032-899c-90499eed5a07	Aluminium foil	Papel aluminio	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/aluminium_foil_1744066748748.png	2025-04-07 22:59:09.352941+00	2025-04-07 22:59:09.352941+00
9438fd74-ab87-4e9f-93f4-1aaf82182ab5	Bottle opener	Destapador	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bottle_opener_1744067104030.png	2025-04-07 23:05:04.751009+00	2025-04-07 23:05:04.751009+00
91e5fdc1-d126-4bff-ae08-17880462a52e	Citrus reamer	Exprimidor	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/citrus_reamer_1744067235035.png	2025-04-07 23:07:15.721671+00	2025-04-07 23:07:15.721671+00
247a0421-7020-49ca-a875-25c4cf38d476	Cooling rack	Rejilla para enfriar	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cooling_rack_1744067328849.png	2025-04-07 23:08:49.412279+00	2025-04-07 23:08:49.412279+00
e1b21934-8f8c-4c1e-adaf-5d12eccbe076	Corkscrew	Sacacorchos	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/corkscrew_1744067392337.png	2025-04-07 23:09:52.902436+00	2025-04-07 23:09:52.902436+00
523d071e-234e-4867-95a0-678f8e4dbd83	Dutch oven	Cacerola de hierro fundido	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/dutch_oven_1744067444900.png	2025-04-07 23:10:45.497585+00	2025-04-07 23:10:45.497585+00
cf8a8087-b253-40ae-b160-ea2ecc5388d5	Food processor	Procesador de alimentos	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/food_processor_1744067491974.png	2025-04-07 23:11:32.640067+00	2025-04-07 23:11:32.640067+00
e14c4049-28ed-495c-9c25-82142611939f	Funnel	Embudo	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/funnel_1744067504857.png	2025-04-07 23:11:45.469977+00	2025-04-07 23:11:45.469977+00
296731fd-3936-4176-9859-a5298475721d	Garlic press	Prensa de ajos	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/garlic_press_1744067674064.png	2025-04-07 23:14:34.556568+00	2025-04-07 23:14:34.556568+00
164ea4d8-49bf-4d70-b615-35cfcdbee601	Hermetic container	Contenedor hermético	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/hermetic_container_1744067716716.png	2025-04-07 23:15:17.111463+00	2025-04-07 23:15:17.111463+00
f24fae9a-1b2f-4f12-a3d2-8be16e151fcf	Immersion blender	Batidora de inmersión	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/immersion_blender_1744067778329.png	2025-04-07 23:16:18.944225+00	2025-04-07 23:16:18.944225+00
1d3aa3ec-432a-4ef4-bf54-734c94615d6a	Loaf pan	Molde para pan de caja	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/loaf_pan_1744067804208.png	2025-04-07 23:16:44.749652+00	2025-04-07 23:16:44.749652+00
0e67414f-2788-4890-b792-7d78e282f9f0	Mortar and pestle	Molcajete y tejolote	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/mortar_and_pestle_1744067836343.png	2025-04-07 23:17:16.784637+00	2025-04-07 23:17:16.784637+00
a732ed2d-0fc8-409e-8b03-d58b00a0ce9b	Oven	Horno	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/oven_1744067868746.png	2025-04-07 23:17:49.273879+00	2025-04-07 23:17:49.273879+00
d9881fa7-3fa5-4bdf-b0d3-574bad4cacfc	Parchment paper	Papel para hornear	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/parchment_paper_1744067937797.png	2025-04-07 23:18:58.494474+00	2025-04-07 23:18:58.494474+00
9d4592b2-97e6-47ba-8cc8-952783808265	Spoon	Cuchara	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spoon_1744067966814.png	2025-04-07 23:19:27.284747+00	2025-04-07 23:19:27.284747+00
b785ed73-1a2d-44fa-b845-c392e60bef89	Potato masher	Machacador de papas	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/potato_masher_1744067995189.png	2025-04-07 23:19:55.647565+00	2025-04-07 23:19:55.647565+00
06ea4aba-e45d-42a8-835a-7a704a6bc251	Silicone mat	Tapete de silicón	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/silicone_mat_1744068019859.png	2025-04-07 23:20:20.28985+00	2025-04-07 23:20:20.28985+00
90908360-ef21-4639-b277-4d8e3044d159	Stockpot	Olla grande	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/stockpot_1744068068456.png	2025-04-07 23:21:08.997073+00	2025-04-07 23:21:08.997073+00
d8ebc935-9316-4d15-8f2a-498b3a703aee	Zester	Rallador de cítricos	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/zester_1744068086988.png	2025-04-07 23:21:27.688749+00	2025-04-07 23:21:27.688749+00
\.



COPY "public"."user_chat_messages" ("id", "session_id", "role", "content", "tool_calls", "tool_call_id", "input_tokens", "output_tokens", "created_at") FROM stdin;
bee1d74d-4c08-4169-a586-19d21813f52d	add0b759-5994-47da-a904-c8c068b619e7	user	Hola	\N	\N	\N	\N	2026-01-12 23:47:04.83978+00
45e9bfd3-f0fa-4576-b605-3a985a52dda8	add0b759-5994-47da-a904-c8c068b619e7	assistant	Hello! How can I assist you in the kitchen today?	\N	\N	133	12	2026-01-12 23:47:06.556042+00
a28b1b88-aba0-48c8-95d1-4a08ecea8c00	959dc0b3-ecd2-41b3-8391-703da1a3509a	user	hola	\N	\N	\N	\N	2026-01-12 23:47:48.054613+00
66fc97e4-76b4-4638-b1a5-629eda9cd6ff	959dc0b3-ecd2-41b3-8391-703da1a3509a	assistant	Hello! How can I assist you in the kitchen today? 😊	\N	\N	133	13	2026-01-12 23:47:49.642594+00
8b455d02-db55-4683-a929-1b5603e6cf67	c463e84f-2868-49f1-9495-f03f4da54b3c	user	Do you work?	\N	\N	\N	\N	2026-01-13 01:47:14.231223+00
3facd472-4167-4943-8f9a-5dfcb549a55a	c463e84f-2868-49f1-9495-f03f4da54b3c	assistant	Yes, I'm here to help you with any cooking questions or recipe ideas you might have! Whether you need tips, modifications, or meal planning, just let me know how I can assist you.	\N	\N	136	39	2026-01-13 01:47:16.52044+00
9b34f34b-fdaf-4343-8833-087e046f0863	f02ea858-a0f5-4778-9632-8dac6a6ecd04	user	you	\N	\N	\N	\N	2026-01-13 04:03:48.223044+00
c1960032-e3ee-49e5-8747-3f652f7d7a3e	f02ea858-a0f5-4778-9632-8dac6a6ecd04	assistant	Oh, sweet pea, I’m right here! What can I help you whip up today?	\N	\N	\N	\N	2026-01-13 04:03:48.223044+00
51087aac-e4dd-43f1-9829-5fa1de30bbef	f02ea858-a0f5-4778-9632-8dac6a6ecd04	user	you	\N	\N	\N	\N	2026-01-13 04:04:11.132368+00
816056f0-be07-48b9-91c6-9c3a3b9079ed	f02ea858-a0f5-4778-9632-8dac6a6ecd04	assistant	Oh, darling, I’m just your friendly kitchen helper! What’s on your mind?	\N	\N	\N	\N	2026-01-13 04:04:11.132368+00
6817ca7d-56d6-4bd6-8fd9-dfd394698387	a26278d0-434b-4f9c-bb1a-8100a12dcb18	user	you	\N	\N	\N	\N	2026-01-13 04:20:33.940805+00
ae0bc0ae-686f-488f-82af-794c300c46ce	a26278d0-434b-4f9c-bb1a-8100a12dcb18	assistant	Oh, sweetie, I’m right here! What deliciousness are we cooking up today?	\N	\N	\N	\N	2026-01-13 04:20:33.940805+00
c62d932e-7028-4b37-af4f-78f70d501cf6	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	user	you	\N	\N	\N	\N	2026-01-13 04:49:14.617499+00
91487a05-451f-4172-be3d-dba9327bc000	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	assistant	Oh, sweetie, I'm right here! What can I help you whip up today?	\N	\N	\N	\N	2026-01-13 04:49:14.617499+00
875bfbe1-c1e2-4789-83aa-806071aef5ef	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	user	you	\N	\N	\N	\N	2026-01-13 04:49:32.517444+00
3920ddf3-4ea3-4217-aea3-ce2579b45dca	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	assistant	Oh my, I’m just a loving assistant here to help you in the kitchen, dear! What’s on your mind?	\N	\N	\N	\N	2026-01-13 04:49:32.517444+00
0545aac2-ba6b-4693-961f-d403ac50bda3	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	user	you	\N	\N	\N	\N	2026-01-13 04:51:35.22094+00
1c288167-285e-483a-a737-792ed3eeeb8c	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	assistant	Oh, darling, I’m just a cozy little helper for your cooking adventures! What deliciousness shall we talk about today?	\N	\N	\N	\N	2026-01-13 04:51:35.22094+00
856c6b2a-7dbf-48a9-8167-96b9064cd65a	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	user	Can u show me a banana bread recipe	\N	\N	\N	\N	2026-01-13 04:52:41.297584+00
a4262da5-de1a-4adf-b583-c5e8797c01cf	a80ac0cb-dab9-480c-a4f3-dfb11ee37264	assistant	Absolutely! Here’s a simple and delicious Thermomix banana bread recipe for you:\n\n### Thermomix Banana Bread\n\n#### Ingredients:\n- 3 ripe bananas\n- 100g unsalted butter, softened\n- 150g brown sugar (or coconut sugar for a healthier option)\n- 2 large eggs\n- 1 tsp vanilla extract\n- 200g all-purpose flour (or whole wheat flour)\n- 1 tsp baking powder\n- 1/2 tsp baking soda\n- 1/4 tsp salt\n- Optional: 100g chocolate chips or nuts (like walnuts or pecans)\n\n#### Instructions:\n1. **Preheat the Oven**: Preheat your oven to 180°C (350°F) and grease a loaf pan.\n\n2. **Mix Bananas**: Place the ripe bananas in the mixing bowl and mash for 5 seconds on speed 4. Scrape down the sides.\n\n3. **Add Butter & Sugar**: Add the softened butter and brown sugar. Mix for 20 seconds on speed 4.\n\n4. **Add Eggs & Vanilla**: Add the eggs and vanilla extract. Mix for another 15 seconds on speed 4.\n\n5. **Combine Dry Ingredients**: Add the flour, baking powder, baking soda, and salt. Mix for 20 seconds on speed 4, using the spatula to help combine if needed.\n\n6. **Fold in Extras**: If using, fold in chocolate chips or nuts by mixing for 10 seconds on reverse speed 2.\n\n7. **Bake**: Pour the batter into the prepared loaf pan and smooth the top. Bake for about 60 minutes or until a skewer inserted into the center comes out clean.\n\n8. **Cool & Serve**: Let it cool in the pan for about 10 minutes, then transfer to a wire rack to cool completely. Enjoy!\n\nFeel free to ask if you need any modifications or substitutions! Happy baking! 🍌🍞	\N	\N	235	401	2026-01-13 04:52:49.482015+00
b45f6f77-415c-4157-b1f9-1831ee405e7c	f5351638-6085-47b0-82a4-1132f6bcfe7e	user	Oh La	\N	\N	\N	\N	2026-01-13 14:35:34.524291+00
5076bd80-c7b0-4768-b7b0-87051a73c030	f5351638-6085-47b0-82a4-1132f6bcfe7e	assistant	Oh la la, my dear! What deliciousness are we cooking up today?	\N	\N	\N	\N	2026-01-13 14:35:34.524291+00
96ac982b-0515-4175-bf36-73675264c844	f5351638-6085-47b0-82a4-1132f6bcfe7e	user	you	\N	\N	\N	\N	2026-01-13 14:36:02.740766+00
77270267-765a-44c2-ab2e-c3480552d674	f5351638-6085-47b0-82a4-1132f6bcfe7e	assistant	Oh, sweetie, I’m just here to help you whip up something wonderful! What’s on your mind?	\N	\N	\N	\N	2026-01-13 14:36:02.740766+00
1cb85d2c-6d25-4674-9ecc-01f00c0741f0	f5351638-6085-47b0-82a4-1132f6bcfe7e	user	you	\N	\N	\N	\N	2026-01-13 14:36:23.806165+00
53471fdd-c8b8-496f-aa73-1f297c57ac79	f5351638-6085-47b0-82a4-1132f6bcfe7e	assistant	Oh, bless your heart! I’m just your loving kitchen companion, ready to sprinkle some joy into your cooking!	\N	\N	\N	\N	2026-01-13 14:36:23.806165+00
279a2eb6-99eb-4334-bb8f-d6e70bd1cb5f	f5351638-6085-47b0-82a4-1132f6bcfe7e	user	you	\N	\N	\N	\N	2026-01-13 14:37:10.894581+00
822eee95-6b4a-48fa-9ba6-8a61ba7e53ce	f5351638-6085-47b0-82a4-1132f6bcfe7e	assistant	Oh, darling, you’re so sweet! Just let me know what you need, and we’ll make magic in the kitchen together!	\N	\N	\N	\N	2026-01-13 14:37:10.894581+00
96da09a6-1639-4db2-9c3b-295ab936396e	5a996719-749a-43bd-b612-bdbae4b0b0be	user	Subtítulos realizados por la comunidad de Amara.org	\N	\N	\N	\N	2026-01-13 15:18:48.119255+00
854c8d12-1aa7-4f7d-a12a-b0ea40bf7d2e	5a996719-749a-43bd-b612-bdbae4b0b0be	assistant	Oh, querido, ¿estás buscando recetas o consejos de cocina? Estoy aquí para ayudarte con mucho amor. ¡Dime qué necesitas!	\N	\N	\N	\N	2026-01-13 15:18:48.119255+00
26a6868a-7439-46dd-b015-06f03698e87b	a72c8036-3304-4d9f-95b1-3ccf67fd3866	user	Subtítulos realizados por la comunidad de Amara.org	\N	\N	\N	\N	2026-01-13 18:13:22.553957+00
ef744d96-1dff-4ce5-9459-0327ef30d178	a72c8036-3304-4d9f-95b1-3ccf67fd3866	assistant	Parece que mencionaste subtítulos, ¿necesitas ayuda con algo relacionado con la cocina o alguna receta?	\N	\N	\N	\N	2026-01-13 18:13:22.553957+00
6b10e35e-9ea7-4cfd-aebf-55a0f4b0bfd0	e93551ff-04bc-4a6c-abbd-0477c306bbd6	user	Hola	\N	\N	\N	\N	2026-01-13 18:23:10.614288+00
6c5c6fab-281b-4777-9624-a68ceed064a9	e93551ff-04bc-4a6c-abbd-0477c306bbd6	assistant	¡Hola! ¿Cómo puedo ayudarte en la cocina hoy?	\N	\N	0	0	2026-01-13 18:23:12.180251+00
e46379d3-3d8c-4a6f-a079-800533146bee	3dcb7aeb-75aa-4062-88f1-b435ad879cb3	user	I’m testing if the streaming world, tell me a short 100 Word story	\N	\N	\N	\N	2026-01-13 18:23:36.9644+00
21a8f44a-d3b5-4807-8e56-1f9a4bc12842	3dcb7aeb-75aa-4062-88f1-b435ad879cb3	assistant	Claro, aquí tienes una historia corta de 100 palabras:\n\nEn un pequeño pueblo, Clara descubrió un viejo libro de recetas en el ático de su abuela. Cada página estaba llena de historias y sabores olvidados. Decidió probar una receta de galletas de chocolate, usando su Thermomix. Mientras los ingredientes se mezclaban, el aroma llenó su hogar, trayendo recuerdos de risas y amor. Al sacar las galletas del horno, su familia se reunió, atraída por el delicioso olor. Juntos, disfrutaron de las galletas, reviviendo tradiciones y creando nuevos recuerdos. Clara sonrió al darse cuenta de que la cocina era un puente entre el pasado y el presente, uniendo corazones.	\N	\N	0	0	2026-01-13 18:23:41.814147+00
52da06ba-f5d7-471f-b072-e8bc0e4778e7	7a95d691-d20b-4ca5-8a24-dda062215ed8	user	Work	\N	\N	\N	\N	2026-01-13 18:48:09.157826+00
7465d038-2f2c-4107-911e-37db8ead4de4	7a95d691-d20b-4ca5-8a24-dda062215ed8	assistant	¡Hola! ¿En qué puedo ayudarte hoy en la cocina? Si tienes preguntas sobre recetas, ingredientes o técnicas, estaré encantado de ayudarte.	\N	\N	0	0	2026-01-13 18:48:11.173371+00
dc1bf6c9-7a6d-46bf-a75f-229e908ce3ea	27a6285a-a9e7-4a27-84db-11e12b8dd1f7	user	Hola	\N	\N	\N	\N	2026-01-13 19:59:45.78083+00
2f773dc5-ab0b-4e3e-92db-681345c5ab77	d287ccf8-e871-4725-94f1-cebd173a7487	user	Hola	\N	\N	\N	\N	2026-01-13 19:59:56.456609+00
96099841-9a12-41f1-9b62-c56ec9b903f4	d287ccf8-e871-4725-94f1-cebd173a7487	assistant	¡Hola! ¿Cómo puedo ayudarte hoy en la cocina?	\N	\N	0	0	2026-01-13 19:59:58.218963+00
ccb251b8-8c26-497c-b79c-1763a172d8c6	77f64a7d-a558-45a8-b5d3-acd4c6a84479	user	Hola	\N	\N	\N	\N	2026-01-13 20:00:15.706134+00
218bbb3e-5dc6-429f-9326-d1fedbaaccdd	77f64a7d-a558-45a8-b5d3-acd4c6a84479	assistant	¡Hola! ¿Cómo puedo ayudarte hoy en la cocina?	\N	\N	0	0	2026-01-13 20:00:17.463885+00
847aaae2-9cb5-4a6e-bf14-828b1d0946ce	a0b4a23e-d091-4ac5-ae43-451468a1717d	user	Hola	\N	\N	\N	\N	2026-01-13 20:09:18.085341+00
0ba909e3-0038-4dce-b709-d0b446e7aba5	a0b4a23e-d091-4ac5-ae43-451468a1717d	assistant	¡Hola! ¿Cómo puedo ayudarte hoy en tu cocina?	\N	\N	0	0	2026-01-13 20:09:19.485401+00
f20ce36d-dae7-47dd-99f1-c3a0e77c032d	407c89ac-d984-410f-8d01-d189d0283f95	user	¿Qué es lo que se ha hecho?	\N	\N	\N	\N	2026-01-13 20:21:16.30783+00
39062cab-6d9d-469b-906a-68c9c6425bdf	407c89ac-d984-410f-8d01-d189d0283f95	assistant	¡Hola! Si te refieres a la cocina, siempre hay algo delicioso que preparar. ¿Tienes algún platillo en mente? 🍽️✨	\N	\N	\N	\N	2026-01-13 20:21:16.30783+00
b59ca864-2fd9-4525-bff4-e3a5c9c6f0f3	407c89ac-d984-410f-8d01-d189d0283f95	user	Hola	\N	\N	\N	\N	2026-01-13 20:21:28.875265+00
3da98cf7-21ef-45da-83b5-ee1d71ecfb26	407c89ac-d984-410f-8d01-d189d0283f95	assistant	¡Hola! ¿Cómo puedo ayudarte hoy en la cocina? Si tienes alguna pregunta o necesitas una receta, ¡estaré encantado de ayudarte! 😊	\N	\N	0	0	2026-01-13 20:21:32.324114+00
ac0a3143-e45a-4107-a3af-4d2fb1e7ab0f	b7acefd6-2ea9-4e26-9b94-00b09da0b522	user	¿Qué es lo que se ha hecho?	\N	\N	\N	\N	2026-01-13 20:24:52.604794+00
8b44cbe0-ed6c-4e49-b8cc-0520ee992b8c	b7acefd6-2ea9-4e26-9b94-00b09da0b522	assistant	¡Hola! ¿Te refieres a alguna receta en particular? ¡Estoy aquí para ayudarte!	\N	\N	\N	\N	2026-01-13 20:24:52.604794+00
ab010460-b18c-42e8-ae5b-57472eb2135d	b7acefd6-2ea9-4e26-9b94-00b09da0b522	user	¿Qué es lo que se ha hecho?	\N	\N	\N	\N	2026-01-13 20:25:34.748177+00
642aa21a-5753-4fc7-8577-9f4c6611cb20	b7acefd6-2ea9-4e26-9b94-00b09da0b522	assistant	¡Parece que hay un poco de confusión! ¿Te gustaría saber sobre una receta o técnica de cocina específica? ¡Estoy lista para ayudarte!	\N	\N	\N	\N	2026-01-13 20:25:34.748177+00
c440f040-b088-4517-bfd8-b28ede44b1c7	b7acefd6-2ea9-4e26-9b94-00b09da0b522	user	Hola	\N	\N	\N	\N	2026-01-13 20:27:19.506878+00
9b3c87b4-e716-49ff-bd27-1b0870f9237b	b7acefd6-2ea9-4e26-9b94-00b09da0b522	assistant	¡Hola! ¿Cómo estás? ¿En qué puedo ayudarte hoy en la cocina?	\N	\N	0	0	2026-01-13 20:27:20.340596+00
7e300cb0-6403-4d41-82b4-53e7ecf41a4b	b7acefd6-2ea9-4e26-9b94-00b09da0b522	user	Cuenta me un cuento que llevo cien palabras	\N	\N	\N	\N	2026-01-13 20:27:40.761367+00
9cb6b613-328c-4e6e-a770-b523f69b7885	b7acefd6-2ea9-4e26-9b94-00b09da0b522	assistant	Claro, aquí tienes un cuento de exactamente cien palabras:\n\nEn un pequeño pueblo, había un chef llamado Diego, famoso por su exquisita paella. Un día, una joven llamada Clara llegó buscando el ingrediente secreto. Diego, con una sonrisa, le dijo que el secreto estaba en el amor que ponía en cada plato. Intrigada, Clara decidió aprender de él. Pasaron días cocinando juntos, riendo y compartiendo historias. Finalmente, Clara preparó su propia paella, infundida con su cariño. Cuando sirvió el plato a su familia, todos quedaron maravillados. Desde entonces, Clara no solo cocinó paellas, sino también momentos felices. Y así, el amor se convirtió en el verdadero ingrediente secreto.	\N	\N	0	0	2026-01-13 20:27:44.670655+00
a23801c9-d521-4827-ad26-2d7e81c11d70	b7acefd6-2ea9-4e26-9b94-00b09da0b522	user	Que mas	\N	\N	\N	\N	2026-01-13 20:28:11.846255+00
bbe7b8e0-482e-44f4-8e3a-29ca15fb92a0	b7acefd6-2ea9-4e26-9b94-00b09da0b522	assistant	¡Claro! Si buscas más historias, recetas o consejos de cocina, estoy aquí para ayudarte. ¿Te gustaría que te sugiera una receta deliciosa, o tal vez un consejo para cocinar? ¡Dime qué te interesa!	\N	\N	0	0	2026-01-13 20:28:13.495843+00
4c93cb0c-5c9a-401f-85b4-1ce0675742a5	09b8af41-0fed-456d-a4ba-4cfc76c52abf	user	¿Qué es lo que se ha hecho?	\N	\N	\N	\N	2026-01-13 20:41:25.24667+00
f2a695d4-3c07-431a-b621-0e72244ed392	09b8af41-0fed-456d-a4ba-4cfc76c52abf	assistant	¡Hola! ¿Te refieres a una receta o a un platillo en particular? Estoy aquí para ayudarte.	\N	\N	\N	\N	2026-01-13 20:41:25.24667+00
32f3b5e4-86de-48ae-a39f-293a011f4ffd	09b8af41-0fed-456d-a4ba-4cfc76c52abf	user	Hello	\N	\N	\N	\N	2026-01-13 20:43:19.856872+00
2dddc6f1-ced0-4cba-b3b1-39d1b51deb59	09b8af41-0fed-456d-a4ba-4cfc76c52abf	assistant	¡Hola! Estoy aquí para ayudarte con cualquier pregunta sobre cocina, recetas o técnicas. ¿En qué puedo asistirte hoy?	\N	\N	0	0	2026-01-13 20:43:20.970721+00
1c3d39eb-f67c-4dfc-a835-edf963f73cfb	d30ed503-7a83-4d79-b8b2-8afc3b09066b	user	¿Qué es lo que se ha hecho?	\N	\N	\N	\N	2026-01-13 20:46:35.164162+00
6062bca8-847e-4b93-886a-d89754a25b29	d30ed503-7a83-4d79-b8b2-8afc3b09066b	assistant	¡Hola! ¿Te refieres a alguna receta o plato en particular? ¡Estoy aquí para ayudarte!	\N	\N	\N	\N	2026-01-13 20:46:35.164162+00
caf45d90-41e6-4bca-b1a1-84b5485cdafe	a5d5db96-a3ea-4638-98bc-571ff86eeabf	user	¿Qué es lo que se ha hecho?	\N	\N	\N	\N	2026-01-13 20:51:35.13432+00
f4bbd769-ed9d-41f2-9d31-e585be9b6d7e	a5d5db96-a3ea-4638-98bc-571ff86eeabf	assistant	¡Hola! ¿Te refieres a alguna receta en particular o algo que quieras cocinar? Estoy aquí para ayudarte.	\N	\N	\N	\N	2026-01-13 20:51:35.13432+00
5f2ca626-b9a8-46b5-a0e9-0655a6091a9b	ca433e67-ece6-498e-be24-d1f37454f42f	user	Suggest a recipe	\N	\N	\N	\N	2026-01-31 21:08:56.853475+00
c02b6484-79ad-4e04-9096-b751808fc2c9	ca433e67-ece6-498e-be24-d1f37454f42f	assistant	¿Qué ingredientes tienes?	\N	\N	\N	\N	2026-01-31 21:08:56.937381+00
17be9d4c-3b57-4f77-9422-e046fdf2aaeb	ca433e67-ece6-498e-be24-d1f37454f42f	user	Cuéntame sobre la pasta al pesto.	\N	\N	\N	\N	2026-01-31 21:09:21.462522+00
c6b28e08-c138-4606-9da9-004136ef3ed5	ca433e67-ece6-498e-be24-d1f37454f42f	assistant	Aquí tienes una receta deliciosa de Pasta al Pesto:\n\n### Ingredientes:\n- 400 g de pasta (tu elección: espagueti, penne, etc.)\n- 100 g de albahaca fresca\n- 50 g de piñones (o nueces)\n- 50 g de queso parmesano rallado\n- 150 ml de aceite de oliva\n- 2 dientes de ajo\n- Sal al gusto\n- Pimienta al gusto\n\n### Instrucciones:\n1. **Cocina la pasta:** Hierve agua con sal y cocina la pasta según las instrucciones del paquete hasta que esté al dente.\n2. **Prepara el pesto:** En un procesador de alimentos, mezcla la albahaca, piñones, queso parmesano, ajo, sal y pimienta. Agrega lentamente el aceite de oliva hasta obtener una salsa homogénea.\n3. **Mezcla:** Escurre la pasta y mezcla con el pesto, asegurándote de cubrir bien la pasta. Sirve caliente.\n\n¡Disfruta de tu deliciosa Pasta al Pesto! \n\n### Sugerencias:\n- **Hazlo más cremoso:** Agrega un poco de crema de leche.\n- **Añade proteínas:** Incorpora pollo a la parrilla o garbanzos.\n- **Experimenta con nueces:** Prueba diferentes nueces en el pesto, como almendras o nueces de macadamia.	{"recipes": []}	\N	\N	\N	2026-01-31 21:09:21.510739+00
e42fdbce-339c-4ecb-afa5-e8dd58eec71d	37d2704a-2d60-4f22-b133-b02aaabb03d6	user	Suggest a recipe	\N	\N	\N	\N	2026-01-31 21:31:29.06826+00
a9244937-0831-4d59-bfa5-b2b173bcd377	37d2704a-2d60-4f22-b133-b02aaabb03d6	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-01-31 21:31:29.112403+00
1787d30d-9784-436e-a2b2-81e80c8ac903	37d2704a-2d60-4f22-b133-b02aaabb03d6	user	Explore a healthy salad!	\N	\N	\N	\N	2026-01-31 21:31:44.032484+00
d8c5a469-be77-4583-866e-ce2f46bbdf3d	37d2704a-2d60-4f22-b133-b02aaabb03d6	assistant	Here are three healthy salad recipes you can try:\n\n1. **Quinoa Salad**\n   - Ingredients: Cooked quinoa, cherry tomatoes, cucumber, bell pepper, red onion, parsley, olive oil, lemon juice, salt, and pepper.\n   - Instructions: Combine all ingredients in a bowl, drizzle with olive oil and lemon juice, season with salt and pepper, and toss well.\n\n2. **Chickpea Salad**\n   - Ingredients: Canned chickpeas (drained), diced cucumber, diced bell pepper, red onion, parsley, olive oil, lemon juice, salt, and cumin.\n   - Instructions: Mix chickpeas and vegetables in a bowl, add olive oil, lemon juice, salt, and cumin, then toss to combine.\n\n3. **Spinach and Strawberry Salad**\n   - Ingredients: Fresh spinach, sliced strawberries, walnuts, feta cheese, balsamic vinegar, and olive oil.\n   - Instructions: In a salad bowl, combine spinach, strawberries, and walnuts. Drizzle with balsamic vinegar and olive oil, then sprinkle with feta cheese.\n\nEnjoy your healthy salads! Here are some ideas to modify these recipes:\n- **Add protein**: Include grilled chicken or tofu.\n- **Make it spicier**: Add sliced jalapeños or a spicy dressing.\n- **Less dressing**: Reduce the amount of olive oil or vinegar used.	{"recipes": []}	\N	\N	\N	2026-01-31 21:31:44.079589+00
440c978d-6739-41f2-8723-907d81ff4598	37d2704a-2d60-4f22-b133-b02aaabb03d6	user	Include grilled chicken or tofu.	\N	\N	\N	\N	2026-01-31 21:33:27.700749+00
afc3f330-094b-4064-a2e3-2fe41ed77ac9	884ef695-130f-4e4c-b649-106d14fb0f5e	user	Consider adding grilled chicken or shrimp for extra protein.	\N	\N	\N	\N	2026-02-02 17:32:08.257196+00
7aa90c55-4b8d-407e-8de1-875a4e7dec51	9826898f-c675-44d2-8723-54ee71ef36fe	assistant	Please let me know what ingredients you have on hand!	\N	\N	\N	\N	2026-02-02 17:44:46.090486+00
ba1f7af2-d362-46a3-a28c-b2768b67ba01	9826898f-c675-44d2-8723-54ee71ef36fe	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:44:56.121485+00
cf71ceac-9268-433a-b417-f3795879d3f1	9826898f-c675-44d2-8723-54ee71ef36fe	user	Help me create a custom recipe	\N	\N	\N	\N	2026-02-02 17:45:16.546241+00
b76c5705-37f6-4d7a-93ac-14f6221b45a1	37d2704a-2d60-4f22-b133-b02aaabb03d6	assistant	Here are the updated salad recipes with grilled chicken or tofu added:\n\n1. **Quinoa Salad with Grilled Chicken**\n   - Ingredients: Cooked quinoa, grilled chicken (sliced), cherry tomatoes, cucumber, bell pepper, red onion, parsley, olive oil, lemon juice, salt, and pepper.\n   - Instructions: Combine cooked quinoa and sliced grilled chicken with the chopped vegetables in a bowl. Drizzle with olive oil and lemon juice, season with salt and pepper, and toss well.\n\n2. **Chickpea Salad with Grilled Tofu**\n   - Ingredients: Canned chickpeas (drained), grilled tofu (cubed), diced cucumber, diced bell pepper, red onion, parsley, olive oil, lemon juice, salt, and cumin.\n   - Instructions: Mix chickpeas, grilled tofu, and vegetables in a bowl. Add olive oil, lemon juice, salt, and cumin, then toss to combine.\n\n3. **Spinach and Strawberry Salad with Grilled Chicken**\n   - Ingredients: Fresh spinach, sliced strawberries, grilled chicken (sliced), walnuts, feta cheese, balsamic vinegar, and olive oil.\n   - Instructions: In a salad bowl, combine spinach, strawberries, sliced grilled chicken, and walnuts. Drizzle with balsamic vinegar and olive oil, then sprinkle with feta cheese.\n\nEnjoy your wholesome salads! Here are some modification ideas:\n- **Make it spicier**: Add sliced jalapeños or a spicy dressing.\n- **Less dressing**: Reduce the amount of olive oil or vinegar used.\n- **Add nuts or seeds**: Include sunflower seeds or pumpkin seeds for extra crunch.	{"customRecipe": {"tags": ["salad", "Mediterranean", "healthy", "chicken"], "steps": [{"order": 1, "instruction": "Preheat the grill to medium-high heat (around 200°C)."}, {"order": 2, "instruction": "Season the grilled chicken breast with salt and pepper, then grill for 6-7 minutes on each side or until the internal temperature reaches 75°C."}, {"order": 3, "instruction": "While the chicken is grilling, wash and dry the fresh spinach and place it in a large salad bowl."}, {"order": 4, "instruction": "Slice the strawberries and add them to the spinach."}, {"order": 5, "instruction": "Chop the walnuts and sprinkle them over the salad."}, {"order": 6, "instruction": "Crumble the feta cheese on top of the salad."}, {"order": 7, "instruction": "In a small bowl, whisk together the balsamic vinegar and olive oil to create the dressing."}, {"order": 8, "instruction": "Once the chicken is grilled, let it rest for a few minutes, then slice it into strips."}, {"order": 9, "instruction": "Add the sliced grilled chicken to the salad and drizzle the dressing over the top."}, {"order": 10, "instruction": "Toss gently to combine all the ingredients and serve immediately."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "fresh spinach", "unit": "grams", "quantity": 200}, {"name": "strawberries", "unit": "grams", "quantity": 150}, {"name": "walnuts", "unit": "grams", "quantity": 50}, {"name": "feta cheese", "unit": "grams", "quantity": 100}, {"name": "balsamic vinegar", "unit": "ml", "quantity": 30}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "grilled chicken breast", "unit": "grams", "quantity": 300}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Spinach and Strawberry Salad with Grilled Chicken", "measurementSystem": "metric"}}	\N	\N	\N	2026-01-31 21:33:27.747976+00
4a33d6bb-6129-4000-a7f2-bea9f895dd7b	37d2704a-2d60-4f22-b133-b02aaabb03d6	user	Include sunflower or pumpkin seeds for extra crunch.	\N	\N	\N	\N	2026-01-31 21:37:01.641878+00
cdc18e6e-8ec4-44ec-881a-4d528b8a65f6	37d2704a-2d60-4f22-b133-b02aaabb03d6	assistant	Here are the updated salad recipes with sunflower or pumpkin seeds added for extra crunch:\n\n1. **Quinoa Salad with Grilled Chicken and Sunflower Seeds**\n   - Ingredients: Cooked quinoa, grilled chicken (sliced), cherry tomatoes, cucumber, bell pepper, red onion, parsley, sunflower seeds, olive oil, lemon juice, salt, and pepper.\n   - Instructions: Combine cooked quinoa and sliced grilled chicken with the chopped vegetables and sunflower seeds in a bowl. Drizzle with olive oil and lemon juice, season with salt and pepper, and toss well.\n\n2. **Chickpea Salad with Grilled Tofu and Pumpkin Seeds**\n   - Ingredients: Canned chickpeas (drained), grilled tofu (cubed), diced cucumber, diced bell pepper, red onion, parsley, pumpkin seeds, olive oil, lemon juice, salt, and cumin.\n   - Instructions: Mix chickpeas, grilled tofu, and vegetables with pumpkin seeds in a bowl. Add olive oil, lemon juice, salt, and cumin, then toss to combine.\n\n3. **Spinach and Strawberry Salad with Grilled Chicken and Sunflower Seeds**\n   - Ingredients: Fresh spinach, sliced strawberries, grilled chicken (sliced), walnuts, sunflower seeds, feta cheese, balsamic vinegar, and olive oil.\n   - Instructions: In a salad bowl, combine spinach, strawberries, sliced grilled chicken, walnuts, and sunflower seeds. Drizzle with balsamic vinegar and olive oil, then sprinkle with feta cheese.\n\nEnjoy your delicious and crunchy salads! Here are some modification ideas:\n- **Make it spicier**: Add sliced jalapeños or a spicy dressing.\n- **Less dressing**: Reduce the amount of olive oil or vinegar used.\n- **Add more veggies**: Include avocado or shredded carrots for extra flavor.	\N	\N	\N	\N	2026-01-31 21:37:01.749472+00
04666c09-1576-42ca-84eb-2d67260aa737	37d2704a-2d60-4f22-b133-b02aaabb03d6	user	Did you know I have a thermomix	\N	\N	\N	\N	2026-01-31 21:37:46.299602+00
ef4bf2a5-6dd2-47a7-a175-2b4545246345	37d2704a-2d60-4f22-b133-b02aaabb03d6	assistant	That's great! A Thermomix can make preparing these salads even easier and faster. You can use it to chop your vegetables, mix dressings, and even cook chicken or tofu. If you'd like, I can suggest specific instructions for using your Thermomix with the salad recipes. Just let me know!	\N	\N	\N	\N	2026-01-31 21:37:46.34685+00
abccef8d-44a3-479b-b868-0e7c45523c67	37d2704a-2d60-4f22-b133-b02aaabb03d6	user	Use it	\N	\N	\N	\N	2026-01-31 21:38:44.423783+00
22bde248-7101-4fca-917c-049ffe6778b0	37d2704a-2d60-4f22-b133-b02aaabb03d6	assistant	Here are the updated salad recipes with Thermomix instructions:\n\n1. **Quinoa Salad with Grilled Chicken and Sunflower Seeds**\n   - **Ingredients**: \n     - 200 g cooked quinoa\n     - 200 g grilled chicken (sliced)\n     - 100 g cherry tomatoes\n     - 100 g cucumber\n     - 100 g bell pepper\n     - 50 g red onion\n     - 30 g parsley\n     - 30 g sunflower seeds\n     - 30 ml olive oil\n     - 20 ml lemon juice\n     - Salt and pepper to taste\n   - **Instructions**:\n     1. Place cherry tomatoes, cucumber, bell pepper, red onion, and parsley in the Thermomix bowl. Chop for 5 seconds on speed 5.\n     2. Add cooked quinoa and sunflower seeds. Mix gently with the spatula.\n     3. In a separate bowl, combine olive oil, lemon juice, salt, and pepper. Pour over the salad and mix gently.\n\n2. **Chickpea Salad with Grilled Tofu and Pumpkin Seeds**\n   - **Ingredients**: \n     - 400 g canned chickpeas (drained)\n     - 200 g grilled tofu (cubed)\n     - 100 g cucumber\n     - 100 g bell pepper\n     - 50 g red onion\n     - 30 g parsley\n     - 30 g pumpkin seeds\n     - 30 ml olive oil\n     - 20 ml lemon juice\n     - Salt and cumin to taste\n   - **Instructions**:\n     1. Place cucumber, bell pepper, red onion, and parsley in the Thermomix bowl. Chop for 5 seconds on speed 5.\n     2. Add chickpeas, grilled tofu, and pumpkin seeds. Mix gently with the spatula.\n     3. In a separate bowl, combine olive oil, lemon juice, salt, and cumin. Pour over the salad and mix gently.\n\n3. **Spinach and Strawberry Salad with Grilled Chicken and Sunflower Seeds**\n   - **Ingredients**: \n     - 200 g fresh spinach\n     - 150 g sliced strawberries\n     - 200 g grilled chicken (sliced)\n     - 50 g walnuts\n     - 30 g sunflower seeds\n     - 50 g feta cheese\n     - 30 ml balsamic vinegar\n     - 30 ml olive oil\n   - **Instructions**:\n     1. Place spinach and strawberries in the Thermomix bowl. Chop for 3 seconds on speed 4.\n     2. Add sliced grilled chicken, walnuts, and sunflower seeds. Mix gently with the spatula.\n     3. In a separate bowl, combine balsamic vinegar and olive oil. Drizzle over the salad and sprinkle with feta cheese.\n\nEnjoy preparing your salads with your Thermomix! Here are some modification ideas:\n- **Make it spicier**: Add sliced jalapeños or a spicy dressing.\n- **Less dressing**: Reduce the amount of olive oil or vinegar used.\n- **Add more veggies**: Include avocado or shredded carrots for extra flavor.	{"customRecipe": {"tags": ["salad", "healthy", "chicken", "spinach"], "steps": [{"order": 1, "instruction": "In a bowl, combine the fresh spinach and sliced strawberries."}, {"order": 2, "instruction": "Slice the grilled chicken into strips and add to the salad."}, {"order": 3, "instruction": "Add the walnuts, sunflower seeds, and crumbled feta cheese to the bowl."}, {"order": 4, "instruction": "In a separate small bowl, whisk together the balsamic vinegar and olive oil."}, {"order": 5, "instruction": "Drizzle the dressing over the salad and toss gently to combine."}, {"order": 6, "instruction": "Serve immediately and enjoy!"}], "language": "en", "portions": 4, "totalTime": 15, "difficulty": "easy", "ingredients": [{"name": "fresh spinach", "unit": "grams", "quantity": 200}, {"name": "sliced strawberries", "unit": "grams", "quantity": 150}, {"name": "grilled chicken", "unit": "grams", "quantity": 300}, {"name": "walnuts", "unit": "grams", "quantity": 50}, {"name": "sunflower seeds", "unit": "grams", "quantity": 30}, {"name": "feta cheese", "unit": "grams", "quantity": 100}, {"name": "balsamic vinegar", "unit": "ml", "quantity": 30}, {"name": "olive oil", "unit": "ml", "quantity": 30}], "schemaVersion": "1.0", "suggestedName": "Grilled Chicken Spinach Salad with Strawberries and Feta", "measurementSystem": "metric"}}	\N	\N	\N	2026-01-31 21:38:44.471213+00
f8d87b90-a392-4aff-a722-8205c2a936a8	a66d7416-0c5d-4418-8291-ea9755695a21	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 17:26:08.580145+00
051335be-8bc3-42b8-a79b-854a17d7b3ad	a66d7416-0c5d-4418-8291-ea9755695a21	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:26:08.629609+00
c68c5dbc-c508-426b-a070-54a065fa7495	a66d7416-0c5d-4418-8291-ea9755695a21	user	How about a creative pasta dish?	\N	\N	\N	\N	2026-02-02 17:27:16.437944+00
6104e37a-4947-4258-808f-f7706cc5d128	a66d7416-0c5d-4418-8291-ea9755695a21	assistant	Here are three creative pasta dish ideas for you:\n\n1. **Pasta Primavera** - A colorful mix of seasonal vegetables tossed with pasta and a light garlic olive oil sauce. Perfect for a fresh and vibrant meal!\n\n2. **Pesto Pasta with Sun-Dried Tomatoes** - Toss your pasta with homemade or store-bought pesto and add sun-dried tomatoes for a burst of flavor and a touch of tanginess.\n\n3. **Creamy Mushroom Fettuccine** - A rich and creamy sauce made with sautéed mushrooms, garlic, and a hint of thyme, served over fettuccine for a comforting dish.\n\nWhich one sounds good to you?	{"recipes": []}	\N	\N	\N	2026-02-02 17:27:16.487657+00
30904f56-1957-4b0d-b172-4dc5b1fa14ff	884ef695-130f-4e4c-b649-106d14fb0f5e	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 17:31:23.722746+00
c20e3fbb-7243-46fa-8f80-0c870d976907	884ef695-130f-4e4c-b649-106d14fb0f5e	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:31:23.765481+00
8585969b-f91c-41c0-9ae1-ec774039ff76	884ef695-130f-4e4c-b649-106d14fb0f5e	user	Tell me about Pasta Primavera	\N	\N	\N	\N	2026-02-02 17:31:41.982847+00
77ff59f1-a2cb-4390-8bd2-690272324f52	884ef695-130f-4e4c-b649-106d14fb0f5e	assistant	Pasta Primavera is a vibrant and colorful dish featuring pasta tossed with fresh vegetables and a light sauce. It’s a perfect way to enjoy a variety of seasonal veggies, making it both delicious and healthy!\n\n### Ingredients:\n- Pasta (your choice, like spaghetti or penne)\n- Seasonal vegetables (like bell peppers, zucchini, carrots, and cherry tomatoes)\n- Olive oil\n- Garlic (minced)\n- Salt and pepper\n- Parmesan cheese (optional)\n- Fresh herbs (like basil or parsley)\n\n### Instructions:\n1. Cook the pasta according to package instructions.\n2. In a pan, heat olive oil and sauté minced garlic until fragrant. \n3. Add the chopped vegetables and cook until tender.\n4. Toss the cooked pasta with the sautéed vegetables, season with salt and pepper, and top with Parmesan and herbs if desired.\n\n### Suggestions:\n- Add protein: Consider adding grilled chicken or shrimp for extra protein.\n- Make it spicier: Toss in some red pepper flakes or a splash of hot sauce.\n- Simplify this: Use frozen mixed vegetables for a quicker prep.\n\nLet me know if you need more details or a different recipe!	{"recipes": []}	\N	\N	\N	2026-02-02 17:31:42.035233+00
a9d7931a-13d7-4024-9ef4-21a4d9d944c3	9826898f-c675-44d2-8723-54ee71ef36fe	user	Help me create a custom recipe	\N	\N	\N	\N	2026-02-02 17:44:56.077714+00
a3494ffb-eaa9-45f3-ab7a-311963228725	884ef695-130f-4e4c-b649-106d14fb0f5e	assistant	Great choice! Adding grilled chicken or shrimp will enhance the protein content and make your Pasta Primavera even more satisfying. Here’s how to incorporate them:\n\n### Grilled Chicken:\n- **Preparation**: Season chicken breasts with olive oil, salt, and pepper. Grill until cooked through (internal temperature should reach 75°C). Slice and toss with the pasta and vegetables before serving.\n\n### Grilled Shrimp:\n- **Preparation**: Marinate shrimp in olive oil, garlic, lemon juice, salt, and pepper. Grill until pink and opaque (about 2-3 minutes per side). Add to the pasta just before serving.\n\nThis addition will not only boost protein but also add delicious flavor to your dish! Enjoy your cooking! If you have any more questions or need further assistance, feel free to ask!	{"recipes": []}	\N	\N	\N	2026-02-02 17:32:08.305781+00
5c5843c0-0f80-445a-90de-bc1db6adeae6	884ef695-130f-4e4c-b649-106d14fb0f5e	user	Add gourmet touches to this recipe	\N	\N	\N	\N	2026-02-02 17:33:42.177207+00
08b9356c-a737-4d5b-a573-cb18544d1a65	884ef695-130f-4e4c-b649-106d14fb0f5e	assistant	Here are some gourmet touches to elevate your Pasta Primavera and impress your guests:\n\n### Gourmet Touches:\n- **Truffle Oil**: Drizzle a small amount of truffle oil on top just before serving for an earthy, luxurious flavor.\n- **Fresh Herbs**: Use fresh basil, parsley, or even tarragon to enhance the freshness. Consider making a herb oil to drizzle on top.\n- **Artisan Cheese**: Instead of regular Parmesan, try using Pecorino Romano or a sprinkle of burrata cheese for creaminess.\n- **Roasted Vegetables**: Roast your vegetables instead of sautéing them for a deeper flavor and a caramelized texture.\n- **Lemon Zest**: Add lemon zest to brighten the dish and enhance the flavors of the vegetables.\n- **Pine Nuts or Walnuts**: Toast some nuts to sprinkle on top for added crunch and richness.\n\nThese enhancements will turn your Pasta Primavera into a delightful gourmet experience! Enjoy creating your elevated dish! If you need more ideas or modifications, just let me know!	\N	\N	\N	\N	2026-02-02 17:33:42.255148+00
69d048a4-cece-4877-89d1-96f7ece96baa	884ef695-130f-4e4c-b649-106d14fb0f5e	user	Custom recipe	\N	\N	\N	\N	2026-02-02 17:34:18.613895+00
cb7f3e8a-7a54-4f90-8f10-56c2470667e3	884ef695-130f-4e4c-b649-106d14fb0f5e	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:34:18.669556+00
8579aa1a-b694-4681-b9a3-372ef761adf0	884ef695-130f-4e4c-b649-106d14fb0f5e	user	Chicken rice asparagus	\N	\N	\N	\N	2026-02-02 17:35:25.16257+00
8c69b59e-7e24-4986-873b-39eb5bac4f4b	884ef695-130f-4e4c-b649-106d14fb0f5e	assistant	Here's a custom recipe for **Chicken Rice with Asparagus** that's simple and delicious!\n\n### Ingredients:\n- 200 g chicken breast, diced\n- 150 g rice (white or brown)\n- 200 g asparagus, trimmed and cut into 2-3 cm pieces\n- 2 tablespoons olive oil\n- 2 cloves garlic, minced\n- 500 ml chicken broth (or water)\n- Salt and pepper to taste\n- Lemon wedges (for serving)\n- Fresh parsley (for garnish, optional)\n\n### Instructions:\n1. **Cook the Rice**: In a pot, bring the chicken broth to a boil. Add the rice, reduce heat to low, cover, and cook according to package instructions (about 15-20 minutes for white rice, longer for brown).\n   \n2. **Sauté the Chicken**: While the rice is cooking, heat 1 tablespoon of olive oil in a large skillet over medium heat. Add the diced chicken, season with salt and pepper, and cook until browned and fully cooked (internal temperature should reach 75°C). Remove and set aside.\n\n3. **Cook the Asparagus**: In the same skillet, add another tablespoon of olive oil and minced garlic. Sauté for about 1 minute, then add the asparagus. Cook until tender but still crisp, about 3-4 minutes.\n\n4. **Combine**: Add the cooked chicken and rice to the skillet with the asparagus. Stir to combine and heat through. Adjust seasoning if needed.\n\n5. **Serve**: Garnish with fresh parsley and serve with lemon wedges on the side for a fresh kick!\n\n### Suggestions:\n- **Make it spicier**: Add some red pepper flakes or a splash of hot sauce.\n- **Add more veggies**: Incorporate bell peppers or peas for extra color and nutrition.\n- **Make it a one-pan dish**: Cook everything in the same skillet by adding the rice after sautéing the chicken and asparagus, then add broth and cover to cook.\n\nEnjoy your Chicken Rice with Asparagus! If you need more modifications or have questions, feel free to ask!	{"customRecipe": {"tags": ["chicken", "rice", "asparagus", "Asian cuisine", "quick meal"], "steps": [{"order": 1, "instruction": "Rinse the rice under cold water until the water runs clear."}, {"order": 2, "instruction": "In a pot, combine the rinsed rice and 500 ml of water. Bring to a boil, then reduce heat to low, cover, and simmer for 15 minutes."}, {"order": 3, "instruction": "While the rice is cooking, slice the chicken breast into bite-sized pieces."}, {"order": 4, "instruction": "In a large frying pan or wok, heat 15 ml of sesame oil over medium-high heat."}, {"order": 5, "instruction": "Add minced garlic and grated ginger to the pan, and stir-fry for about 30 seconds until fragrant."}, {"order": 6, "instruction": "Add the chicken pieces to the pan and cook for 5-7 minutes until the chicken is browned and reaches an internal temperature of 75°C."}, {"order": 7, "instruction": "Add the asparagus to the pan and stir-fry for another 3-4 minutes until they are tender yet crisp."}, {"order": 8, "instruction": "Pour in the soy sauce and sprinkle black pepper over the chicken and asparagus mixture. Stir well to combine."}, {"order": 9, "instruction": "Once the rice is cooked, fluff it with a fork and serve it on plates."}, {"order": 10, "instruction": "Top the rice with the chicken and asparagus mixture and garnish with chopped spring onions."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 200}, {"name": "asparagus", "unit": "grams", "quantity": 250}, {"name": "soy sauce", "unit": "ml", "quantity": 60}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "sesame oil", "unit": "ml", "quantity": 15}, {"name": "spring onions", "unit": "pieces", "quantity": 2}, {"name": "black pepper", "unit": "gram", "quantity": 1}, {"name": "water", "unit": "ml", "quantity": 500}], "schemaVersion": "1.0", "suggestedName": "Asian Chicken with Rice and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 17:35:25.207369+00
15639426-291e-4979-9676-bf8639192441	884ef695-130f-4e4c-b649-106d14fb0f5e	user	Add some red pepper flakes or hot sauce.	\N	\N	\N	\N	2026-02-02 17:37:48.503015+00
1148de84-e5c9-4306-a53b-620924f103b5	884ef695-130f-4e4c-b649-106d14fb0f5e	assistant	Adding red pepper flakes or hot sauce will definitely give your Chicken Rice with Asparagus a nice kick! Here’s how to incorporate it:\n\n### Adjusted Cooking Steps:\n- **While Cooking Chicken**: After seasoning the diced chicken with salt and pepper, sprinkle in about 1/2 to 1 teaspoon of red pepper flakes based on your spice preference while it cooks. This will infuse the chicken with heat.\n  \n- **For Hot Sauce**: Instead of red pepper flakes, you can add a few dashes of your favorite hot sauce to the skillet right after adding the asparagus. Stir it in for a spicy flavor boost.\n\n### Serving Suggestion:\n- **Extra Spice**: Serve with additional hot sauce on the side for those who like it even spicier!\n\nThese adjustments will elevate the flavor of your dish beautifully! Enjoy your meal, and if you need anything else, just let me know!	\N	\N	\N	\N	2026-02-02 17:37:48.547079+00
8fa5991e-83da-4704-8424-3bea72ecef63	485e076b-138d-4e7a-9289-e1693b390a6d	user	What can I cook today?	\N	\N	\N	\N	2026-02-02 17:38:51.11471+00
b84d5f29-7444-411e-a061-1a27f5fc6896	485e076b-138d-4e7a-9289-e1693b390a6d	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:38:51.158357+00
ce8ae5f5-5b8c-4a7e-b5c5-b8cff121ce99	485e076b-138d-4e7a-9289-e1693b390a6d	user	Let me suggest a quick dinner recipe.	\N	\N	\N	\N	2026-02-02 17:38:58.106245+00
1d8c9ee3-fe89-4742-ae33-1e96d0bd183c	485e076b-138d-4e7a-9289-e1693b390a6d	assistant	What ingredients do you have?	{"recipes": []}	\N	\N	\N	2026-02-02 17:38:58.15135+00
84ad38b5-12ea-462e-9e9d-6db312784e06	485e076b-138d-4e7a-9289-e1693b390a6d	user	Suggest a chicken recipe	\N	\N	\N	\N	2026-02-02 17:39:14.63477+00
7b70e537-7348-42c9-b9e4-f8e19599a399	485e076b-138d-4e7a-9289-e1693b390a6d	assistant	Here are three delicious chicken recipes you can try:\n\n1. **Lemon Garlic Chicken**\n   - Marinate chicken breasts in lemon juice, minced garlic, olive oil, salt, and pepper. Bake at 200°C for 25-30 minutes.\n   \n2. **Chicken Stir-Fry**\n   - Sauté diced chicken with mixed vegetables, soy sauce, and ginger. Cook for 10-15 minutes until the chicken is done and serve over rice or noodles.\n\n3. **One-Pan Chicken and Vegetables**\n   - Place chicken thighs, potatoes, and seasonal veggies in a baking dish. Drizzle with olive oil, season, and roast at 200°C for 40 minutes.\n\nEnjoy your cooking! Here are some ideas to modify these recipes:\n\n- **Make it spicier**: Add chili flakes or hot sauce.\n- **Simplify this**: Use pre-cut vegetables or rotisserie chicken.\n- **Make it quicker**: Use a pressure cooker or air fryer for faster cooking.	{"recipes": []}	\N	\N	\N	2026-02-02 17:39:14.687947+00
5fbfbd00-7a3c-48ab-9dd9-95e27a49ba2b	485e076b-138d-4e7a-9289-e1693b390a6d	user	Custom recipe	\N	\N	\N	\N	2026-02-02 17:42:36.795633+00
68a29167-d4c2-45ec-9262-6c2ad5ecb6b4	485e076b-138d-4e7a-9289-e1693b390a6d	assistant	What ingredients do you want to use for your custom recipe?	\N	\N	\N	\N	2026-02-02 17:42:36.853952+00
c1a9cf36-4fc4-46b3-ace4-743127215ca4	485e076b-138d-4e7a-9289-e1693b390a6d	user	Let's create a recipe with chicken!	\N	\N	\N	\N	2026-02-02 17:42:59.894035+00
dea070db-308d-4bf9-a7eb-15e834806f36	485e076b-138d-4e7a-9289-e1693b390a6d	assistant	Here's a custom chicken recipe for you:\n\n### Spicy Honey Garlic Chicken\n\n#### Ingredients:\n- 500 g chicken thighs, boneless and skinless\n- 4 tablespoons honey\n- 3 cloves garlic, minced\n- 2 tablespoons soy sauce\n- 1 teaspoon chili flakes (adjust for spice level)\n- 2 tablespoons olive oil\n- Salt and pepper to taste\n- Fresh parsley for garnish (optional)\n\n#### Instructions:\n1. In a bowl, mix honey, minced garlic, soy sauce, chili flakes, salt, and pepper.\n2. Add the chicken thighs to the marinade and let it sit for at least 15 minutes.\n3. Heat olive oil in a skillet over medium heat. Add the marinated chicken and cook for 5-7 minutes on each side until fully cooked (internal temperature should reach 75°C).\n4. Pour any remaining marinade over the chicken and simmer for a few minutes until it thickens slightly.\n5. Garnish with fresh parsley and serve with rice or vegetables.\n\nEnjoy your homemade dish! Here are some modification suggestions:\n\n- **Make it spicier**: Increase the chili flakes or add fresh chili.\n- **Add protein**: Incorporate some cashews or almonds for crunch.\n- **Make it fancier**: Serve with a side of sautéed greens or a colorful salad.	{"customRecipe": {"tags": ["chicken", "quick", "dinner"], "steps": [{"order": 1, "instruction": "Heat olive oil in a large skillet over medium-high heat."}, {"order": 2, "instruction": "Season the chicken breasts with salt and black pepper."}, {"order": 3, "instruction": "Add the chicken breasts to the skillet and cook for 5-7 minutes on each side until golden brown and cooked through (internal temperature should reach 75°C)."}, {"order": 4, "instruction": "Meanwhile, mince the garlic and chop the fresh parsley."}, {"order": 5, "instruction": "Once the chicken is cooked, add the minced garlic to the skillet and sauté for 1 minute."}, {"order": 6, "instruction": "Remove from heat, sprinkle with fresh parsley, and serve immediately."}], "language": "en", "portions": 4, "totalTime": 20, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 600}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "garlic cloves", "unit": "cloves", "quantity": 3}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 3}, {"name": "fresh parsley", "unit": "grams", "quantity": 10}], "schemaVersion": "1.0", "suggestedName": "Quick Garlic Chicken", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 17:42:59.946012+00
d6bdc9ef-a898-4146-9c8d-cb6d8b9ab57f	9826898f-c675-44d2-8723-54ee71ef36fe	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 17:44:40.436723+00
5c386254-e1e1-44f0-9c40-c349d20dbf9d	9826898f-c675-44d2-8723-54ee71ef36fe	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:44:40.485126+00
e8a1ac4b-94c8-46e6-b30d-13bdad2a8eed	9826898f-c675-44d2-8723-54ee71ef36fe	user	Show me a quick dinner recipe	\N	\N	\N	\N	2026-02-02 17:44:46.048358+00
ddc616d3-ed48-45c7-ab54-6dfb37dd8c42	9826898f-c675-44d2-8723-54ee71ef36fe	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:45:16.593887+00
c8df3685-6c8b-4f8e-ab46-3481c1f4aade	9826898f-c675-44d2-8723-54ee71ef36fe	user	I have chicken	\N	\N	\N	\N	2026-02-02 17:45:41.647601+00
d6a11fa0-b2f1-4f30-9d05-e07222adee0e	9826898f-c675-44d2-8723-54ee71ef36fe	assistant	Here are three quick dinner recipes featuring chicken:\n\n1. **Garlic Butter Chicken Bites**\n   - Sauté bite-sized chicken pieces in butter and garlic until golden brown. Add parsley and serve with a side of veggies or rice.\n\n2. **One-Pan Chicken and Veggies**\n   - Toss chicken thighs with your favorite chopped vegetables (like bell peppers, zucchini, and carrots), olive oil, salt, and pepper. Bake at 200°C for 25-30 minutes.\n\n3. **Chicken Stir-Fry**\n   - Stir-fry sliced chicken breast with mixed vegetables (like broccoli, bell peppers, and carrots) in a hot pan with soy sauce and ginger for a quick and tasty meal.\n\nFeel free to ask for more details on any of these recipes! \n\nHere are some modification suggestions:\n- **Make it spicier**: Add chili flakes or fresh chili.\n- **Add protein**: Include tofu or nuts for extra protein.\n- **Make it quicker**: Use pre-cooked chicken or rotisserie chicken.	{"customRecipe": {"tags": ["chicken", "baked", "easy"], "steps": [{"order": 1, "instruction": "Preheat the oven to 200°C."}, {"order": 2, "instruction": "In a bowl, mix lemon juice, olive oil, minced garlic, salt, and black pepper."}, {"order": 3, "instruction": "Add the chicken thighs to the bowl and coat them well with the marinade."}, {"order": 4, "instruction": "Let the chicken marinate for at least 15 minutes."}, {"order": 5, "instruction": "Place the marinated chicken thighs in a baking dish."}, {"order": 6, "instruction": "Bake in the preheated oven for 25-30 minutes, or until the internal temperature of the chicken reaches 75°C."}, {"order": 7, "instruction": "Garnish with chopped fresh parsley before serving."}], "language": "en", "portions": 4, "totalTime": 45, "difficulty": "easy", "ingredients": [{"name": "chicken thighs", "unit": "grams", "quantity": 800}, {"name": "garlic cloves", "unit": "grams", "quantity": 4}, {"name": "lemon juice", "unit": "ml", "quantity": 60}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "fresh parsley", "unit": "grams", "quantity": 10}], "schemaVersion": "1.0", "suggestedName": "Garlic Lemon Chicken", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 17:45:41.700405+00
08a01bff-7e1c-42f3-90bb-dbcdd30e550c	88d46420-78c1-4032-82f8-249b0aeb4994	user	Quick 30-minute meal	\N	\N	\N	\N	2026-02-02 17:50:25.405791+00
f703f3fa-4a91-45ab-9173-56796f0b2e67	88d46420-78c1-4032-82f8-249b0aeb4994	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:50:25.460071+00
93ce5277-58eb-4db5-baa1-25d58c1fd0d3	88d46420-78c1-4032-82f8-249b0aeb4994	user	Chicken	\N	\N	\N	\N	2026-02-02 17:51:06.087421+00
c6d1ff4e-b9ef-4b11-8870-5af1af0ec110	88d46420-78c1-4032-82f8-249b0aeb4994	assistant	Great! Here are three quick chicken recipes you can whip up in 30 minutes or less:\n\n1. **Chicken Stir-Fry**  \n   - Sauté diced chicken in a hot pan with your choice of vegetables (like bell peppers, broccoli, and carrots) and soy sauce for flavor. Serve with rice or noodles.\n\n2. **Lemon Garlic Chicken**  \n   - Marinate chicken breasts in lemon juice, minced garlic, and herbs, then grill or pan-sear until cooked through (75°C internal temperature). Serve with a side salad.\n\n3. **Chicken Tacos**  \n   - Cook shredded chicken with taco seasoning, then serve in tortillas with toppings like avocado, salsa, and cheese.\n\nEnjoy your cooking! Let me know if you'd like modifications or more suggestions.	{"customRecipe": {"tags": ["healthy", "chicken", "quick meal"], "steps": [{"order": 1, "instruction": "Preheat a non-stick skillet over medium heat."}, {"order": 2, "instruction": "In a bowl, mix olive oil, minced garlic, lemon juice, salt, and black pepper."}, {"order": 3, "instruction": "Cut the chicken breast into thin fillets for quicker cooking."}, {"order": 4, "instruction": "Add the chicken fillets to the bowl and coat them with the marinade. Let it sit for 5 minutes."}, {"order": 5, "instruction": "Place the marinated chicken in the preheated skillet and cook for 6-7 minutes on each side until the internal temperature reaches 75°C."}, {"order": 6, "instruction": "Once cooked, remove from heat and let it rest for a few minutes."}, {"order": 7, "instruction": "Garnish with chopped fresh parsley before serving."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 600}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "fresh parsley", "unit": "grams", "quantity": 10}], "schemaVersion": "1.0", "suggestedName": "Healthy Lemon Garlic Chicken", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 17:51:06.137211+00
efa983dd-6590-4f7a-8665-3eb38f718383	88d46420-78c1-4032-82f8-249b0aeb4994	user	Tell me about Lemon Garlic Chicken	\N	\N	\N	\N	2026-02-02 17:53:09.937212+00
df736ec2-8c7c-4a19-a58e-68e744d2a6f9	88d46420-78c1-4032-82f8-249b0aeb4994	assistant	Here's a delicious and quick recipe for **Lemon Garlic Chicken**:\n\n### Ingredients:\n- 500g chicken breasts\n- 2 tablespoons olive oil\n- 2 cloves garlic, minced\n- Juice of 1 lemon\n- Zest of 1 lemon\n- Salt and pepper to taste\n- Fresh herbs (like parsley or thyme), optional for garnish\n\n### Instructions:\n1. **Marinate the Chicken**: In a bowl, mix olive oil, minced garlic, lemon juice, lemon zest, salt, and pepper. Add the chicken breasts, ensuring they're well-coated. Let marinate for at least 10 minutes.\n  \n2. **Cook the Chicken**: Heat a skillet over medium-high heat. Add the marinated chicken and cook for about 6-7 minutes per side, or until the chicken reaches an internal temperature of 75°C.\n\n3. **Serve**: Once cooked, let the chicken rest for a few minutes. Slice and serve with a sprinkle of fresh herbs if desired.\n\n### Suggestions for Modifications:\n- **Make it spicier**: Add red pepper flakes to the marinade.\n- **Add protein**: Serve with chickpeas or beans for extra protein.\n- **Make it quicker**: Use thinly sliced chicken breasts to reduce cooking time.\n\nEnjoy your flavorful meal! Let me know if you need anything else.	{"recipes": []}	\N	\N	\N	2026-02-02 17:53:09.991789+00
617dc00d-8299-4531-a2e1-8ff68375eeba	d9b24c00-fd78-4a57-87ed-c68066569ca2	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 17:56:13.603641+00
447c6d82-d710-4c5e-858e-54dc882d7088	d9b24c00-fd78-4a57-87ed-c68066569ca2	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 17:56:13.652884+00
47721d99-c138-4395-b1b9-17d60d97bd14	d9b24c00-fd78-4a57-87ed-c68066569ca2	user	Help me make a recipe I have chicken and asparagus	\N	\N	\N	\N	2026-02-02 17:58:23.695704+00
720d3023-4a12-4e67-b3f5-641a309bd9ce	d9b24c00-fd78-4a57-87ed-c68066569ca2	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "grilled", "healthy", "dinner"], "steps": [{"order": 1, "instruction": "Preheat the grill to medium-high heat (about 200°C)."}, {"order": 2, "instruction": "In a bowl, mix olive oil, minced garlic, lemon juice, salt, and black pepper."}, {"order": 3, "instruction": "Coat the chicken breasts with the marinade and let them sit for 10 minutes."}, {"order": 4, "instruction": "Place the chicken on the grill and cook for 6-7 minutes on each side, or until the internal temperature reaches 75°C."}, {"order": 5, "instruction": "While the chicken is grilling, trim the asparagus and drizzle with olive oil, salt, and pepper."}, {"order": 6, "instruction": "Add the asparagus to the grill during the last 5 minutes of cooking."}, {"order": 7, "instruction": "Remove chicken and asparagus from the grill and let the chicken rest for a few minutes before slicing."}, {"order": 8, "instruction": "Serve the grilled chicken with asparagus on the side."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 600}, {"name": "asparagus", "unit": "grams", "quantity": 400}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "garlic", "unit": "cloves", "quantity": 2}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "quantity": 15}], "usefulItems": [{"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cooking tongs", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cooking_tongs_1743787197002.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}], "schemaVersion": "1.0", "suggestedName": "Grilled Chicken with Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 17:58:23.744722+00
04b35bb5-54c8-4041-8979-61e0ba791eec	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Help me cook chicken and rice	\N	\N	\N	\N	2026-02-02 18:05:19.440976+00
0d1c1ba4-f67d-4d39-90cd-e36647718796	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	What ingredients do you have? 	\N	\N	\N	\N	2026-02-02 18:05:19.50377+00
97e18b40-7f55-43be-810a-0c3ea12e571f	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Chicken and rice	\N	\N	\N	\N	2026-02-02 18:05:45.875524+00
7d6a07aa-fded-4a79-b918-027c00a630a0	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "main course"], "steps": [{"order": 1, "instruction": "Heat olive oil in a large pot over medium heat."}, {"order": 2, "instruction": "Chop the onion and garlic, then sauté in the pot until translucent."}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the pot. Cook until the chicken is browned."}, {"order": 4, "instruction": "Add rice to the pot and stir for 1-2 minutes."}, {"order": 5, "instruction": "Pour in the chicken broth, season with salt, pepper, and paprika, and bring to a boil."}, {"order": 6, "instruction": "Reduce heat to low, cover, and let simmer for 20 minutes or until rice is cooked and chicken reaches an internal temperature of 75°C."}, {"order": 7, "instruction": "Remove from heat, fluff the rice with a fork, and garnish with chopped parsley before serving."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 250}, {"name": "onion", "unit": "piece", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 2}, {"name": "chicken broth", "unit": "ml", "quantity": 500}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "pepper", "unit": "grams", "quantity": 2}, {"name": "paprika", "unit": "grams", "quantity": 5}, {"name": "parsley", "unit": "grams", "quantity": 10}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:05:45.925732+00
be8dfaac-858a-4f1d-8101-1ba8cd971986	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Add spice	\N	\N	\N	\N	2026-02-02 18:06:23.467326+00
d4bc863c-71cc-4bf0-8812-9d5475f46072	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "spicy", "easy"], "steps": [{"order": 1, "instruction": "Heat the olive oil in a large skillet over medium heat."}, {"order": 2, "instruction": "Add the chopped onion and minced garlic; sauté until softened, about 3-4 minutes."}, {"order": 3, "instruction": "Season the chicken thighs with salt, black pepper, chili powder, and cumin."}, {"order": 4, "instruction": "Add the seasoned chicken to the skillet and cook until browned on all sides, about 5-7 minutes."}, {"order": 5, "instruction": "Stir in the rice and cook for 1-2 minutes, allowing it to absorb the flavors."}, {"order": 6, "instruction": "Pour the chicken broth into the skillet and bring to a boil."}, {"order": 7, "instruction": "Reduce heat to low, cover, and simmer for 20 minutes or until the rice is cooked and chicken reaches an internal temperature of 75°C."}, {"order": 8, "instruction": "Remove from heat and let it rest for 5 minutes before serving."}], "language": "en", "portions": 4, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken thighs", "unit": "grams", "quantity": 600}, {"name": "long-grain rice", "unit": "grams", "quantity": 250}, {"name": "onion", "unit": "medium", "quantity": 1}, {"name": "garlic cloves", "unit": "pieces", "quantity": 3}, {"name": "chili powder", "unit": "teaspoons", "quantity": 2}, {"name": "cumin", "unit": "teaspoon", "quantity": 1}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "chicken broth", "unit": "ml", "quantity": 600}, {"name": "salt", "unit": "teaspoon", "quantity": 1}, {"name": "black pepper", "unit": "teaspoon", "quantity": 1}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}], "schemaVersion": "1.0", "suggestedName": "Spicy Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:06:23.516929+00
5a431c10-6aab-4444-bf99-bc70880b3e45	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Faster version	\N	\N	\N	\N	2026-02-02 18:07:19.818754+00
1c12c623-7bb1-4a50-a4c4-557a92dbcc93	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "spicy", "quick meal"], "steps": [{"order": 1, "instruction": "Dice the chicken breast into bite-sized pieces."}, {"order": 2, "instruction": "Heat olive oil in a large pan over medium heat."}, {"order": 3, "instruction": "Add the diced chicken to the pan and season with salt, black pepper, and red chili flakes. Cook until browned, about 5 minutes."}, {"order": 4, "instruction": "Mince the garlic and add it to the pan, cooking for an additional minute until fragrant."}, {"order": 5, "instruction": "Chop the bell pepper and add it to the pan, stirring for 2 minutes."}, {"order": 6, "instruction": "Add the rice to the pan, stirring to combine with the chicken and vegetables."}, {"order": 7, "instruction": "Pour in the chicken broth and bring to a boil."}, {"order": 8, "instruction": "Reduce heat to low, cover the pan, and simmer for 10 minutes or until the rice is cooked and the liquid is absorbed."}, {"order": 9, "instruction": "Remove from heat, let it sit covered for 5 minutes, then fluff with a fork and serve."}], "language": "en", "portions": 4, "totalTime": 20, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 400}, {"name": "rice", "unit": "grams", "quantity": 200}, {"name": "chicken broth", "unit": "ml", "quantity": 500}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "red chili flakes", "unit": "teaspoons", "quantity": 2}, {"name": "bell pepper", "unit": "piece", "quantity": 1}, {"name": "salt", "unit": "teaspoon", "quantity": 1}, {"name": "black pepper", "unit": "teaspoon", "quantity": 1}], "usefulItems": [{"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}], "schemaVersion": "1.0", "suggestedName": "Spicy Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:07:19.867115+00
f2313fb6-8bee-4221-8d37-0dee280634a8	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Simplify	\N	\N	\N	\N	2026-02-02 18:07:51.642066+00
b985d9c5-c364-4efa-add6-3f1d49049fc0	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Here's your recipe! Want any changes?	\N	\N	\N	\N	2026-02-02 18:07:51.690537+00
a288b965-0f13-4490-abc5-7740a0209e6f	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Yes	\N	\N	\N	\N	2026-02-02 18:08:19.668271+00
0a40bc7f-06ec-4744-b010-d189837b2e77	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	What adjustments would you like?	\N	\N	\N	\N	2026-02-02 18:08:19.722129+00
7397df4a-f941-4590-8cbd-0d38d3a73942	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Where’s my recipe?	\N	\N	\N	\N	2026-02-02 18:08:45.094246+00
0eeef0ed-fd76-4e0b-9a54-7a7e54a6ff27	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "easy", "one-pan"], "steps": [{"order": 1, "instruction": "Heat the olive oil in a large pan over medium heat."}, {"order": 2, "instruction": "Season the chicken breasts with salt and pepper."}, {"order": 3, "instruction": "Add the chicken to the pan and cook for about 6-7 minutes on each side until the internal temperature reaches 75°C."}, {"order": 4, "instruction": "Remove the chicken from the pan and set aside."}, {"order": 5, "instruction": "In the same pan, add the rice and stir for 1 minute."}, {"order": 6, "instruction": "Add the water and bring to a boil."}, {"order": 7, "instruction": "Reduce heat to low, cover, and simmer for 15 minutes or until the rice is cooked."}, {"order": 8, "instruction": "Slice the chicken and serve it over the rice."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 200}, {"name": "water", "unit": "ml", "quantity": 500}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "pepper", "unit": "grams", "quantity": 2}, {"name": "olive oil", "unit": "ml", "quantity": 15}], "usefulItems": [{"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}], "schemaVersion": "1.0", "suggestedName": "Simple Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:08:45.140752+00
d7a15d96-4a0d-40ea-9e21-29533a7ec0ee	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Make fancier	\N	\N	\N	\N	2026-02-02 18:08:52.419347+00
e36ab831-292d-474e-bc98-abfc4c1daec9	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Here's your recipe! Want any changes?	\N	\N	\N	\N	2026-02-02 18:08:52.465079+00
07735ca5-45da-4173-ac01-9e1c03a2fdf5	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Add spice	\N	\N	\N	\N	2026-02-02 18:09:11.206195+00
c19d9ee4-68c2-4288-9ca8-6c2a7364545e	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Here's your recipe! Want any changes?	\N	\N	\N	\N	2026-02-02 18:09:11.250122+00
5fe5d4b0-bcae-440a-99a7-ad172965ebae	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Help me cook chicken and rice	\N	\N	\N	\N	2026-02-02 18:14:15.134337+00
5e2906a7-b36a-4e44-905b-c4f595e6d27c	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 18:14:15.183735+00
e86c5a70-674a-49d5-9bf0-c20ba68a2794	117892ef-5fd3-4b7c-abb3-635ccc92d029	user	Chicken and rice	\N	\N	\N	\N	2026-02-02 18:14:45.97973+00
c6db53cc-5189-41d6-afde-28d5f78ae8d5	117892ef-5fd3-4b7c-abb3-635ccc92d029	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "easy", "meal"], "steps": [{"order": 1, "instruction": "Rinse the rice under cold water until the water runs clear."}, {"order": 2, "instruction": "In a pot, heat 15 ml of olive oil over medium heat."}, {"order": 3, "instruction": "Add the rinsed rice and toast for about 2 minutes, stirring frequently."}, {"order": 4, "instruction": "Add 500 ml of water, 5 grams of salt, and bring to a boil."}, {"order": 5, "instruction": "Once boiling, reduce the heat to low, cover, and cook for 15 minutes."}, {"order": 6, "instruction": "While the rice is cooking, season the chicken breast with salt and pepper."}, {"order": 7, "instruction": "In a frying pan, heat the remaining 15 ml of olive oil over medium-high heat."}, {"order": 8, "instruction": "Add the chicken breast and cook for about 6-7 minutes on each side, or until the internal temperature reaches 75°C."}, {"order": 9, "instruction": "Once the chicken is cooked, remove from heat and let it rest for 5 minutes."}, {"order": 10, "instruction": "Fluff the rice with a fork and serve with sliced chicken on top."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 200}, {"name": "water", "unit": "ml", "quantity": 500}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "pepper", "unit": "grams", "quantity": 2}, {"name": "olive oil", "unit": "ml", "quantity": 30}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Chicken and rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:14:46.060042+00
6a7afce3-db9e-407b-ae7b-0662cb880c69	34364611-be5c-4f7a-aa3b-d02365affcfd	user	Help me to cook chicken and rice	\N	\N	\N	\N	2026-02-02 18:18:17.037971+00
69693bf5-cb97-43db-b1a7-26c914553c77	34364611-be5c-4f7a-aa3b-d02365affcfd	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 18:18:17.089948+00
2a4b3d6c-0e35-45ed-a6ee-e781679b5d03	34364611-be5c-4f7a-aa3b-d02365affcfd	user	Chicken and rice	\N	\N	\N	\N	2026-02-02 18:18:38.42582+00
e69a17f7-dde2-47c3-9acd-8eec696fa5f7	34364611-be5c-4f7a-aa3b-d02365affcfd	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "asian", "easy"], "steps": [{"order": 1, "instruction": "Rinse the rice under cold water until the water runs clear."}, {"order": 2, "instruction": "In a pot, combine the rice and 400 ml of water. Bring to a boil, then reduce heat to low, cover, and simmer for 15 minutes or until the rice is cooked."}, {"order": 3, "instruction": "While the rice is cooking, cut the chicken breast into bite-sized pieces."}, {"order": 4, "instruction": "Mince the garlic and ginger, and slice the scallions."}, {"order": 5, "instruction": "In a large skillet, heat the vegetable oil over medium-high heat."}, {"order": 6, "instruction": "Add the chicken pieces and cook for about 5-7 minutes until the chicken is browned and cooked through (internal temperature should reach 75°C)."}, {"order": 7, "instruction": "Add the minced garlic, ginger, and soy sauce to the skillet. Stir and cook for an additional 2 minutes."}, {"order": 8, "instruction": "Serve the chicken over the cooked rice and garnish with sliced scallions."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 200}, {"name": "soy sauce", "unit": "ml", "quantity": 60}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "scallions", "unit": "pieces", "quantity": 2}, {"name": "vegetable oil", "unit": "ml", "quantity": 30}, {"name": "water", "unit": "ml", "quantity": 400}], "usefulItems": [{"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}], "schemaVersion": "1.0", "suggestedName": "Asian Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:18:38.482495+00
0f1bb48f-28ab-4652-80b0-8ce756988102	ccf48576-32dc-4bcc-a43d-4639b81cccb6	user	Help me cook something	\N	\N	\N	\N	2026-02-02 18:23:54.327926+00
1fc0b42d-7069-4a04-8673-fe5c9da5bfa9	ccf48576-32dc-4bcc-a43d-4639b81cccb6	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 18:23:54.377176+00
165d60df-46ec-4343-b0f1-9bb953d12503	ccf48576-32dc-4bcc-a43d-4639b81cccb6	user	I have chicken and rice	\N	\N	\N	\N	2026-02-02 18:24:14.904014+00
3e388d29-890e-45cc-8292-41e89ef03cb6	ccf48576-32dc-4bcc-a43d-4639b81cccb6	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "casserole", "easy"], "steps": [{"order": 1, "instruction": "Preheat the oven to 180°C."}, {"order": 2, "instruction": "In a large skillet, heat olive oil over medium heat."}, {"order": 3, "instruction": "Chop the onion and garlic, then sauté in the skillet until softened."}, {"order": 4, "instruction": "Cut the chicken breast into bite-sized pieces and add to the skillet."}, {"order": 5, "instruction": "Season with salt, black pepper, and paprika, cooking until the chicken is browned."}, {"order": 6, "instruction": "Stir in the rice and chicken broth, bringing the mixture to a boil."}, {"order": 7, "instruction": "Transfer the mixture to a baking dish and cover with foil."}, {"order": 8, "instruction": "Bake in the preheated oven for 25 minutes, or until the chicken is cooked through (internal temperature of 75°C) and rice is tender."}, {"order": 9, "instruction": "Remove from the oven and let it sit for 5 minutes before serving."}], "language": "en", "portions": 4, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "long-grain rice", "unit": "grams", "quantity": 200}, {"name": "chicken broth", "unit": "ml", "quantity": 500}, {"name": "onion", "unit": "piece", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 2}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "paprika", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Chicken and Rice Casserole", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:24:14.959523+00
28400825-ce69-4ef9-9211-22fa31d8d1c6	ccf48576-32dc-4bcc-a43d-4639b81cccb6	user	Yes add aspar	\N	\N	\N	\N	2026-02-02 18:27:51.22825+00
35b65794-909d-4d09-b270-bb8a58432aa3	ccf48576-32dc-4bcc-a43d-4639b81cccb6	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "one-pan", "quick meal", "healthy"], "steps": [{"order": 1, "instruction": "Heat the olive oil in a large skillet over medium heat."}, {"order": 2, "instruction": "Dice the onion and mince the garlic, then add them to the skillet. Sauté until the onion is translucent, about 5 minutes."}, {"order": 3, "instruction": "While the onion and garlic are cooking, season the chicken breast with salt, black pepper, and paprika."}, {"order": 4, "instruction": "Add the seasoned chicken breast to the skillet and cook for about 6-7 minutes on each side, until cooked through (internal temperature should reach 75°C)."}, {"order": 5, "instruction": "Remove the chicken from the skillet and set aside. In the same skillet, add the long-grain rice and stir for 1-2 minutes."}, {"order": 6, "instruction": "Pour in the chicken broth and bring to a boil, then reduce the heat to low, cover, and simmer for 15 minutes."}, {"order": 7, "instruction": "While the rice is cooking, trim the asparagus and steam or boil until tender, about 5-7 minutes."}, {"order": 8, "instruction": "Once the rice is cooked, return the chicken to the skillet, cover, and let it rest for 5 minutes."}, {"order": 9, "instruction": "Serve the chicken on a bed of rice with asparagus on the side."}], "language": "en", "portions": 4, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 600}, {"name": "long-grain rice", "unit": "grams", "quantity": 250}, {"name": "chicken broth", "unit": "ml", "quantity": 750}, {"name": "onion", "unit": "medium", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "paprika", "unit": "grams", "quantity": 10}, {"name": "asparagus", "unit": "grams", "quantity": 200}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}], "schemaVersion": "1.0", "suggestedName": "Paprika Chicken with Rice and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:27:51.306229+00
b4104772-7820-4c96-b7f1-3e0cc6997941	f8d07fa1-4fe0-4311-866d-b17929572ca1	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 18:30:09.895359+00
28408668-c8c8-4858-a306-fcf440cfb472	f8d07fa1-4fe0-4311-866d-b17929572ca1	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 18:30:09.938322+00
6083cde0-cf17-4677-aaed-aa486a3c4385	f8d07fa1-4fe0-4311-866d-b17929572ca1	user	Chicken and rice	\N	\N	\N	\N	2026-02-02 18:30:35.070554+00
352ec0dc-76b9-4aac-bf75-5e126468a23c	f8d07fa1-4fe0-4311-866d-b17929572ca1	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "asian", "easy"], "steps": [{"order": 1, "instruction": "Heat the vegetable oil in a large skillet over medium-high heat."}, {"order": 2, "instruction": "Add minced ginger and garlic, sauté for 1-2 minutes until fragrant."}, {"order": 3, "instruction": "Add the chicken thighs to the skillet, cooking them for about 5-7 minutes on each side until golden brown and reaching an internal temperature of 75°C."}, {"order": 4, "instruction": "Remove the chicken from the skillet and set aside."}, {"order": 5, "instruction": "In the same skillet, add the jasmine rice and stir to coat it in the oil."}, {"order": 6, "instruction": "Pour in the water and soy sauce, then bring to a boil."}, {"order": 7, "instruction": "Reduce heat to low, cover, and simmer for about 15 minutes, or until the rice is cooked and water is absorbed."}, {"order": 8, "instruction": "Return the chicken to the skillet, cover, and let it steam with the rice for an additional 5 minutes."}, {"order": 9, "instruction": "Serve the chicken on top of the rice, garnished with chopped green onions and sesame seeds."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken thighs", "unit": "grams", "quantity": 600}, {"name": "jasmine rice", "unit": "grams", "quantity": 300}, {"name": "soy sauce", "unit": "ml", "quantity": 60}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "garlic", "unit": "cloves", "quantity": 4}, {"name": "green onions", "unit": "grams", "quantity": 50}, {"name": "vegetable oil", "unit": "ml", "quantity": 30}, {"name": "water", "unit": "ml", "quantity": 600}, {"name": "sesame seeds", "unit": "grams", "quantity": 10}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}], "schemaVersion": "1.0", "suggestedName": "Asian Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:30:35.118793+00
22d81a8d-f415-471d-9ba7-1a944c96ee63	f8d07fa1-4fe0-4311-866d-b17929572ca1	user	Add vegetables	\N	\N	\N	\N	2026-02-02 18:31:50.785563+00
2be76d72-6784-4e6b-b63c-7ba70db25cc0	f8d07fa1-4fe0-4311-866d-b17929572ca1	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "quick meal", "asian"], "steps": [{"order": 1, "instruction": "Heat the vegetable oil in a large skillet over medium heat."}, {"order": 2, "instruction": "Add minced ginger and garlic to the skillet and sauté for 1 minute until fragrant."}, {"order": 3, "instruction": "Add chicken thighs to the skillet, cooking until browned on both sides, about 5-7 minutes."}, {"order": 4, "instruction": "Pour in the soy sauce and add the mixed vegetables, stirring to combine."}, {"order": 5, "instruction": "Cover and cook for an additional 10 minutes, or until chicken reaches an internal temperature of 75°C."}, {"order": 6, "instruction": "While the chicken is cooking, rinse the jasmine rice under cold water."}, {"order": 7, "instruction": "In a separate pot, bring 500 ml of water to a boil, then add the rice."}, {"order": 8, "instruction": "Reduce heat to low, cover, and simmer for 10-12 minutes until rice is cooked and water is absorbed."}, {"order": 9, "instruction": "Fluff the rice with a fork and let it sit for a few minutes."}, {"order": 10, "instruction": "Serve the chicken and vegetables over the jasmine rice, garnished with chopped green onions and sesame seeds."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken thighs", "unit": "grams", "quantity": 600}, {"name": "jasmine rice", "unit": "grams", "quantity": 250}, {"name": "soy sauce", "unit": "ml", "quantity": 60}, {"name": "ginger", "unit": "grams", "quantity": 15}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "green onions", "unit": "stalks", "quantity": 4}, {"name": "vegetable oil", "unit": "ml", "quantity": 30}, {"name": "water", "unit": "ml", "quantity": 500}, {"name": "sesame seeds", "unit": "grams", "quantity": 15}, {"name": "mixed vegetables (carrots, peas)", "unit": "grams", "quantity": 200}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Ginger Soy Chicken with Jasmine Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:31:50.855893+00
edc04066-2ac1-4311-bceb-25250d6cdd82	f8d07fa1-4fe0-4311-866d-b17929572ca1	user	Make it fastee	\N	\N	\N	\N	2026-02-02 18:38:37.861497+00
ed035fd0-a37a-4694-abb7-86799102f782	f8d07fa1-4fe0-4311-866d-b17929572ca1	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "quick", "dinner", "rice"], "steps": [{"order": 1, "instruction": "Begin by washing the jasmine rice under cold water until the water runs clear."}, {"order": 2, "instruction": "In a pot, combine the washed jasmine rice with 400 ml of water. Bring to a boil, then reduce to low heat, cover, and cook for 10-12 minutes."}, {"order": 3, "instruction": "While the rice is cooking, cut the chicken thighs into bite-sized pieces and season with salt."}, {"order": 4, "instruction": "Heat 30 ml of vegetable oil in a large pan over medium-high heat. Add the chicken and cook for about 5-7 minutes until browned and cooked through, reaching an internal temperature of 75°C."}, {"order": 5, "instruction": "Finely chop the ginger and garlic. Add them to the pan with the chicken and stir for 1 minute until fragrant."}, {"order": 6, "instruction": "Pour in 60 ml of soy sauce and add the mixed vegetables. Stir well and cook for an additional 3-4 minutes."}, {"order": 7, "instruction": "Slice the green onions and sprinkle half of them over the chicken mixture and reserve the rest for garnish."}, {"order": 8, "instruction": "Once the rice is done, fluff it with a fork and serve it on plates."}, {"order": 9, "instruction": "Top the rice with the ginger soy chicken and vegetable mixture, then sprinkle with sesame seeds and the remaining green onions."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken thighs", "unit": "grams", "quantity": 600}, {"name": "jasmine rice", "unit": "grams", "quantity": 200}, {"name": "soy sauce", "unit": "ml", "quantity": 60}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "green onions", "unit": "stalks", "quantity": 4}, {"name": "vegetable oil", "unit": "ml", "quantity": 30}, {"name": "water", "unit": "ml", "quantity": 400}, {"name": "sesame seeds", "unit": "grams", "quantity": 15}, {"name": "mixed vegetables (carrots, peas)", "unit": "grams", "quantity": 200}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}], "schemaVersion": "1.0", "suggestedName": "Quick Ginger Soy Chicken with Jasmine Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:38:37.909033+00
b7c0bc7d-dcf2-447a-8e59-ab4600f94968	37e71e0e-babe-46dd-8afd-99979bd24389	user	Help me make a recipe with chicken and rice	\N	\N	\N	\N	2026-02-02 18:40:04.025222+00
5d7d2333-2cde-4603-9588-76ba8668b023	37e71e0e-babe-46dd-8afd-99979bd24389	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "one-pot", "dinner"], "steps": [{"order": 1, "instruction": "Heat the olive oil in a large pan over medium heat."}, {"order": 2, "instruction": "Chop the onion and garlic, then sauté them in the pan until softened."}, {"order": 3, "instruction": "Add the chicken breast to the pan and season with salt, pepper, and paprika. Cook until the chicken is golden brown on all sides."}, {"order": 4, "instruction": "Pour in the chicken broth and bring it to a boil."}, {"order": 5, "instruction": "Add the rice to the boiling broth, reduce the heat to low, and cover the pan. Cook for 18-20 minutes, or until the rice is tender and has absorbed the liquid."}, {"order": 6, "instruction": "Once cooked, remove from heat and let it sit covered for 5 minutes."}, {"order": 7, "instruction": "Fluff the rice with a fork and stir in chopped parsley before serving."}], "language": "en", "portions": 4, "totalTime": 35, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 200}, {"name": "onion", "unit": "whole", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 2}, {"name": "chicken broth", "unit": "ml", "quantity": 600}, {"name": "olive oil", "unit": "tablespoons", "quantity": 2}, {"name": "salt", "unit": "teaspoon", "quantity": 1}, {"name": "pepper", "unit": "teaspoon", "quantity": 1}, {"name": "paprika", "unit": "teaspoon", "quantity": 1}, {"name": "parsley", "unit": "grams", "quantity": 10}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:40:04.07646+00
e068ab83-77ee-455b-8d52-b16ec805ce8b	37e71e0e-babe-46dd-8afd-99979bd24389	user	Start cooking	\N	\N	\N	\N	2026-02-02 18:40:24.130829+00
8e55c08c-e42e-4403-9e3a-527311b99166	37e71e0e-babe-46dd-8afd-99979bd24389	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "quick meal", "easy"], "steps": [{"order": 1, "instruction": "Heat the olive oil in a large pan over medium heat."}, {"order": 2, "instruction": "Cut the chicken breast into bite-sized pieces and season with salt, pepper, garlic powder, and thyme."}, {"order": 3, "instruction": "Add the chicken to the pan and cook for about 5-7 minutes until browned and cooked through (internal temperature should reach 75°C)."}, {"order": 4, "instruction": "Remove the chicken from the pan and set aside."}, {"order": 5, "instruction": "In the same pan, add the rice and stir for 1-2 minutes."}, {"order": 6, "instruction": "Pour in the chicken broth, bring to a boil, then reduce heat to low and cover."}, {"order": 7, "instruction": "Cook for 15 minutes or until the rice is tender and liquid is absorbed."}, {"order": 8, "instruction": "Return the chicken to the pan, fluff the rice with a fork, and mix everything together."}, {"order": 9, "instruction": "Serve hot and enjoy your easy chicken and rice!"}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "long-grain rice", "unit": "grams", "quantity": 200}, {"name": "chicken broth", "unit": "ml", "quantity": 500}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "pepper", "unit": "grams", "quantity": 2}, {"name": "garlic powder", "unit": "grams", "quantity": 3}, {"name": "dried thyme", "unit": "grams", "quantity": 3}], "usefulItems": [{"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spatula_1743787718709.png"}, {"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}, {"name": "Thermomix® spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_spatula_1743787839523.png"}], "schemaVersion": "1.0", "suggestedName": "Easy Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:40:24.20155+00
48110756-3358-41bd-b213-238f02599f12	18abf32f-f0b6-4d46-919a-964e1b1356fd	user	Help me cook chicken and rice	\N	\N	\N	\N	2026-02-02 18:42:24.937136+00
1b654178-f48f-490d-8ea7-87c24acce15e	18abf32f-f0b6-4d46-919a-964e1b1356fd	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 18:42:25.073065+00
be572f1d-ba04-40eb-baa6-f76a81a6ec77	18abf32f-f0b6-4d46-919a-964e1b1356fd	user	Chicken and rice	\N	\N	\N	\N	2026-02-02 18:43:01.62888+00
4392a40c-fc7c-400d-b541-c2b961d00dca	18abf32f-f0b6-4d46-919a-964e1b1356fd	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "main course"], "steps": [{"order": 1, "instruction": "Heat the olive oil in a large pot over medium heat."}, {"order": 2, "instruction": "Chop the onion and garlic, then add them to the pot and sauté until softened."}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and season with salt, black pepper, and paprika."}, {"order": 4, "instruction": "Add the chicken to the pot and cook until browned on all sides, about 5-7 minutes."}, {"order": 5, "instruction": "Stir in the rice and cook for 1-2 minutes until lightly toasted."}, {"order": 6, "instruction": "Pour in the chicken broth and bring to a boil."}, {"order": 7, "instruction": "Reduce the heat to low, cover, and simmer for 20 minutes or until the rice is cooked and has absorbed the liquid."}, {"order": 8, "instruction": "Remove from heat, fluff the rice with a fork, and stir in chopped parsley."}, {"order": 9, "instruction": "Check the chicken's internal temperature; it should reach 75°C. Serve hot."}], "language": "en", "portions": 4, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 600}, {"name": "long-grain rice", "unit": "grams", "quantity": 300}, {"name": "chicken broth", "unit": "ml", "quantity": 750}, {"name": "onion", "unit": "piece", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "paprika", "unit": "grams", "quantity": 5}, {"name": "parsley", "unit": "grams", "quantity": 10}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:43:01.698365+00
a4f42f3d-c689-46a1-ab2a-2aa3880dd78b	18abf32f-f0b6-4d46-919a-964e1b1356fd	user	Make it vegetarian	\N	\N	\N	\N	2026-02-02 18:43:28.769151+00
89d72a17-7b7f-4650-91a9-53ffc4111825	18abf32f-f0b6-4d46-919a-964e1b1356fd	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["vegetarian", "easy", "rice dish"], "steps": [{"order": 1, "instruction": "Press the tofu for 15 minutes to remove excess moisture, then cut into cubes."}, {"order": 2, "instruction": "Heat olive oil in a large pan over medium heat. Add the chopped onion and garlic, sauté until softened."}, {"order": 3, "instruction": "Add the cubed tofu to the pan and cook until golden brown on all sides."}, {"order": 4, "instruction": "Stir in the rice, vegetable broth, salt, black pepper, and paprika. Bring to a boil."}, {"order": 5, "instruction": "Reduce heat to low, cover the pan, and simmer for about 15-20 minutes or until the rice is cooked and liquid is absorbed."}, {"order": 6, "instruction": "Remove from heat and let sit covered for 5 minutes. Fluff the rice with a fork."}, {"order": 7, "instruction": "Chop fresh parsley and sprinkle over the top before serving."}], "language": "en", "portions": 4, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "firm tofu", "unit": "grams", "quantity": 400}, {"name": "long-grain rice", "unit": "grams", "quantity": 250}, {"name": "vegetable broth", "unit": "ml", "quantity": 750}, {"name": "onion", "unit": "medium", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "paprika", "unit": "grams", "quantity": 5}, {"name": "fresh parsley", "unit": "grams", "quantity": 15}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Vegetarian Rice Pilaf with Tofu", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:43:28.814071+00
6ed963a7-171d-44ce-8879-04eed5bf083d	6f4402fb-4672-415a-92f4-fa012cf2f458	user	Help me cook chicken and rice	\N	\N	\N	\N	2026-02-02 18:46:09.139403+00
beda11db-aabc-4894-885c-bec6f91e9826	6f4402fb-4672-415a-92f4-fa012cf2f458	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "rice", "main course", "easy"], "steps": [{"order": 1, "instruction": "Heat the olive oil in a large pan over medium heat."}, {"order": 2, "instruction": "Chop the onion and garlic, then add them to the pan. Sauté until the onion is translucent."}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the pan. Cook until the chicken is browned and cooked through (internal temperature should reach 75°C)."}, {"order": 4, "instruction": "Add the rice to the pan and stir for 1-2 minutes."}, {"order": 5, "instruction": "Pour in the chicken broth and add salt, black pepper, and paprika. Bring to a boil."}, {"order": 6, "instruction": "Reduce the heat to low, cover the pan, and let it simmer for about 20 minutes or until the rice is cooked and has absorbed the liquid."}, {"order": 7, "instruction": "Fluff the rice with a fork and garnish with chopped parsley before serving."}], "language": "en", "portions": 4, "totalTime": 35, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 250}, {"name": "chicken broth", "unit": "ml", "quantity": 500}, {"name": "onion", "unit": "piece", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 3}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "paprika", "unit": "grams", "quantity": 5}, {"name": "parsley", "unit": "grams", "quantity": 10}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:46:09.182099+00
c98ca00a-833a-41b0-b1bb-bbee652e9885	6f4402fb-4672-415a-92f4-fa012cf2f458	user	Make it spicier	\N	\N	\N	\N	2026-02-02 18:47:03.484149+00
4d5dc504-d2a7-4966-aaa7-74977f468313	6f4402fb-4672-415a-92f4-fa012cf2f458	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["chicken", "spicy", "one-pan", "quick"], "steps": [{"order": 1, "instruction": "Dice the onion and mince the garlic."}, {"order": 2, "instruction": "In a large pan, heat the olive oil over medium heat."}, {"order": 3, "instruction": "Add the diced onion and cook until translucent, about 3 minutes."}, {"order": 4, "instruction": "Add the minced garlic and sauté for an additional minute."}, {"order": 5, "instruction": "Cut the chicken breast into bite-sized pieces, season with salt, black pepper, paprika, and red chili flakes."}, {"order": 6, "instruction": "Increase the heat to medium-high and add the chicken to the pan. Cook until browned, about 5 minutes."}, {"order": 7, "instruction": "Stir in the rice and cook for 1-2 minutes to toast it lightly."}, {"order": 8, "instruction": "Pour in the chicken broth and bring to a boil."}, {"order": 9, "instruction": "Reduce the heat to low, cover, and simmer for 15-20 minutes, or until the rice is cooked and the liquid is absorbed."}, {"order": 10, "instruction": "Remove from heat and let it sit covered for 5 minutes."}, {"order": 11, "instruction": "Fluff the rice with a fork and stir in chopped parsley before serving."}], "language": "en", "portions": 4, "totalTime": 35, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 500}, {"name": "rice", "unit": "grams", "quantity": 200}, {"name": "chicken broth", "unit": "ml", "quantity": 500}, {"name": "onion", "unit": "medium", "quantity": 1}, {"name": "garlic", "unit": "cloves", "quantity": 4}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 5}, {"name": "paprika", "unit": "grams", "quantity": 10}, {"name": "parsley", "unit": "grams", "quantity": 15}, {"name": "red chili flakes", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Spicy Chicken and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 18:47:03.537163+00
f1b045ee-c6e4-447e-bd81-d152f3f5bf0e	47bfbaaf-4994-4f9b-8717-29aca6b48e7b	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 19:25:38.440369+00
fa7498f8-dfd0-49f0-b094-eb93f288feea	47bfbaaf-4994-4f9b-8717-29aca6b48e7b	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 19:25:38.497907+00
bd6bc98b-9e01-487a-a473-012ba6e7b919	47bfbaaf-4994-4f9b-8717-29aca6b48e7b	user	Chicken	\N	\N	\N	\N	2026-02-02 19:25:48.805268+00
20ba51c0-587f-46fe-9d76-9e9d50a7bbc4	47bfbaaf-4994-4f9b-8717-29aca6b48e7b	assistant	Here are three chicken recipes for you:\n\n1. **Mediterranean Chicken Skewers**\n2. **Air Fryer Chicken Thighs**\n3. **Lemon Herb Chicken Breast**\n\nLet me know if you'd like to create a custom recipe!	{"recipes": []}	\N	\N	\N	2026-02-02 19:25:48.857777+00
23cb35ba-c44a-443d-8572-47cf886cec20	a480f04b-c36f-41eb-b7ed-eb44280d7cce	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 19:32:50.16569+00
25db513e-cc3b-450e-9489-9ce4bc9438b6	a480f04b-c36f-41eb-b7ed-eb44280d7cce	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 19:32:50.25794+00
770ed26a-0c7c-4ed6-af8b-3ec9c169ff96	f39118e8-da36-426b-b2c5-3f635192e992	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 19:36:07.204235+00
50df7d91-887c-49c1-bc4a-c8025e57ce40	f39118e8-da36-426b-b2c5-3f635192e992	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 19:36:07.255843+00
41d2b738-821d-473a-b3db-ee6732e7608a	f39118e8-da36-426b-b2c5-3f635192e992	user	Chicken	\N	\N	\N	\N	2026-02-02 19:36:30.725151+00
1338aacc-c44b-4c00-9018-73deb184b247	f39118e8-da36-426b-b2c5-3f635192e992	assistant	Here are three delicious chicken recipes you might enjoy:\n\n1. **Mediterranean Grilled Chicken** - Marinated chicken breast grilled to perfection, served with a side of fresh salad.\n2. **Chicken Stir Fry** - Quick stir-fried chicken with colorful vegetables, tossed in a light sauce.\n3. **Air Fryer Chicken Thighs** - Crispy air-fried chicken thighs seasoned with herbs and spices.\n\nWhat do you think?	{"recipes": []}	\N	\N	\N	2026-02-02 19:36:30.777857+00
ed26d5c3-89c9-4b0b-b4c8-b662417a6a39	f39118e8-da36-426b-b2c5-3f635192e992	user	Custom recipe	\N	\N	\N	\N	2026-02-02 19:36:59.906329+00
4f252420-1fb9-410b-8070-95c1e510477a	f39118e8-da36-426b-b2c5-3f635192e992	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": [], "steps": [], "language": "en", "portions": 4, "totalTime": 0, "difficulty": "easy", "ingredients": [], "schemaVersion": "1.0", "suggestedName": "Recipe unavailable", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 19:36:59.964268+00
a3d6def0-3f22-4b65-8fc7-78338de30251	bf96f269-fe1c-4f54-8830-c696c0fd8641	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 19:40:01.467865+00
6933a647-c1d2-4a2b-8f2d-6a5faf9b59e9	bf96f269-fe1c-4f54-8830-c696c0fd8641	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 19:40:01.513043+00
3b599b58-336e-4a48-a327-e900443dd4c4	bf96f269-fe1c-4f54-8830-c696c0fd8641	user	Chicken	\N	\N	\N	\N	2026-02-02 19:40:07.740873+00
703c8842-62d0-4801-a8a7-839f11becfd7	bf96f269-fe1c-4f54-8830-c696c0fd8641	assistant	Here are three chicken recipes for you:\n\n1. **Mediterranean Chicken Bake** \n2. **Air Fryer Chicken Thighs** \n3. **Chicken and Vegetable Stir-Fry** \n\nWhat would you like to try?	{"recipes": []}	\N	\N	\N	2026-02-02 19:40:07.788404+00
790ae496-13fc-408d-b861-101bb512c99d	bf96f269-fe1c-4f54-8830-c696c0fd8641	user	Custom recipe I have chicken and rice	\N	\N	\N	\N	2026-02-02 19:40:39.228402+00
45082e37-89d6-4746-b101-a5510898bc53	bf96f269-fe1c-4f54-8830-c696c0fd8641	assistant	Here's your recipe! Want any changes?	\N	\N	\N	\N	2026-02-02 19:40:39.269551+00
d0ffc282-0f00-4a30-b969-923260c03907	a92dc8ba-d62c-4511-9b21-f3698c3c0d4d	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 20:23:25.220705+00
6a0d5412-eb06-4481-9bd3-f8b43523c53a	a92dc8ba-d62c-4511-9b21-f3698c3c0d4d	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-02 20:23:25.279155+00
646a39b2-a5fa-43cb-a262-57be1d459057	a92dc8ba-d62c-4511-9b21-f3698c3c0d4d	user	Chicken Stir Fry	\N	\N	\N	\N	2026-02-02 20:23:50.957669+00
4f751d0f-b41a-42e4-ba77-d2fc561eca5b	a92dc8ba-d62c-4511-9b21-f3698c3c0d4d	assistant	Here's your recipe! Want any changes? \n\n{\n  "suggestions": [\n    { "label": "Add spice", "message": "Add spice" },\n    { "label": "Faster version", "message": "Faster version" },\n    { "label": "Make fancier", "message": "Make fancier" }\n  ]\n}	\N	\N	\N	\N	2026-02-02 20:23:51.003536+00
ef71b124-6b3a-479d-8fd8-18a3f7f61508	8cb50e43-2d8c-417d-b0e8-91a476f1b612	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 21:10:42.555945+00
3cacaa74-61b9-43f7-96c8-3953b9396bb6	8cb50e43-2d8c-417d-b0e8-91a476f1b612	assistant	What ingredients do you have on hand?	\N	\N	\N	\N	2026-02-02 21:10:42.640452+00
53bae9c3-3490-46a7-a68b-3202dabc9fcc	8cb50e43-2d8c-417d-b0e8-91a476f1b612	user	Chicken	\N	\N	\N	\N	2026-02-02 21:11:07.057403+00
f02b980f-21b6-4382-adf2-9d6c7cd95048	8cb50e43-2d8c-417d-b0e8-91a476f1b612	assistant	I'll create a recipe using chicken right away!	\N	\N	\N	\N	2026-02-02 21:11:07.121044+00
0bf18008-cd04-4dfe-85f3-2ef3e0e30b22	638ab9d4-6c81-46f9-ace4-c5ac0740ee00	user	Help me cook lunch, I have chicken rice and asparagus	\N	\N	\N	\N	2026-02-02 21:15:56.975607+00
27fda1b4-7a6b-45c3-aeb0-a511de96d654	638ab9d4-6c81-46f9-ace4-c5ac0740ee00	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Prepare the marinade by combining olive oil, lemon juice, minced garlic, salt, black pepper, and oregano in the Thermomix.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5"}, {"order": 2, "instruction": "Add the chicken breast to the marinade, mixing well to coat.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5"}, {"order": 3, "instruction": "Let the chicken marinate for 10 minutes while preparing the rice.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "1"}, {"order": 4, "instruction": "Add rice and 200 ml of water to the Thermomix and cook until done.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1"}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 180°C for about 12 minutes, flipping halfway through.", "thermomixTemp": "180°C", "thermomixTime": 720, "thermomixSpeed": "1"}, {"order": 6, "instruction": "Add asparagus to the rice in the Thermomix for the last 5 minutes of cooking.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1"}, {"order": 7, "instruction": "Once everything is cooked, fluff the rice and serve it with the chicken and asparagus.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "1"}, {"order": 8, "instruction": "Transfer to a serving plate and enjoy your Mediterranean dish!", "thermomixTemp": "0°C"}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 200}, {"name": "rice", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "garlic", "unit": "cloves", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "quantity": 15}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spatula_1743787718709.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 21:15:57.019843+00
b1b7423f-d907-4b71-b42f-0cb746792f9c	638ab9d4-6c81-46f9-ace4-c5ac0740ee00	user	Help me cook lunch, I have chicken and asparagus	\N	\N	\N	\N	2026-02-02 21:59:33.356487+00
5683faa4-9408-41f9-bb41-753bf816e220	638ab9d4-6c81-46f9-ace4-c5ac0740ee00	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus using the Thermomix.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5"}, {"order": 2, "instruction": "Add olive oil, garlic, salt, black pepper, and dried oregano to the Thermomix and sauté for flavor.", "thermomixTemp": "100°C", "thermomixTime": 120, "thermomixSpeed": "1"}, {"order": 3, "instruction": "Add the rice and water (300 ml) to the Thermomix, then cook until rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1"}, {"order": 4, "instruction": "While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.", "thermomixTemp": "0°C"}, {"order": 5, "instruction": "Transfer the seasoned chicken to the air fryer and cook at 180°C for 12-15 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C"}, {"order": 6, "instruction": "Add asparagus to the Thermomix 5 minutes before the rice is done to steam it.", "thermomixTemp": "Varoma", "thermomixTime": 300, "thermomixSpeed": "1"}, {"order": 7, "instruction": "Once the rice and asparagus are cooked, fluff the rice and combine with asparagus.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "Spoon"}, {"order": 8, "instruction": "Serve the rice and asparagus mix on a plate topped with the air-fried chicken.", "thermomixTemp": "0°C"}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Thermomix® Varoma", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_1743787852547.png"}, {"name": "Thermomix® Varoma tray", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_tray_1743787866973.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 21:59:33.409768+00
88968e70-8005-4b19-b3f9-1ef0e32611d6	638ab9d4-6c81-46f9-ace4-c5ac0740ee00	user	Add lemon zest	\N	\N	\N	\N	2026-02-02 22:01:03.88609+00
1f4ea932-fc1b-4557-a5a8-5a0fdd904ca0	638ab9d4-6c81-46f9-ace4-c5ac0740ee00	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Place the garlic cloves in the Thermomix bowl and chop finely.", "thermomixTime": 10, "thermomixSpeed": "7"}, {"order": 2, "instruction": "Add olive oil, lemon juice, lemon zest, salt, black pepper, and dried oregano to the bowl and mix well.", "thermomixTime": 10, "thermomixSpeed": "5"}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the bowl. Mix until the chicken is well coated.", "thermomixTime": 15, "thermomixSpeed": "5"}, {"order": 4, "instruction": "Transfer the marinated chicken to the air fryer basket. Cook at 180°C for 15 minutes.", "thermomixTemp": null, "thermomixTime": null, "thermomixSpeed": null}, {"order": 5, "instruction": "Meanwhile, rinse the rice and place it in the Thermomix bowl with 300ml of water. Cook the rice.", "thermomixTemp": "100°C", "thermomixTime": 15, "thermomixSpeed": "1"}, {"order": 6, "instruction": "After 10 minutes, add the asparagus to the air fryer with the chicken and continue cooking for another 5 minutes.", "thermomixTemp": null, "thermomixTime": null, "thermomixSpeed": null}, {"order": 7, "instruction": "Once everything is cooked, fluff the rice and serve alongside the chicken and asparagus.", "thermomixTemp": null, "thermomixTime": null, "thermomixSpeed": null}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}, {"name": "lemon zest", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/lima.png", "quantity": 1}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Lemon Oregano Chicken with Asparagus and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 22:01:03.930407+00
b527d217-6a4e-485b-9f28-16709dc5dc69	bdba935d-8e23-4994-8ecb-efdbefae1627	user	Help me make dinner, I have chicken rice and asparagus	\N	\N	\N	\N	2026-02-02 22:06:24.158852+00
78a15276-7ccd-417d-9038-c5982436304b	bdba935d-8e23-4994-8ecb-efdbefae1627	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean", "quick"], "steps": [{"order": 1, "instruction": "Prepare the marinade by adding olive oil, lemon juice, garlic, salt, black pepper, and oregano to the Thermomix.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5"}, {"order": 2, "instruction": "Cut the chicken breast into bite-sized pieces and add them to the marinade in the Thermomix. Mix for 15 seconds.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5"}, {"order": 3, "instruction": "Let the chicken marinate for 10 minutes while preparing the rice and asparagus.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "1"}, {"order": 4, "instruction": "Rinse the rice under cold water and add it to the Thermomix with 200 ml of water. Cook for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1"}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 200°C for 10 minutes.", "thermomixTemp": "200°C", "thermomixTime": 600, "thermomixSpeed": "1"}, {"order": 6, "instruction": "Add the asparagus to the air fryer with the chicken for the last 5 minutes of cooking.", "thermomixTemp": "200°C", "thermomixTime": 300, "thermomixSpeed": "1"}, {"order": 7, "instruction": "Once everything is cooked, fluff the rice with a fork and serve it on a plate with the chicken and asparagus on top."}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "salt", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 1}, {"name": "black pepper", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 1}, {"name": "dried oregano", "unit": "teaspoon", "quantity": 1}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 22:06:24.207662+00
737db1b1-6677-425a-9a7a-27614cd06f86	90105aa6-2276-43c0-a796-59a3c402088f	user	Help me cook dinner I have chicken rice and asparagus	\N	\N	\N	\N	2026-02-02 22:11:53.996431+00
7b823eb8-7f41-4aba-ad8f-76cced826e83	90105aa6-2276-43c0-a796-59a3c402088f	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "In a bowl, mix the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to create a marinade.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chicken breast to the marinade and let it sit for a few minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Cook the rice in the Thermomix with water according to package instructions.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 200°C for about 10-12 minutes, checking for an internal temperature of 75°C.", "thermomixTemp": "200°C", "thermomixTime": 720, "ingredientsUsed": ["chicken breast"]}, {"order": 6, "instruction": "In the last 5 minutes of cooking the chicken, add the asparagus to the air fryer.", "thermomixTemp": "200°C", "thermomixTime": 300, "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once everything is cooked, serve the chicken and asparagus over the rice.", "ingredientsUsed": ["chicken breast", "asparagus", "rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 22:11:54.046836+00
0249a7fa-9c04-42a5-ab17-3cc1b638b174	1dac9523-41a1-494a-8675-25893f18a22d	user	Suggest a recipe	\N	\N	\N	\N	2026-02-02 23:30:45.809319+00
493ac21b-163d-44aa-9e8e-165e2509099f	1dac9523-41a1-494a-8675-25893f18a22d	assistant	What ingredients do you have on hand?	\N	\N	\N	\N	2026-02-02 23:30:45.887827+00
6c0550aa-34a0-410e-848e-8274c39e1980	1dac9523-41a1-494a-8675-25893f18a22d	user	Chicken rice asparagus	\N	\N	\N	\N	2026-02-02 23:31:22.028572+00
5b5ef55e-d191-4b26-b5a4-40486490a413	1dac9523-41a1-494a-8675-25893f18a22d	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus in the Thermomix.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "Add olive oil, salt, black pepper, and lemon juice to the chopped garlic and asparagus. Mix well.", "thermomixTemp": "0°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "salt", "black pepper", "lemon juice"]}, {"order": 3, "instruction": "Add the chicken breast to the mixture in the Thermomix and marinate for 10 minutes.", "thermomixTemp": "0°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Cook the rice in the Thermomix by adding 300ml of water and cooking on speed 1 for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1", "ingredientsUsed": ["white rice"]}, {"order": 5, "instruction": "Place the marinated chicken and asparagus mixture into the air fryer and cook at 180°C for 15 minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Serve the chicken and asparagus over the cooked rice.", "ingredientsUsed": ["chicken breast", "asparagus", "white rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "white rice", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 23:31:22.075373+00
58bcc9c2-e3ae-4147-a0e3-41012475b6b2	1dac9523-41a1-494a-8675-25893f18a22d	user	Swap rice for quinoa	\N	\N	\N	\N	2026-02-02 23:35:18.3693+00
b3de88c0-04c4-48f8-b89b-62088a5c2fdb	1dac9523-41a1-494a-8675-25893f18a22d	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.", "thermomixTemp": "100°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Cook the quinoa for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 3, "instruction": "While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "chicken breast", "salt", "black pepper", "lemon juice", "olive oil"]}, {"order": 4, "instruction": "Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.", "thermomixTemp": "0°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus", "olive oil", "salt", "black pepper"]}, {"order": 6, "instruction": "Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.", "thermomixTemp": "0°C", "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.", "thermomixTemp": "0°C", "ingredientsUsed": ["quinoa"]}, {"order": 8, "instruction": "Transfer to a serving plate and garnish with additional lemon juice if desired.", "ingredientsUsed": ["lemon juice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "quinoa", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Lemon Garlic Chicken with Quinoa and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-02 23:35:18.417763+00
3baee7dd-c23d-46dd-abe5-bf95f44a30e5	b1b3bac2-fb09-4fcf-9566-ced444da699a	user	Suggest a recipe	\N	\N	\N	\N	2026-02-03 00:00:50.995393+00
9cf1b57f-a001-42d8-9bcb-8b40c5e64ee4	b1b3bac2-fb09-4fcf-9566-ced444da699a	assistant	What ingredients do you have on hand?	\N	\N	\N	\N	2026-02-03 00:00:51.054145+00
1158383d-ae7b-4f0b-b3a1-485385155476	b1b3bac2-fb09-4fcf-9566-ced444da699a	user	Chicken tomatoes	\N	\N	\N	\N	2026-02-03 00:01:19.467157+00
10030819-d6e1-4bda-8d61-3c39ceedb10e	b1b3bac2-fb09-4fcf-9566-ced444da699a	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["mediterranean", "sugarFree", "chicken"], "steps": [{"order": 1, "instruction": "Chop the garlic and tomatoes.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "tomatoes"]}, {"order": 2, "instruction": "Add olive oil, oregano, salt, and black pepper to the chopped tomatoes and garlic. Mix well.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "dried oregano", "salt", "black pepper"]}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the bowl. Stir to coat the chicken with the tomato mixture.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Transfer the chicken and tomato mixture to the air fryer basket and cook at 200°C for 15 minutes.", "ingredientsUsed": ["chicken breast", "tomatoes"]}, {"order": 5, "instruction": "Serve the Mediterranean chicken with tomatoes hot.", "ingredientsUsed": ["chicken breast", "tomatoes"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 300}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "dried oregano", "unit": "teaspoon", "quantity": 1}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Tomatoes", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:01:19.510322+00
a8d902ce-dcf8-4e48-b88a-c904c94c6970	b1b3bac2-fb09-4fcf-9566-ced444da699a	user	Add red pepper flakes	\N	\N	\N	\N	2026-02-03 00:15:01.096092+00
71cea02b-098d-4270-a8ec-7e2c9aaa65e3	b1b3bac2-fb09-4fcf-9566-ced444da699a	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop garlic and tomatoes in the Thermomix.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "tomatoes"]}, {"order": 2, "instruction": "Add olive oil, dried oregano, salt, black pepper, and red pepper flakes to the chopped mixture and mix well.", "thermomixTemp": "0°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "dried oregano", "salt", "black pepper", "red pepper flakes"]}, {"order": 3, "instruction": "Cut chicken breast into strips and season with the tomato mixture.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Transfer the chicken to the air fryer and cook at 200°C for 15 minutes.", "thermomixTemp": "0°C", "thermomixTime": 900, "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "Let the chicken rest for a few minutes before serving.", "thermomixTemp": "0°C", "thermomixTime": 180, "ingredientsUsed": ["chicken breast"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 400}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 300}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "dried oregano", "unit": "teaspoons", "quantity": 2}, {"name": "salt", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 1}, {"name": "black pepper", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 1}, {"name": "red pepper flakes", "unit": "teaspoon", "quantity": 1}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Tomatoes", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:15:01.163423+00
fc6fb9e4-9ea3-4665-9141-fd36be02d6f3	b1b3bac2-fb09-4fcf-9566-ced444da699a	user	Help me cook dinner, I have meatballs and rice	\N	\N	\N	\N	2026-02-03 00:17:02.754947+00
a9ea0b94-e4f5-4b7a-97b0-fcfb3f66d075	b1b3bac2-fb09-4fcf-9566-ced444da699a	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic using the Thermomix.", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic"]}, {"order": 2, "instruction": "Combine the chopped garlic, olive oil, dried oregano, salt, black pepper, and red pepper flakes in the Thermomix to make the meatball mixture.", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "dried oregano", "salt", "black pepper", "red pepper flakes"]}, {"order": 3, "instruction": "Add the chicken breast to the mixture and blend until well combined.", "thermomixTime": 30, "thermomixSpeed": "8", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Form the mixture into meatballs and place them in the air fryer basket.", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "Cook the meatballs in the air fryer at 180°C for 10-12 minutes, or until the internal temperature reaches 75°C.", "ingredientsUsed": ["chicken breast"]}, {"order": 6, "instruction": "Cook the rice according to package instructions.", "ingredientsUsed": ["rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 500}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 400}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "dried oregano", "unit": "grams", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "red pepper flakes", "unit": "gram", "quantity": 1}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 200}], "usefulItems": [{"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Meatballs with Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:17:02.799581+00
3f97fd74-48bd-4ef1-bae9-57208f7e7c85	fe2a7cf7-1368-4bf0-8a1b-9007e17a2d62	user	Help me to cook dinner. I have ground beef, tomatoes and rice	\N	\N	\N	\N	2026-02-03 00:18:23.433801+00
f8817605-7ad3-4ae4-b5f4-b7564c9dcd00	fe2a7cf7-1368-4bf0-8a1b-9007e17a2d62	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the onion and garlic.", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["onion", "garlic"]}, {"order": 2, "instruction": "Sauté the chopped onion and garlic in olive oil until fragrant.", "thermomixTemp": "100°C", "thermomixTime": 180, "thermomixSpeed": "1", "ingredientsUsed": ["onion", "garlic", "olive oil"]}, {"order": 3, "instruction": "Add the ground beef, salt, pepper, and oregano, and cook until browned.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["ground beef", "salt", "pepper", "dried oregano"]}, {"order": 4, "instruction": "Add the chopped tomatoes and water. Cook until the mixture is heated through.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["tomatoes", "water"]}, {"order": 5, "instruction": "Add the rice and stir to combine. Cook until the rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 6, "instruction": "Let it rest for a few minutes before serving.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "ground beef", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png", "quantity": 400}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 400}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 200}, {"name": "onion", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/cebolla.png", "quantity": 100}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal_y_pimienta.png?t=2024-11-15T21%3A07%3A48.065Z", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}, {"name": "water", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png", "quantity": 400}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Beef and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:18:23.479163+00
ba450e9c-3ea9-4ad9-91b7-f329040c6e80	5bc02d6b-80fa-4b8a-95d9-323b93c16415	user	I want to make ramen	\N	\N	\N	\N	2026-02-03 00:25:12.684583+00
c340bd77-6b80-4e50-9ba9-b92198d15cc0	5bc02d6b-80fa-4b8a-95d9-323b93c16415	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "asian", "easy"], "steps": [{"order": 1, "instruction": "Chop the chicken into bite-sized pieces.", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["chicken breast"]}, {"order": 2, "instruction": "Sauté the chopped chicken until lightly browned.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 3, "instruction": "Add the mixed vegetables and sauté for an additional 2 minutes.", "thermomixTemp": "100°C", "thermomixTime": 120, "thermomixSpeed": "1", "ingredientsUsed": ["mixed vegetables"]}, {"order": 4, "instruction": "Pour in the broth and soy sauce, then bring to a boil.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["broth", "soy sauce"]}, {"order": 5, "instruction": "Add the ramen noodles and cook until tender.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["ramen noodles"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "ramen noodles", "unit": "grams", "quantity": 100}, {"name": "mixed vegetables", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/surtido_de_nueces_1743207250295.png", "quantity": 200}, {"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "broth", "unit": "liter", "quantity": 1}, {"name": "soy sauce", "unit": "ml", "quantity": 30}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Sugar-Free Chicken Ramen", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:25:12.771976+00
244d5694-4381-40bd-a927-5e814df5e1f5	5bc02d6b-80fa-4b8a-95d9-323b93c16415	user	Help me make beef and broccoli	\N	\N	\N	\N	2026-02-03 00:28:50.222234+00
1e826f68-c16e-4ad9-ba80-e16ed281847a	5bc02d6b-80fa-4b8a-95d9-323b93c16415	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean", "beef", "broccoli"], "steps": [{"order": 1, "instruction": "Slice the beef into thin strips.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["beef"]}, {"order": 2, "instruction": "Chop the garlic and ginger.", "thermomixTemp": "Varoma", "thermomixTime": 5, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "ginger"]}, {"order": 3, "instruction": "Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "soy sauce", "sesame oil", "cornstarch", "water"]}, {"order": 4, "instruction": "Add the broccoli florets to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 5, "thermomixSpeed": "1", "ingredientsUsed": ["broccoli"]}, {"order": 5, "instruction": "Cook until the beef is tender and the broccoli is cooked but still crisp.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "broccoli"]}, {"order": 6, "instruction": "Transfer to a serving plate and serve hot.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 25, "difficulty": "easy", "ingredients": [{"name": "beef", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png", "quantity": 300}, {"name": "broccoli", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png", "quantity": 200}, {"name": "soy sauce", "unit": "ml", "quantity": 50}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "sesame oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png", "quantity": 15}, {"name": "cornstarch", "unit": "grams", "quantity": 10}, {"name": "water", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png", "quantity": 100}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Asian Beef and Broccoli Stir-Fry", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:28:50.553548+00
d53d10e2-36b5-4f9a-bd85-9b0051c469c7	cd6180ff-9d8b-486f-b5db-5781d22376b8	user	Help me make dinner I have mushrooms and tomatoes	\N	\N	\N	\N	2026-02-03 00:47:36.631076+00
b22a1463-2996-4434-b9d9-bf4c3212adb3	cd6180ff-9d8b-486f-b5db-5781d22376b8	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the mushrooms and tomatoes into small pieces.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["mushrooms", "tomatoes"]}, {"order": 2, "instruction": "Sauté the chopped mushrooms and tomatoes until tender.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["mushrooms", "tomatoes"]}], "language": "en", "portions": 1, "totalTime": 15, "difficulty": "easy", "ingredients": [{"name": "mushrooms", "unit": "grams", "quantity": 200}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 150}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Mushroom and Tomato Sauté", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:47:36.681635+00
b95d6114-7e8c-44ee-bd03-0f0ec9399434	cd6180ff-9d8b-486f-b5db-5781d22376b8	user	Add chicken	\N	\N	\N	\N	2026-02-03 00:48:22.817555+00
244a0df8-09dd-4fa3-a7ed-5097108d00cf	cd6180ff-9d8b-486f-b5db-5781d22376b8	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the mushrooms and tomatoes into small pieces.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["mushrooms", "tomatoes"]}, {"order": 2, "instruction": "Chop the garlic.", "thermomixTemp": "0°C", "thermomixTime": 5, "thermomixSpeed": "5", "ingredientsUsed": ["garlic"]}, {"order": 3, "instruction": "Add olive oil, garlic, mushrooms, and tomatoes to the Thermomix and sauté until fragrant.", "thermomixTemp": "100°C", "thermomixTime": 180, "thermomixSpeed": "1", "ingredientsUsed": ["olive oil", "garlic", "mushrooms", "tomatoes"]}, {"order": 4, "instruction": "Season the chicken breast with salt and pepper, then add to the Thermomix.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast", "salt", "pepper"]}, {"order": 5, "instruction": "Transfer the mixture to the air fryer and cook at 180°C for 5 minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "mushrooms", "tomatoes"]}, {"order": 6, "instruction": "Garnish with fresh basil before serving.", "thermomixTemp": "0°C", "ingredientsUsed": ["fresh basil"]}], "language": "en", "portions": 1, "totalTime": 15, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "mushrooms", "unit": "grams", "quantity": 150}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 100}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "clove", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 1}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 2}, {"name": "pepper", "unit": "gram", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal_y_pimienta.png?t=2024-11-15T21%3A07%3A48.065Z", "quantity": 1}, {"name": "fresh basil", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/espinca.png", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Mushrooms and Tomatoes", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:48:22.860995+00
e4151a22-f48b-4bbe-9593-3f8d5a91e7f5	18045160-03fe-4b50-b190-5e8c86b0585a	user	Help me make dinner I have chicken rice tomatoes  asparagus	\N	\N	\N	\N	2026-02-03 00:56:41.433261+00
c800e079-3598-4de3-a326-0453600ded3f	18045160-03fe-4b50-b190-5e8c86b0585a	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and tomatoes.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "tomatoes"]}, {"order": 2, "instruction": "Sauté the garlic and tomatoes in olive oil until fragrant.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["garlic", "tomatoes", "olive oil"]}, {"order": 3, "instruction": "Add the rice, salt, black pepper, and 300 ml of water, then cook until rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice", "salt", "black pepper"]}, {"order": 4, "instruction": "While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.", "ingredientsUsed": ["chicken breast", "lemon juice", "salt", "black pepper"]}, {"order": 5, "instruction": "Place the seasoned chicken breast and asparagus in the air fryer and cook until the chicken reaches 75°C and asparagus is tender.", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Once the rice is cooked, fluff it with a fork and serve with the chicken and asparagus.", "ingredientsUsed": ["rice", "chicken breast", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 250}, {"name": "asparagus", "unit": "grams", "quantity": 100}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 00:56:41.485335+00
5b0ffa8d-758a-486e-93af-62886e01d263	18045160-03fe-4b50-b190-5e8c86b0585a	user	Help me make a recipe with chicken and zucchini	\N	\N	\N	\N	2026-02-03 03:15:14.880413+00
8c3b4d51-028d-4fa3-a650-f259b56c69c3	18045160-03fe-4b50-b190-5e8c86b0585a	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and zucchini into small pieces.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "zucchini"]}, {"order": 2, "instruction": "Add the olive oil, salt, black pepper, and lemon juice to the chopped zucchini and garlic, and mix well.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "salt", "black pepper", "lemon juice"]}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the mixture.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Transfer the chicken and zucchini mixture to the air fryer and cook at 180°C for 15 minutes, shaking halfway through.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "zucchini"]}, {"order": 5, "instruction": "Meanwhile, rinse the rice and add it to the Thermomix with 400 ml of water. Cook the rice.", "thermomixTemp": "100°C", "thermomixTime": 15, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 6, "instruction": "Once the chicken is cooked, combine it with the cooked rice and diced tomatoes.", "thermomixTemp": "100°C", "thermomixTime": 20, "thermomixSpeed": "1", "ingredientsUsed": ["tomatoes"]}, {"order": 7, "instruction": "Serve the chicken and rice mixture hot.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 500}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 200}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 300}, {"name": "zucchini", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/calabacita.png", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Zucchini and Rice", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 03:15:14.937956+00
59fde935-ca03-46f1-a330-bb33e5ec0fd9	6e303789-790e-4102-8728-294beb6f66bb	user	Suggest a recipe	\N	\N	\N	\N	2026-02-03 22:19:13.450338+00
a60264ef-63b5-4ebc-b255-ea4b454cdccd	6e303789-790e-4102-8728-294beb6f66bb	assistant	What ingredients do you have on hand?	\N	\N	\N	\N	2026-02-03 22:19:13.532381+00
9a2d1c72-7fa9-4104-8524-e9878d944da1	6e303789-790e-4102-8728-294beb6f66bb	user	Chicken and asparagus	\N	\N	\N	\N	2026-02-03 22:19:47.235631+00
4d8a1f4c-1125-4441-82ce-ecbd44373e77	6e303789-790e-4102-8728-294beb6f66bb	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic cloves into small pieces.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic"]}, {"order": 2, "instruction": "In a bowl, combine the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to make a marinade.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the marinade. Allow to marinate for at least 10 minutes.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "Spoon", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Trim the ends of the asparagus and add them to the Thermomix bowl with the marinated chicken.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus"]}, {"order": 5, "instruction": "Transfer the chicken and asparagus mixture to the air fryer basket.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Air fry at 200°C for 15 minutes, shaking halfway through for even cooking.", "thermomixTemp": "0°C", "thermomixTime": 900, "ingredientsUsed": []}, {"order": 7, "instruction": "Serve hot and enjoy your Mediterranean chicken with asparagus.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 250}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 2}, {"name": "black pepper", "unit": "gram", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 1}, {"name": "dried oregano", "unit": "grams", "quantity": 2}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 22:19:47.302774+00
c5a41fd3-215a-40ae-9172-c7a80f67647f	6e303789-790e-4102-8728-294beb6f66bb	user	Give me three recipes	\N	\N	\N	\N	2026-02-03 22:29:22.867144+00
e4690294-c0e6-40cf-b813-801d7e7a6739	6e303789-790e-4102-8728-294beb6f66bb	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and season the chicken with olive oil, lemon juice, salt, black pepper, and dried oregano.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "chicken breast", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 2, "instruction": "Add the asparagus to the Thermomix bowl.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus"]}, {"order": 3, "instruction": "Transfer the chicken and asparagus mixture to the air fryer basket.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 4, "instruction": "Air fry at 180°C for about 15 minutes or until the chicken is cooked through (internal temperature should reach 75°C).", "thermomixTemp": "0°C", "thermomixTime": 900, "ingredientsUsed": ["chicken breast", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 300}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 22:29:22.955643+00
40bb0873-3592-4805-b921-2ab14ee2d986	6e303789-790e-4102-8728-294beb6f66bb	user	Swap chicken for tofu	\N	\N	\N	\N	2026-02-03 22:32:41.131414+00
73716fe6-312d-44e5-b422-f44b8813b28a	6e303789-790e-4102-8728-294beb6f66bb	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Press the tofu to remove excess moisture and cut it into cubes.", "ingredientsUsed": ["tofu"]}, {"order": 2, "instruction": "Chop the garlic.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic"]}, {"order": 3, "instruction": "In the Thermomix, combine olive oil, lemon juice, salt, black pepper, dried oregano, and the chopped garlic. Mix well.", "thermomixTemp": "50°C", "thermomixTime": 20, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano", "garlic"]}, {"order": 4, "instruction": "Add the tofu cubes to the mixture and marinate for 10 minutes.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["tofu"]}, {"order": 5, "instruction": "Prepare the asparagus by trimming the ends.", "ingredientsUsed": ["asparagus"]}, {"order": 6, "instruction": "In the air fryer, add the marinated tofu and asparagus. Cook at 200°C for 15 minutes.", "ingredientsUsed": ["tofu", "asparagus"]}, {"order": 7, "instruction": "Serve the tofu and asparagus warm.", "ingredientsUsed": ["tofu", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "tofu", "unit": "grams", "quantity": 300}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Tofu with Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 22:32:41.276928+00
9116900b-c2f5-43ec-8a2a-f40843bc48a7	e68d7128-f52f-4b8a-a821-6947a5710cb2	user	Suggest a recipe	\N	\N	\N	\N	2026-02-03 22:40:34.396348+00
52ef5f1d-8688-4b25-8169-08ca1133293d	e68d7128-f52f-4b8a-a821-6947a5710cb2	assistant	What ingredients do you have?	\N	\N	\N	\N	2026-02-03 22:40:34.459068+00
08619de3-1002-4bd1-8cd3-ccf00cd846b4	e68d7128-f52f-4b8a-a821-6947a5710cb2	user	Chicken and asparagus	\N	\N	\N	\N	2026-02-03 22:41:49.376647+00
16a0f14e-3674-4bdb-adff-dbf252302b04	e68d7128-f52f-4b8a-a821-6947a5710cb2	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "5°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "In a bowl, combine olive oil, lemon juice, salt, black pepper, and dried oregano.", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chopped garlic and asparagus to the bowl and mix well.", "thermomixTemp": "5°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 4, "instruction": "Cut the chicken breast into bite-sized pieces and add to the bowl, mixing to coat.", "thermomixTemp": "5°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "Transfer the chicken and asparagus mixture to the air fryer basket.", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Cook in the air fryer at 180°C for 15 minutes or until the chicken reaches an internal temperature of 75°C.", "thermomixTemp": "180°C", "thermomixTime": 900, "thermomixSpeed": "Spoon", "ingredientsUsed": ["chicken breast"]}, {"order": 7, "instruction": "Serve hot and enjoy your Mediterranean chicken with asparagus.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 45, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 20}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 22:41:49.45851+00
28500671-3c18-4434-b0cb-cb48a41ba7c3	e68d7128-f52f-4b8a-a821-6947a5710cb2	user	Substitute quinoa	\N	\N	\N	\N	2026-02-03 22:42:39.975963+00
7f26d9b5-7981-4e76-9725-54c9e7e47708	e68d7128-f52f-4b8a-a821-6947a5710cb2	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water, then add it to the Thermomix bowl with 200 ml water.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Chop the garlic and add it to the Thermomix with olive oil, salt, black pepper, and dried oregano.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "olive oil", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chicken breast to the Thermomix bowl and coat it with the garlic mixture.", "thermomixTemp": "100°C", "thermomixTime": 20, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Steam the asparagus in the Thermomix Varoma while the chicken is cooking.", "thermomixTemp": "Varoma", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus"]}, {"order": 5, "instruction": "Once the chicken is cooked to an internal temperature of 75°C, add lemon juice and mix.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["lemon juice"]}, {"order": 6, "instruction": "Serve the chicken over quinoa with steamed asparagus on the side.", "ingredientsUsed": ["quinoa", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 45, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}, {"name": "quinoa", "unit": "grams", "quantity": 100}], "usefulItems": [{"name": "Thermomix® Varoma", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_1743787852547.png"}, {"name": "Thermomix® Varoma tray", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_tray_1743787866973.png"}, {"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Quinoa and Asparagus", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 22:42:40.030056+00
ddff7fc0-2eea-44a9-a9eb-5823489cd55d	e68d7128-f52f-4b8a-a821-6947a5710cb2	user	Sub tofu	\N	\N	\N	\N	2026-02-03 22:43:49.403817+00
1351a440-352f-42b5-bf64-16a5d46bc5b0	e68d7128-f52f-4b8a-a821-6947a5710cb2	assistant	Ready! Want to change anything?	{"customRecipe": {"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water.", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Add quinoa and 300 ml of water to the Thermomix bowl. Cook until quinoa is fluffy.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 3, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 4, "instruction": "In a bowl, combine chopped garlic, asparagus, olive oil, lemon juice, salt, black pepper, and dried oregano. Mix well.", "thermomixTemp": "0°C", "thermomixTime": 60, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 5, "instruction": "Cut tofu into cubes and add to the bowl with the marinade. Mix gently to coat.", "thermomixTemp": "0°C", "thermomixTime": 20, "thermomixSpeed": "Spoon", "ingredientsUsed": ["tofu"]}, {"order": 6, "instruction": "Transfer marinated tofu and asparagus mixture to the air fryer and cook at 200°C for 15 minutes.", "ingredientsUsed": ["tofu", "asparagus"]}, {"order": 7, "instruction": "Fluff the cooked quinoa with a fork.", "ingredientsUsed": ["quinoa"]}, {"order": 8, "instruction": "Serve the quinoa topped with the roasted tofu and asparagus mix.", "ingredientsUsed": ["quinoa", "tofu", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 45, "difficulty": "easy", "ingredients": [{"name": "tofu", "unit": "grams", "quantity": 300}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}, {"name": "quinoa", "unit": "grams", "quantity": 150}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Tofu Quinoa Bowl", "measurementSystem": "metric"}}	\N	\N	\N	2026-02-03 22:43:49.546163+00
\.



COPY "public"."user_chat_sessions" ("id", "user_id", "title", "created_at", "updated_at") FROM stdin;
add0b759-5994-47da-a904-c8c068b619e7	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-12 23:47:04.626252+00	2026-01-12 23:47:04.626252+00
959dc0b3-ecd2-41b3-8391-703da1a3509a	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-12 23:47:47.891841+00	2026-01-12 23:47:47.891841+00
c463e84f-2868-49f1-9495-f03f4da54b3c	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 01:47:14.060282+00	2026-01-13 01:47:14.060282+00
09efed8f-e8be-4eb0-ac17-9c5e4060dc44	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 04:01:00.82452+00	2026-01-13 04:01:00.82452+00
f02ea858-a0f5-4778-9632-8dac6a6ecd04	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 04:03:43.095495+00	2026-01-13 04:03:43.095495+00
a26278d0-434b-4f9c-bb1a-8100a12dcb18	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 04:20:29.618383+00	2026-01-13 04:20:29.618383+00
a80ac0cb-dab9-480c-a4f3-dfb11ee37264	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 04:49:10.706649+00	2026-01-13 04:49:10.706649+00
f5351638-6085-47b0-82a4-1132f6bcfe7e	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 14:35:26.223411+00	2026-01-13 14:35:26.223411+00
5a996719-749a-43bd-b612-bdbae4b0b0be	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 15:18:43.68101+00	2026-01-13 15:18:43.68101+00
a72c8036-3304-4d9f-95b1-3ccf67fd3866	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 18:13:16.158136+00	2026-01-13 18:13:16.158136+00
e93551ff-04bc-4a6c-abbd-0477c306bbd6	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 18:23:10.407382+00	2026-01-13 18:23:10.407382+00
3dcb7aeb-75aa-4062-88f1-b435ad879cb3	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 18:23:36.803672+00	2026-01-13 18:23:36.803672+00
36b2c8ef-af84-4bf8-bd9b-a327fec28825	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 18:24:44.665413+00	2026-01-13 18:24:44.665413+00
7a95d691-d20b-4ca5-8a24-dda062215ed8	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 18:48:09.038671+00	2026-01-13 18:48:09.038671+00
b6a89732-2039-4e5c-9ac7-1b83eed84088	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 19:57:51.883831+00	2026-01-13 19:57:51.883831+00
27a6285a-a9e7-4a27-84db-11e12b8dd1f7	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 19:59:45.64521+00	2026-01-13 19:59:45.64521+00
d287ccf8-e871-4725-94f1-cebd173a7487	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 19:59:56.318966+00	2026-01-13 19:59:56.318966+00
77f64a7d-a558-45a8-b5d3-acd4c6a84479	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:00:15.526729+00	2026-01-13 20:00:15.526729+00
31e2f8a0-3c15-4c5b-a0bd-8e774f51302e	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:08:31.45298+00	2026-01-13 20:08:31.45298+00
a0b4a23e-d091-4ac5-ae43-451468a1717d	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:09:17.933755+00	2026-01-13 20:09:17.933755+00
407c89ac-d984-410f-8d01-d189d0283f95	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:21:11.684993+00	2026-01-13 20:21:11.684993+00
b7acefd6-2ea9-4e26-9b94-00b09da0b522	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:24:50.32913+00	2026-01-13 20:24:50.32913+00
09b8af41-0fed-456d-a4ba-4cfc76c52abf	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:41:23.015233+00	2026-01-13 20:41:23.015233+00
d30ed503-7a83-4d79-b8b2-8afc3b09066b	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:46:33.069859+00	2026-01-13 20:46:33.069859+00
a5d5db96-a3ea-4638-98bc-571ff86eeabf	e225a00c-2183-4eb8-8e06-3856271c38cd	\N	2026-01-13 20:51:32.708358+00	2026-01-13 20:51:32.708358+00
ca433e67-ece6-498e-be24-d1f37454f42f	be7af925-bc2c-4fb7-a22f-dad0d777f9f3	\N	2026-01-31 21:08:49.626526+00	2026-01-31 21:08:49.626526+00
37d2704a-2d60-4f22-b133-b02aaabb03d6	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	2026-01-31 21:31:25.128736+00	2026-01-31 21:31:25.128736+00
a66d7416-0c5d-4418-8291-ea9755695a21	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	2026-02-02 17:25:59.814639+00	2026-02-02 17:25:59.814639+00
884ef695-130f-4e4c-b649-106d14fb0f5e	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	2026-02-02 17:31:16.696604+00	2026-02-02 17:31:16.696604+00
485e076b-138d-4e7a-9289-e1693b390a6d	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	2026-02-02 17:38:48.315879+00	2026-02-02 17:38:48.315879+00
9826898f-c675-44d2-8723-54ee71ef36fe	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	2026-02-02 17:44:36.867143+00	2026-02-02 17:44:36.867143+00
88d46420-78c1-4032-82f8-249b0aeb4994	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	2026-02-02 17:50:22.34538+00	2026-02-02 17:50:22.34538+00
d9b24c00-fd78-4a57-87ed-c68066569ca2	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	2026-02-02 17:56:10.721058+00	2026-02-02 17:56:10.721058+00
117892ef-5fd3-4b7c-abb3-635ccc92d029	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me cook chicken and rice	2026-02-02 18:05:15.786761+00	2026-02-02 18:05:15.786761+00
34364611-be5c-4f7a-aa3b-d02365affcfd	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me to cook chicken and rice	2026-02-02 18:18:13.787606+00	2026-02-02 18:18:13.787606+00
ccf48576-32dc-4bcc-a43d-4639b81cccb6	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me cook something	2026-02-02 18:23:50.156957+00	2026-02-02 18:23:50.156957+00
f8d07fa1-4fe0-4311-866d-b17929572ca1	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 18:30:07.379204+00	2026-02-02 18:30:07.379204+00
37e71e0e-babe-46dd-8afd-99979bd24389	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me make a recipe with chicken and rice	2026-02-02 18:39:49.188295+00	2026-02-02 18:39:49.188295+00
18abf32f-f0b6-4d46-919a-964e1b1356fd	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me cook chicken and rice	2026-02-02 18:42:21.749322+00	2026-02-02 18:42:21.749322+00
6f4402fb-4672-415a-92f4-fa012cf2f458	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me cook chicken and rice	2026-02-02 18:45:55.183656+00	2026-02-02 18:45:55.183656+00
47bfbaaf-4994-4f9b-8717-29aca6b48e7b	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 19:25:34.797221+00	2026-02-02 19:25:34.797221+00
a480f04b-c36f-41eb-b7ed-eb44280d7cce	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 19:32:47.68287+00	2026-02-02 19:32:47.68287+00
f39118e8-da36-426b-b2c5-3f635192e992	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 19:36:04.885599+00	2026-02-02 19:36:04.885599+00
bf96f269-fe1c-4f54-8830-c696c0fd8641	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 19:39:58.783982+00	2026-02-02 19:39:58.783982+00
a92dc8ba-d62c-4511-9b21-f3698c3c0d4d	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 20:23:21.600815+00	2026-02-02 20:23:21.600815+00
8cb50e43-2d8c-417d-b0e8-91a476f1b612	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 21:10:37.805217+00	2026-02-02 21:10:37.805217+00
638ab9d4-6c81-46f9-ace4-c5ac0740ee00	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me cook lunch, I have chicken rice and...	2026-02-02 21:15:37.247116+00	2026-02-02 21:15:37.247116+00
bdba935d-8e23-4994-8ecb-efdbefae1627	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me make dinner, I have chicken rice and...	2026-02-02 22:06:04.751027+00	2026-02-02 22:06:04.751027+00
90105aa6-2276-43c0-a796-59a3c402088f	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me cook dinner I have chicken rice and...	2026-02-02 22:11:23.417923+00	2026-02-02 22:11:23.417923+00
1dac9523-41a1-494a-8675-25893f18a22d	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-02 23:30:37.464591+00	2026-02-02 23:30:37.464591+00
b1b3bac2-fb09-4fcf-9566-ced444da699a	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-03 00:00:46.120383+00	2026-02-03 00:00:46.120383+00
fe2a7cf7-1368-4bf0-8a1b-9007e17a2d62	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me to cook dinner. I have ground beef,...	2026-02-03 00:18:05.641769+00	2026-02-03 00:18:05.641769+00
5bc02d6b-80fa-4b8a-95d9-323b93c16415	41fda130-9e9e-40f0-af95-679db75ebcd0	I want to make ramen	2026-02-03 00:24:56.543057+00	2026-02-03 00:24:56.543057+00
cd6180ff-9d8b-486f-b5db-5781d22376b8	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me make dinner I have mushrooms and tomatoes	2026-02-03 00:47:25.383327+00	2026-02-03 00:47:25.383327+00
18045160-03fe-4b50-b190-5e8c86b0585a	41fda130-9e9e-40f0-af95-679db75ebcd0	Help me make dinner I have chicken rice tomatoes...	2026-02-03 00:56:24.938209+00	2026-02-03 00:56:24.938209+00
6e303789-790e-4102-8728-294beb6f66bb	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-03 22:19:08.133159+00	2026-02-03 22:19:08.133159+00
e68d7128-f52f-4b8a-a821-6947a5710cb2	41fda130-9e9e-40f0-af95-679db75ebcd0	Suggest a recipe	2026-02-03 22:40:30.516237+00	2026-02-03 22:40:30.516237+00
\.



COPY "public"."user_events" ("id", "user_id", "event_type", "payload", "created_at") FROM stdin;
9a0e4ad8-2f24-4a49-8dd2-89c83e7b859d	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "add0b759-5994-47da-a904-c8c068b619e7"}	2026-01-12 23:47:04.931347+00
a296d4b9-e3b5-4c28-be80-825bd5c612fe	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "959dc0b3-ecd2-41b3-8391-703da1a3509a"}	2026-01-12 23:47:48.106165+00
1e7c5a61-e2ed-4760-9513-4c76b5e0edef	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "c463e84f-2868-49f1-9495-f03f4da54b3c"}	2026-01-13 01:47:14.309568+00
2be8f227-16c0-4bf2-9671-5579b968ebf3	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "a80ac0cb-dab9-480c-a4f3-dfb11ee37264"}	2026-01-13 04:52:41.408853+00
3d428fca-3687-4e69-9734-b7638d942950	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "e93551ff-04bc-4a6c-abbd-0477c306bbd6"}	2026-01-13 18:23:10.708683+00
5d702dae-c170-40f2-8900-f19b1224a3ee	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "3dcb7aeb-75aa-4062-88f1-b435ad879cb3"}	2026-01-13 18:23:37.042133+00
67b9ff46-8576-45bc-9739-cfa93beee411	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "7a95d691-d20b-4ca5-8a24-dda062215ed8"}	2026-01-13 18:48:09.203071+00
adab15e0-8aaa-4178-80e6-5d46b330663a	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "27a6285a-a9e7-4a27-84db-11e12b8dd1f7"}	2026-01-13 19:59:45.834184+00
8bcbeaf1-de4c-4978-b449-63c94017f86b	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "d287ccf8-e871-4725-94f1-cebd173a7487"}	2026-01-13 19:59:56.526231+00
f9b47db5-ccc1-40da-8e91-5bf23fbca6d7	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "77f64a7d-a558-45a8-b5d3-acd4c6a84479"}	2026-01-13 20:00:15.748494+00
0f7f1dae-3560-492f-bc98-a483eb6f5f0f	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "a0b4a23e-d091-4ac5-ae43-451468a1717d"}	2026-01-13 20:09:18.154544+00
a6e4807b-47e4-4393-9e53-311976af019e	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "407c89ac-d984-410f-8d01-d189d0283f95"}	2026-01-13 20:21:28.955913+00
886402f2-af94-4922-b58b-ae886874ec06	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "b7acefd6-2ea9-4e26-9b94-00b09da0b522"}	2026-01-13 20:27:19.559147+00
59b7a099-133d-4ff3-a062-25d60a50cd14	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "b7acefd6-2ea9-4e26-9b94-00b09da0b522"}	2026-01-13 20:27:40.830857+00
e4af12ae-043f-4da2-842a-ae832dd601dc	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "b7acefd6-2ea9-4e26-9b94-00b09da0b522"}	2026-01-13 20:28:11.950079+00
85292b1a-39d0-4898-a5af-73ce10a3e2d4	e225a00c-2183-4eb8-8e06-3856271c38cd	chat_message	{"session_id": "09b8af41-0fed-456d-a4ba-4cfc76c52abf"}	2026-01-13 20:43:19.904817+00
\.



COPY "public"."user_profiles" ("id", "email", "name", "biography", "gender", "birth_date", "height", "weight", "activity_level", "dietary_restrictions", "diet_types", "measurement_system", "language", "profile_image_url", "onboarding_complete", "created_at", "updated_at", "other_allergy", "other_diet", "is_admin", "kitchen_equipment", "skill_level", "household_size", "ingredient_dislikes", "taste_profile") FROM stdin;
be7af925-bc2c-4fb7-a22f-dad0d777f9f3	5zv5xyzq29@privaterelay.appleid.com	Banana		\N	\N	\N	\N	\N	{none}	{none}	metric	es	\N	f	2026-01-14 03:03:24.9931+00	2026-02-02 18:52:53.813308+00	{}	{}	t	[]	\N	1	{}	{}
e225a00c-2183-4eb8-8e06-3856271c38cd	ian.a.hibbert@icloud.com	Ian H	I am a banana	male	1981-01-10	175.00	70.00	moderatelyActive	{other,gluten}	{other,mediterranean}	metric	es	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/user-content/profile-images/e225a00c-2183-4eb8-8e06-3856271c38cd_1768081294615.jpeg	f	2026-01-08 19:04:47.518805+00	2026-02-02 18:52:55.62572+00	{bananas,"🍌 "}	{other,"strange thing"}	t	[]	\N	1	{}	{}
8416e3f4-3b1b-4bf8-b2a9-6ee7ede0e28e	bigaix.rg@gmail.com	Abigail Rios Galindo	\N	\N	\N	\N	\N	\N	{dairy,seafood,eggs}	{mediterranean,pescatarian,vegan,lactoVegetarian,keto,ovoVegetarian}	metric	en	\N	f	2025-04-30 19:42:23.377688+00	2026-01-08 05:16:35.043366+00	{}	{}	t	[]	\N	1	{}	{}
41fda130-9e9e-40f0-af95-679db75ebcd0	dev@yummyyummix.local	Banana Dev	\N	\N	\N	\N	\N	\N	{nuts,dairy}	{sugarFree,mediterranean}	metric	en	\N	t	2026-01-31 21:30:51.377447+00	2026-02-02 19:25:27.284534+00	\N	\N	f	["air_fryer", "thermomix_TM6"]	\N	1	{}	{}
\.



COPY "public"."user_recipe_ingredients" ("id", "user_recipe_id", "ingredient_id", "name_en", "name_es", "quantity", "measurement_unit_id", "unit_text", "image_url", "display_order", "recipe_section_en", "recipe_section_es", "notes", "optional", "created_at", "updated_at") FROM stdin;
78f24328-7263-48eb-ae5c-8f92981a3a65	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
59c9b025-9255-430b-b525-9a10265da029	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	white rice	\N	100.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
8c3ed453-106d-4f6f-ab33-c20c80095adc	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	asparagus	\N	150.00	\N	grams	\N	2	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
398751cf-ac02-4929-8b8c-684cbca6ad0e	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	olive oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	3	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
f83a89b6-5bb8-40fb-8871-af8c67b4a6ee	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	4	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
255bb9d4-e5d3-423d-993a-7027fb152b98	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	lemon juice	\N	10.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	5	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
d4bbfc8c-93ba-4086-90b5-fd138010d534	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	6	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
3fa396cc-bb94-4df1-9518-3437c320bddc	6de3ccca-f494-4bc7-b35f-f88fab8233a9	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	7	Main	Principal	\N	f	2026-02-02 23:32:36.336686+00	2026-02-02 23:32:36.336686+00
aa582a00-096b-4aba-9544-37f207e3fe61	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
003bb194-9e69-44b2-b7bc-9fa97531a19c	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	quinoa	\N	100.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
941705ea-8ae6-400d-8f3c-3c642ceb0141	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	asparagus	\N	200.00	\N	grams	\N	2	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
07155186-f636-438d-b752-363086816f50	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	3	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
d4fce686-2be3-4e29-89ab-0c27b671f28e	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	4	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
fb4ab971-6df8-40fa-a09f-ce70d53e9640	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	lemon juice	\N	20.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	5	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
0119eb7a-5510-4d35-9bc8-741e5068166d	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	6	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
a3e85938-7d6b-4ab9-be24-216bf0e55580	cec7915c-4ce9-4d5f-b270-f9a83831b127	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	7	Main	Principal	\N	f	2026-02-02 23:35:31.209243+00	2026-02-02 23:35:31.209243+00
aa1c7f3d-1e39-449d-aac9-984768a2095b	81fb771c-78c9-4523-a14f-5052144931c2	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
32fb08b5-8eb0-4b90-8ed2-012d5902ca97	81fb771c-78c9-4523-a14f-5052144931c2	\N	quinoa	\N	100.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
a6f4c612-2c05-4da7-bf49-fb1ff1312d21	81fb771c-78c9-4523-a14f-5052144931c2	\N	asparagus	\N	200.00	\N	grams	\N	2	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
c77f97a5-0c5b-4bbf-8986-e6a902cce5b8	81fb771c-78c9-4523-a14f-5052144931c2	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	3	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
db7b58e7-35e3-4074-abc1-dcde590456b9	81fb771c-78c9-4523-a14f-5052144931c2	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	4	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
d30ae9d2-69ad-471f-a4a5-fb7ec8e74fad	81fb771c-78c9-4523-a14f-5052144931c2	\N	lemon juice	\N	20.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	5	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
f67a6f86-5075-4723-97d0-6caf84e93acb	81fb771c-78c9-4523-a14f-5052144931c2	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	6	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
c222c074-b145-4599-bff9-8081b0ace36c	81fb771c-78c9-4523-a14f-5052144931c2	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	7	Main	Principal	\N	f	2026-02-02 23:35:49.88921+00	2026-02-02 23:35:49.88921+00
45f0f884-122c-4ec9-a227-15e50b22347b	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
eeb11056-4633-4ad4-b440-7c1a1c401028	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	quinoa	\N	100.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
4cd89ebd-8a7a-415b-94e0-d0d66cee6d13	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	asparagus	\N	200.00	\N	grams	\N	2	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
63016b1c-f15f-4ed8-9bec-d4a05d271916	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	3	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
a7d54a4e-f479-4c38-82a8-3d52a05a2031	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	4	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
8862eaf1-af52-417f-9ee2-5d7c3e30b4d8	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	lemon juice	\N	20.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	5	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
79f29cbd-031f-4c03-8016-991260d961ea	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	6	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
0ae6c02f-d248-4cf4-b481-17a0e6ea9ff9	d7a68f62-81c1-4f67-92b5-569aab9154ea	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	7	Main	Principal	\N	f	2026-02-02 23:35:57.592052+00	2026-02-02 23:35:57.592052+00
3789b692-4df3-4dce-8f83-ef565bd1ea8b	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
07cf14d5-4a53-4209-8fce-3f6eae5105f4	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	quinoa	\N	100.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
03f55f99-310d-468a-818c-955e3cde2318	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	asparagus	\N	200.00	\N	grams	\N	2	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
6c6b318a-c292-407f-a030-7732c48b9e7e	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	3	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
9e4f734d-40d3-44a1-951d-98a2b0612370	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	4	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
2f93d6b7-1422-49c3-aedb-f0d5c488b5be	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	lemon juice	\N	20.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	5	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
8d92f4de-cfc3-4706-8607-89fd534ee39d	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	6	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
6ff1512c-f846-4c4f-8412-8c37a6e3bcdc	abed1395-ed78-4d74-a8b6-64eac10b716f	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	7	Main	Principal	\N	f	2026-02-02 23:36:07.752721+00	2026-02-02 23:36:07.752721+00
30a75b25-9be2-41a3-a91a-4c727ca84cda	7888f272-1358-4e75-a331-a4baffee184d	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 00:01:52.123221+00	2026-02-03 00:01:52.123221+00
098f2f2b-30d0-4a72-b85c-c2748a7181f5	7888f272-1358-4e75-a331-a4baffee184d	\N	tomatoes	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	1	Main	Principal	\N	f	2026-02-03 00:01:52.123221+00	2026-02-03 00:01:52.123221+00
f78e79d9-30c8-4bbe-afdc-fe45e5331295	7888f272-1358-4e75-a331-a4baffee184d	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 00:01:52.123221+00	2026-02-03 00:01:52.123221+00
b3c8a483-b598-4f5d-8a74-abffc6312a5a	7888f272-1358-4e75-a331-a4baffee184d	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 00:01:52.123221+00	2026-02-03 00:01:52.123221+00
cd520763-84be-4c79-bdde-0001fae90ec0	7888f272-1358-4e75-a331-a4baffee184d	\N	dried oregano	\N	1.00	\N	teaspoon	\N	4	Main	Principal	\N	f	2026-02-03 00:01:52.123221+00	2026-02-03 00:01:52.123221+00
c4a04f62-cfd6-49eb-ab69-e4feb74e092b	7888f272-1358-4e75-a331-a4baffee184d	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 00:01:52.123221+00	2026-02-03 00:01:52.123221+00
2c3b0d59-9da1-402b-a30e-96d71841da59	7888f272-1358-4e75-a331-a4baffee184d	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 00:01:52.123221+00	2026-02-03 00:01:52.123221+00
4f3f8c2d-906d-476c-b7d5-d713a28a2c15	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	chicken breast	\N	400.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
db6bd52d-642f-4ad2-8723-ff84c2841f00	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	tomatoes	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	1	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
84702018-d995-45e1-9b30-091e916eb5be	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
fd6c5ad6-ed3f-414e-9d6f-14d1241b3837	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
e502a1b9-609e-409f-844a-5e94e4e0f8eb	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	dried oregano	\N	2.00	\N	teaspoons	\N	4	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
1c6e9151-c522-40d2-b7a7-d8b22fea23ce	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	salt	\N	1.00	\N	teaspoon	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
d8bf244a-4751-43ce-b9ae-94497d7da1fb	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	black pepper	\N	1.00	\N	teaspoon	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
0898026a-85c3-418a-a0fd-4c4ed63bc441	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	\N	red pepper flakes	\N	1.00	\N	teaspoon	\N	7	Main	Principal	\N	f	2026-02-03 00:15:23.61849+00	2026-02-03 00:15:23.61849+00
92251f10-55c5-49b4-ad3a-c3a2e977d956	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	chicken breast	\N	500.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
4ed7e743-1350-4347-b2c6-dceb42429539	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	tomatoes	\N	400.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	1	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
aafdff18-bbe1-41d3-a2fb-f92ed50708ec	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
8a50163d-ab72-4558-a63d-0ce554c10c2d	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
88746564-ca06-4fb5-8588-504dd9b98e8f	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	dried oregano	\N	10.00	\N	grams	\N	4	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
a186ea0d-32b7-4486-ac77-6e05a44f9b38	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
4a841fa5-7baf-499b-b987-297c14cdeb59	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
2d9b293e-b602-40cd-8353-790952179712	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	red pepper flakes	\N	1.00	\N	gram	\N	7	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
33af7ac5-1308-49a0-886d-4bffd3126031	d9495978-2959-40cb-b49c-de131a4eaf8e	\N	rice	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png	8	Main	Principal	\N	f	2026-02-03 00:17:08.382987+00	2026-02-03 00:17:08.382987+00
3c8b2293-c7a6-4a98-9d5c-61a77690134a	8e491e41-0691-4dc4-a663-c65016a36b00	\N	ground beef	\N	400.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png	0	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
f2099a2c-ba9a-42d7-90c0-f41f6e1664dd	8e491e41-0691-4dc4-a663-c65016a36b00	\N	tomatoes	\N	400.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	1	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
ba59bee2-e072-4212-af82-f631fa9b6eb3	8e491e41-0691-4dc4-a663-c65016a36b00	\N	rice	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png	2	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
9de3560c-3c13-4002-a201-23c20e884cb5	8e491e41-0691-4dc4-a663-c65016a36b00	\N	onion	\N	100.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/cebolla.png	3	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
b0b8a8a8-c4ec-4c71-8d79-5f28133a52da	8e491e41-0691-4dc4-a663-c65016a36b00	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	4	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
b98b1cf4-5aa5-4150-8ff4-654fa0450c06	8e491e41-0691-4dc4-a663-c65016a36b00	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	5	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
dab81446-26ec-47da-a8d3-11dd900735d5	8e491e41-0691-4dc4-a663-c65016a36b00	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	6	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
7e27d8af-1115-4adb-a2ba-5332e18c84a9	8e491e41-0691-4dc4-a663-c65016a36b00	\N	pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal_y_pimienta.png?t=2024-11-15T21%3A07%3A48.065Z	7	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
e99e6e2c-6429-48a4-b36c-62896383fcf1	8e491e41-0691-4dc4-a663-c65016a36b00	\N	dried oregano	\N	5.00	\N	grams	\N	8	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
8f6183b5-3071-4865-9fd3-807d607c6571	8e491e41-0691-4dc4-a663-c65016a36b00	\N	water	\N	400.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png	9	Main	Principal	\N	f	2026-02-03 00:18:40.81322+00	2026-02-03 00:18:40.81322+00
2d4d6b7f-8d90-47a7-887c-8fcb00874bd6	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	\N	ramen noodles	\N	100.00	\N	grams	\N	0	Main	Principal	\N	f	2026-02-03 00:26:07.338006+00	2026-02-03 00:26:07.338006+00
e6b64fb5-1c12-4df6-bd02-4814aad85011	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	\N	mixed vegetables	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/surtido_de_nueces_1743207250295.png	1	Main	Principal	\N	f	2026-02-03 00:26:07.338006+00	2026-02-03 00:26:07.338006+00
7dcc48da-ebac-4c50-8aa6-9d1bb9f1f05c	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	2	Main	Principal	\N	f	2026-02-03 00:26:07.338006+00	2026-02-03 00:26:07.338006+00
290e2364-49e7-461a-b068-5b664089f677	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	\N	broth	\N	1.00	\N	liter	\N	3	Main	Principal	\N	f	2026-02-03 00:26:07.338006+00	2026-02-03 00:26:07.338006+00
67e6fcdb-7508-499e-9ba0-64b26fef9b93	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	\N	soy sauce	\N	30.00	\N	ml	\N	4	Main	Principal	\N	f	2026-02-03 00:26:07.338006+00	2026-02-03 00:26:07.338006+00
c38113c5-f84d-44aa-8e27-460f34ad4731	349f970a-8e3a-4051-b3aa-d335c517e26e	\N	ramen noodles	\N	100.00	\N	grams	\N	0	Main	Principal	\N	f	2026-02-03 00:28:01.072115+00	2026-02-03 00:28:01.072115+00
121e4113-772b-4b78-8da8-ec0dd006f122	349f970a-8e3a-4051-b3aa-d335c517e26e	\N	mixed vegetables	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/surtido_de_nueces_1743207250295.png	1	Main	Principal	\N	f	2026-02-03 00:28:01.072115+00	2026-02-03 00:28:01.072115+00
b6fc06fd-66d1-4dc6-9ee5-d0899925422f	349f970a-8e3a-4051-b3aa-d335c517e26e	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	2	Main	Principal	\N	f	2026-02-03 00:28:01.072115+00	2026-02-03 00:28:01.072115+00
9e0d028b-0d02-4512-833a-78c50cb7e4bc	349f970a-8e3a-4051-b3aa-d335c517e26e	\N	broth	\N	1.00	\N	liter	\N	3	Main	Principal	\N	f	2026-02-03 00:28:01.072115+00	2026-02-03 00:28:01.072115+00
ac1aafc9-f50b-43b5-8042-b4946d010337	349f970a-8e3a-4051-b3aa-d335c517e26e	\N	soy sauce	\N	30.00	\N	ml	\N	4	Main	Principal	\N	f	2026-02-03 00:28:01.072115+00	2026-02-03 00:28:01.072115+00
3065113d-510f-4471-af03-a5e4835fe964	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	beef	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png	0	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
885338a3-d5e9-43e6-864d-48b6317bf391	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	broccoli	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png	1	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
82137baa-cb35-4dc9-8ab8-91f58f0d636c	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	soy sauce	\N	50.00	\N	ml	\N	2	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
48b2417c-bd22-4bbf-9ac1-4876ac0706fa	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
6ef8a0d5-90f6-4fc3-b540-c694e1a92211	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	ginger	\N	10.00	\N	grams	\N	4	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
3de2f387-5d38-492a-8876-9bb9d42789ff	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	sesame oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png	5	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
13305564-9a83-4fe9-a05c-4a98d1685860	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	cornstarch	\N	10.00	\N	grams	\N	6	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
fe53be5b-c3cb-4768-9ebb-17f2a51bcea7	356a7dc6-2b8f-4989-8abd-96690d43819e	\N	water	\N	100.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png	7	Main	Principal	\N	f	2026-02-03 00:29:17.234787+00	2026-02-03 00:29:17.234787+00
9308b475-ed0a-412f-88d7-8d236ca79f68	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	beef	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png	0	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
334e73af-ad03-4f56-afe8-71eea61ec05d	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	broccoli	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png	1	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
86fa64d4-c38f-4af7-8362-f5e11eb4030d	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	soy sauce	\N	50.00	\N	ml	\N	2	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
afe81d0a-b012-4a1d-86a7-581a69edcc60	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
3976bf9e-4e99-452c-b69e-40e07812fa68	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	ginger	\N	10.00	\N	grams	\N	4	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
b840d83a-59fb-4ea4-a3eb-e42ba6e308e6	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	sesame oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png	5	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
65985b85-d2b8-4ef2-96aa-954e393250df	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	cornstarch	\N	10.00	\N	grams	\N	6	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
9c912577-5c89-4459-ad22-8122f6722a6e	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	\N	water	\N	100.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png	7	Main	Principal	\N	f	2026-02-03 00:37:10.082512+00	2026-02-03 00:37:10.082512+00
53624765-4f76-41ad-ac50-924b09c9193b	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	beef	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png	0	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
cb3c0d2e-906f-4e39-9286-c0d4f3a32d7c	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	broccoli	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png	1	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
16f839aa-4d6a-4b9d-9955-65e318f03a86	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	soy sauce	\N	50.00	\N	ml	\N	2	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
f63e0ea9-856b-44e2-9929-ca50f64d634e	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
0fd89477-d184-4484-86a5-9fa665fcc1b7	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	ginger	\N	10.00	\N	grams	\N	4	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
1a4e55a4-f542-459b-8bde-64155588a002	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	sesame oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png	5	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
1ac7e963-9fe9-4e0f-9df0-83a4f82c5ad7	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	cornstarch	\N	10.00	\N	grams	\N	6	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
746987e9-6f88-4a70-a18c-f74406abe65f	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	\N	water	\N	100.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png	7	Main	Principal	\N	f	2026-02-03 00:39:09.29502+00	2026-02-03 00:39:09.29502+00
20c06ecd-5be9-42ea-9387-cceee147c87a	2c0cf733-0852-4340-ae48-0b19429b320d	\N	beef	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png	0	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
f66b22c6-5400-4bfd-862f-3b4b1e0fc882	2c0cf733-0852-4340-ae48-0b19429b320d	\N	broccoli	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png	1	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
b0708d37-98c2-4012-8c66-017ef32188e0	2c0cf733-0852-4340-ae48-0b19429b320d	\N	soy sauce	\N	50.00	\N	ml	\N	2	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
2a19b60e-d081-466b-9f3b-0c997d5f386e	2c0cf733-0852-4340-ae48-0b19429b320d	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
6f6a7b83-084b-4f87-b318-40d06b87adce	2c0cf733-0852-4340-ae48-0b19429b320d	\N	ginger	\N	10.00	\N	grams	\N	4	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
34fcefdc-4b01-460b-a3b4-ba5fbbf84e9b	2c0cf733-0852-4340-ae48-0b19429b320d	\N	sesame oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png	5	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
555be799-165c-407b-a028-cfb0989e3d6a	2c0cf733-0852-4340-ae48-0b19429b320d	\N	cornstarch	\N	10.00	\N	grams	\N	6	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
8e774442-1e0b-4b65-b869-e1f7d5e12a8a	2c0cf733-0852-4340-ae48-0b19429b320d	\N	water	\N	100.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png	7	Main	Principal	\N	f	2026-02-03 00:39:50.702094+00	2026-02-03 00:39:50.702094+00
457f48df-6953-4cfe-8e9a-c9f3b2420719	3db03012-8af9-45f5-927a-7a68864d5d3a	\N	mushrooms	\N	200.00	\N	grams	\N	0	Main	Principal	\N	f	2026-02-03 00:47:50.122086+00	2026-02-03 00:47:50.122086+00
5cec9b68-7d04-4b58-8d17-b6f21bd356d2	3db03012-8af9-45f5-927a-7a68864d5d3a	\N	tomatoes	\N	150.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	1	Main	Principal	\N	f	2026-02-03 00:47:50.122086+00	2026-02-03 00:47:50.122086+00
c8cdf006-7e13-452e-8125-da3b282823a3	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
489c97bf-6aeb-4175-87c8-825973a923d4	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	mushrooms	\N	150.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
b0ebf304-003c-4854-bb67-46048d9a04e7	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	tomatoes	\N	100.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	2	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
00b95d93-83fb-4567-9715-598545172f78	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	olive oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	3	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
b34d5f29-7d27-4a2f-978b-7e883f3b66ba	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	garlic	\N	1.00	\N	clove	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	4	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
4703f920-80f1-409f-ad34-ffc158906e4d	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	salt	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
e75e42be-74bd-4c5e-b9ad-9526493560fd	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	pepper	\N	1.00	\N	gram	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal_y_pimienta.png?t=2024-11-15T21%3A07%3A48.065Z	6	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
eb07802c-3dae-4c4a-bcf4-de09a17a0506	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	fresh basil	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/espinca.png	7	Main	Principal	\N	f	2026-02-03 00:48:55.387075+00	2026-02-03 00:48:55.387075+00
2bb64d40-4603-47d8-839f-c58b3f00f46d	94b56036-d308-4130-9fb0-77eccf5389cb	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
0c9281ee-92de-4922-a3b4-24c7407293eb	94b56036-d308-4130-9fb0-77eccf5389cb	\N	rice	\N	150.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png	1	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
4dccc8aa-a398-4223-9dc4-a42e19dcee7d	94b56036-d308-4130-9fb0-77eccf5389cb	\N	tomatoes	\N	250.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	2	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
39e6f4ee-5a6e-4f4e-87e2-f5b25c05e083	94b56036-d308-4130-9fb0-77eccf5389cb	\N	asparagus	\N	100.00	\N	grams	\N	3	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
8fa7d638-f304-4c4f-a2f0-6548f004e571	94b56036-d308-4130-9fb0-77eccf5389cb	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	4	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
c26599ba-c8af-49af-a530-62aec7fb0a5b	94b56036-d308-4130-9fb0-77eccf5389cb	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
47839bab-e058-4c05-9b00-6e475165241b	94b56036-d308-4130-9fb0-77eccf5389cb	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
e2eaeb3a-ea6c-4078-aee9-12be8b5ec19b	94b56036-d308-4130-9fb0-77eccf5389cb	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	7	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
c34ff058-794e-451e-8c6e-a2412bf2b693	94b56036-d308-4130-9fb0-77eccf5389cb	\N	lemon juice	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	8	Main	Principal	\N	f	2026-02-03 00:57:18.967559+00	2026-02-03 00:57:18.967559+00
6f1357ad-c11d-4434-afbb-ea937225efdb	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
ad491aa6-20d3-4ce5-93eb-7aaef6b7bc59	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	rice	\N	150.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png	1	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
650c8445-b087-44c8-981c-a74be4ffde2a	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	tomatoes	\N	250.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	2	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
6de7b096-c133-4ce8-9600-15685528cdff	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	asparagus	\N	100.00	\N	grams	\N	3	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
3e808a73-6305-4588-9caf-c17fedc4ea4c	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	4	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
40535cc8-89d5-4300-9ea2-a4263173a13b	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
3ede67f6-3895-4fcb-bede-4914cd45df5c	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
ee34250b-72a1-4636-8a90-939cbae934ab	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	7	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
191d7bd1-b30d-4fca-b5a6-15abec14c531	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	lemon juice	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	8	Main	Principal	\N	f	2026-02-03 03:10:03.288047+00	2026-02-03 03:10:03.288047+00
c51296da-814f-4caa-9d08-c5cbe1b4514d	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	chicken breast	\N	500.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
5856989a-8307-405e-a2fe-e0b44f4eefae	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	rice	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png	1	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
ba0b69d0-61e2-4525-b86e-76d32a641908	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	tomatoes	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png	2	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
4486fcce-f899-4812-a7aa-3563386a9b90	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	zucchini	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/calabacita.png	3	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
1da3f488-9a85-4c4c-afdb-39e3c46a0dc3	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	4	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
9c0beea1-4637-4455-9264-726639576a1e	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
5595ad71-4d24-4b94-a93e-6f867bbe3c5d	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
bf2f2297-00e5-499e-a95d-37c4486d7bdf	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	7	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
dee46032-59c0-45f4-9a9e-eac1b4eaaa61	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	lemon juice	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	8	Main	Principal	\N	f	2026-02-03 03:15:26.044991+00	2026-02-03 03:15:26.044991+00
f0e8b7ac-bbef-4c4b-bb8c-8f2e5bc17875	27950842-bff9-4971-9d2e-df32134edf91	\N	chicken breast	\N	250.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
4377e1c6-4a3c-4fba-9a14-723d7dd62c30	27950842-bff9-4971-9d2e-df32134edf91	\N	asparagus	\N	200.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
871a0bcf-4ada-4f68-ae14-685dccd46c04	27950842-bff9-4971-9d2e-df32134edf91	\N	olive oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
473b9e97-ae5b-4a11-b42f-c476eef77bb4	27950842-bff9-4971-9d2e-df32134edf91	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
5cd8cd77-753c-4b4a-84d4-b4825e67f7ee	27950842-bff9-4971-9d2e-df32134edf91	\N	lemon juice	\N	10.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	4	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
0b9f2846-99db-49c5-8242-5fdd559fbd97	27950842-bff9-4971-9d2e-df32134edf91	\N	salt	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
b2c8d6ab-c4f8-44bf-a33c-3bf0e0c8cd01	27950842-bff9-4971-9d2e-df32134edf91	\N	black pepper	\N	1.00	\N	gram	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
0c0c6bf2-5bfb-4838-8382-d3d2f6445062	27950842-bff9-4971-9d2e-df32134edf91	\N	dried oregano	\N	2.00	\N	grams	\N	7	Main	Principal	\N	f	2026-02-03 22:20:14.059197+00	2026-02-03 22:20:14.059197+00
43662660-2232-4bfd-9519-9e9fd933fea0	5ee2165c-67e8-4819-92e5-0978578a667d	\N	chicken breast	\N	250.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
b0e20d5d-38fb-4ffc-a1f6-456c21efbffe	5ee2165c-67e8-4819-92e5-0978578a667d	\N	asparagus	\N	200.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
96140959-aeed-4017-a050-9734800af607	5ee2165c-67e8-4819-92e5-0978578a667d	\N	olive oil	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
8e1aab9d-7e83-4c0b-885a-b74af74c14b1	5ee2165c-67e8-4819-92e5-0978578a667d	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
7f99221b-6575-469d-a429-7f082d50a67a	5ee2165c-67e8-4819-92e5-0978578a667d	\N	lemon juice	\N	10.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	4	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
e61a06c0-b916-4961-a907-2827e584a9ea	5ee2165c-67e8-4819-92e5-0978578a667d	\N	salt	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
30af7a88-ae2e-4eb5-bcf2-4deee7e6601e	5ee2165c-67e8-4819-92e5-0978578a667d	\N	black pepper	\N	1.00	\N	gram	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
1f37bda3-634d-44e8-9609-123c5e707ea2	5ee2165c-67e8-4819-92e5-0978578a667d	\N	dried oregano	\N	2.00	\N	grams	\N	7	Main	Principal	\N	f	2026-02-03 22:23:34.423495+00	2026-02-03 22:23:34.423495+00
ec5b0a62-1d73-4974-af5d-94571b3ac645	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	chicken breast	\N	300.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
9a482096-b5b5-43c7-bb9a-fb2e277ea2c4	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	asparagus	\N	200.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
2b459f19-7051-4784-97ea-cd80364b6b7c	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
0e8bc33e-6bd9-450c-a7d4-ba5ace8e5d4c	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
b602fbf9-f783-4321-a2f9-92c9acf45943	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	lemon juice	\N	15.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	4	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
8faf4001-0542-4ffb-b099-4b857142c571	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
06911d80-2fdf-4944-befc-5659d8de9f42	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
c7757b67-e08e-4f60-9359-09670c174703	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	dried oregano	\N	5.00	\N	grams	\N	7	Main	Principal	\N	f	2026-02-03 22:32:11.976233+00	2026-02-03 22:32:11.976233+00
c3b3904f-f5ad-4ea5-92a4-1a2aa4ad944d	adb24066-7049-4321-a326-90f56bf30c1a	\N	tofu	\N	300.00	\N	grams	\N	0	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
1f0945af-937d-4191-9db5-9978049136ce	adb24066-7049-4321-a326-90f56bf30c1a	\N	asparagus	\N	200.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
99ecbc33-2dbe-4c4f-b35b-588b745a06ad	adb24066-7049-4321-a326-90f56bf30c1a	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
fa07ae63-e188-4fd1-9375-3f842bdeef86	adb24066-7049-4321-a326-90f56bf30c1a	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
2dcff86c-20f8-4b4d-b93d-03af6390eaa8	adb24066-7049-4321-a326-90f56bf30c1a	\N	lemon juice	\N	20.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	4	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
63dc181c-ff2e-4441-b919-c566ce47acc8	adb24066-7049-4321-a326-90f56bf30c1a	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
941a3ebc-a16d-465b-988f-cba83f27d4f2	adb24066-7049-4321-a326-90f56bf30c1a	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
7008e324-9f5a-4431-bca1-b4987eb6a46a	adb24066-7049-4321-a326-90f56bf30c1a	\N	dried oregano	\N	5.00	\N	grams	\N	7	Main	Principal	\N	f	2026-02-03 22:32:50.92065+00	2026-02-03 22:32:50.92065+00
08ecfbe5-8168-4fc5-84e4-24563c166420	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	tofu	\N	300.00	\N	grams	\N	0	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
05785b40-b9c2-471a-9f8d-a32882833e5e	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	asparagus	\N	200.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
f0e475d7-9c4e-40b6-9f61-3d7ef09b3fe5	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
68647910-0a6e-4e83-87a0-a594a49314a7	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	garlic	\N	3.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
23217c91-7bad-4349-991b-9b47d08e71f2	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	lemon juice	\N	20.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	4	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
8b20de1d-9404-43a8-ae1b-6be78bb8ac20	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
b320f900-ccc4-4edd-ad1c-3ff2a575a501	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
bca4c42b-c60d-4fcd-834d-fc6a78c830d8	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	dried oregano	\N	5.00	\N	grams	\N	7	Main	Principal	\N	f	2026-02-03 22:40:02.164195+00	2026-02-03 22:40:02.164195+00
ec344755-5490-436c-b57e-d8d2c4dcc5ee	384de74f-a63e-4738-ac7e-248512e372e1	\N	chicken breast	\N	200.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png	0	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
a9589f4a-29ff-4a86-91ae-a22b6c603427	384de74f-a63e-4738-ac7e-248512e372e1	\N	asparagus	\N	150.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
bd64fa98-14b6-42c7-b1c3-d45553fa691c	384de74f-a63e-4738-ac7e-248512e372e1	\N	olive oil	\N	20.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
236b516b-6499-49a4-bcd3-f84e43040a44	384de74f-a63e-4738-ac7e-248512e372e1	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
15200cfb-ab87-4054-903b-8c14746b5457	384de74f-a63e-4738-ac7e-248512e372e1	\N	lemon juice	\N	10.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	4	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
5bde3ac8-6158-405b-ba24-94215143f456	384de74f-a63e-4738-ac7e-248512e372e1	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
5219cc34-d1d2-4b7b-846c-daa129e3d6d1	384de74f-a63e-4738-ac7e-248512e372e1	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
14408125-bad3-4d5e-b521-6c3f512d6ec3	384de74f-a63e-4738-ac7e-248512e372e1	\N	dried oregano	\N	5.00	\N	grams	\N	7	Main	Principal	\N	f	2026-02-03 22:41:56.114373+00	2026-02-03 22:41:56.114373+00
325eafab-45db-4cc0-bb05-45be9428596b	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	tofu	\N	300.00	\N	grams	\N	0	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
8844a8c5-6fc4-413a-b08d-10031d113254	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	asparagus	\N	200.00	\N	grams	\N	1	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
faf4de0e-0d1b-4eac-a788-d2bf4f731e79	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	olive oil	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png	2	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
8d8044bc-ce37-4812-96c8-ca0c5b84757f	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	garlic	\N	2.00	\N	cloves	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png	3	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
d704d598-fe93-49d7-b6ba-38c41d612ed3	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	lemon juice	\N	30.00	\N	ml	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png	4	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
8fcae1d1-c680-4f07-bd6e-6cd456db9bae	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	salt	\N	5.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png	5	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
bdf7804f-d933-466d-bee5-acbbe3ed4f52	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	black pepper	\N	2.00	\N	grams	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png	6	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
8b225d04-ab29-4273-9a79-c68ce7ff7412	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	dried oregano	\N	5.00	\N	grams	\N	7	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
d10dad96-8976-4104-a923-18faa97daaeb	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	quinoa	\N	150.00	\N	grams	\N	8	Main	Principal	\N	f	2026-02-03 22:43:54.790884+00	2026-02-03 22:43:54.790884+00
\.



COPY "public"."user_recipe_step_ingredients" ("id", "user_recipe_step_id", "user_recipe_ingredient_id", "quantity", "display_order", "optional", "created_at") FROM stdin;
c5580b38-d50a-4631-b55f-c6d1d6562c74	d5a4fbda-27e8-4545-ae35-a455abd63edc	f83a89b6-5bb8-40fb-8871-af8c67b4a6ee	\N	0	f	2026-02-02 23:32:36.644342+00
864ff267-8627-48f1-a6de-8af44542b8fc	d5a4fbda-27e8-4545-ae35-a455abd63edc	8c3ed453-106d-4f6f-ab33-c20c80095adc	\N	1	f	2026-02-02 23:32:36.644342+00
43db0476-c884-44b2-84e6-5a3d12ee9288	53a71d0a-b990-49f1-8a24-368a8aab8222	398751cf-ac02-4929-8b8c-684cbca6ad0e	\N	0	f	2026-02-02 23:32:36.644342+00
aa3ebf82-8a15-48ac-a5f5-5f332f8364ab	53a71d0a-b990-49f1-8a24-368a8aab8222	d4bbfc8c-93ba-4086-90b5-fd138010d534	\N	1	f	2026-02-02 23:32:36.644342+00
c760c71d-0822-4164-849d-0cab3665de45	53a71d0a-b990-49f1-8a24-368a8aab8222	3fa396cc-bb94-4df1-9518-3437c320bddc	\N	2	f	2026-02-02 23:32:36.644342+00
6ec059a9-3dd8-47bc-98a4-63715fde6032	53a71d0a-b990-49f1-8a24-368a8aab8222	255bb9d4-e5d3-423d-993a-7027fb152b98	\N	3	f	2026-02-02 23:32:36.644342+00
a06d3e9d-ff95-450b-bb4d-a0510ba4008f	877f057f-a93d-41c5-b15e-ae1bceea524d	78f24328-7263-48eb-ae5c-8f92981a3a65	\N	0	f	2026-02-02 23:32:36.644342+00
da985d28-64fe-40ef-ac17-23ce998dd7a0	544b8407-ba53-4136-96ce-72c54c740bc9	59c9b025-9255-430b-b525-9a10265da029	\N	0	f	2026-02-02 23:32:36.644342+00
3f30b586-088d-437f-9dd3-cface9f34680	25d8caf2-ff20-4b68-a14b-f528505998df	78f24328-7263-48eb-ae5c-8f92981a3a65	\N	0	f	2026-02-02 23:32:36.644342+00
b718c7f9-f2f6-4809-9f5b-fe545a0c1c66	25d8caf2-ff20-4b68-a14b-f528505998df	8c3ed453-106d-4f6f-ab33-c20c80095adc	\N	1	f	2026-02-02 23:32:36.644342+00
cfbeb0aa-caf5-4fbc-8270-aef3c38a01c4	1fa051e2-8a30-4f54-a30d-cf95564adeb7	78f24328-7263-48eb-ae5c-8f92981a3a65	\N	0	f	2026-02-02 23:32:36.644342+00
7d2676da-72d8-4bae-9115-b6d3a650c752	1fa051e2-8a30-4f54-a30d-cf95564adeb7	8c3ed453-106d-4f6f-ab33-c20c80095adc	\N	1	f	2026-02-02 23:32:36.644342+00
3b6f278d-ac7a-401c-b7c4-0903b20d7a08	1fa051e2-8a30-4f54-a30d-cf95564adeb7	59c9b025-9255-430b-b525-9a10265da029	\N	2	f	2026-02-02 23:32:36.644342+00
d4c24e22-5dbd-40e5-aeb4-570dae3eb88d	07495113-e201-4d29-b4e4-69d933c2e075	003bb194-9e69-44b2-b7bc-9fa97531a19c	\N	0	f	2026-02-02 23:35:31.425966+00
c2911b5f-6d19-456a-9933-30eeeb8d8d37	cf83912f-4a07-4f97-b936-591c120e45e2	003bb194-9e69-44b2-b7bc-9fa97531a19c	\N	0	f	2026-02-02 23:35:31.425966+00
ef6440cf-4df5-4de2-bdd2-65f935265866	dd51a8c8-5601-4b1f-a44c-1386c9362a0f	d4fce686-2be3-4e29-89ab-0c27b671f28e	\N	0	f	2026-02-02 23:35:31.425966+00
55bef8ff-d9a2-4e66-b84c-7c8eafeea8d3	dd51a8c8-5601-4b1f-a44c-1386c9362a0f	aa582a00-096b-4aba-9544-37f207e3fe61	\N	1	f	2026-02-02 23:35:31.425966+00
fb13d242-e1ea-4bbb-8596-4a572583fe99	dd51a8c8-5601-4b1f-a44c-1386c9362a0f	0119eb7a-5510-4d35-9bc8-741e5068166d	\N	2	f	2026-02-02 23:35:31.425966+00
51ec1077-5aa5-48e4-b219-0471c6bba334	dd51a8c8-5601-4b1f-a44c-1386c9362a0f	a3e85938-7d6b-4ab9-be24-216bf0e55580	\N	3	f	2026-02-02 23:35:31.425966+00
5072a730-c8af-48df-bf30-b5371a11f4ff	dd51a8c8-5601-4b1f-a44c-1386c9362a0f	fb4ab971-6df8-40fa-a09f-ce70d53e9640	\N	4	f	2026-02-02 23:35:31.425966+00
973e1ccc-07a0-4afe-9874-f57d533c826f	dd51a8c8-5601-4b1f-a44c-1386c9362a0f	07155186-f636-438d-b752-363086816f50	\N	5	f	2026-02-02 23:35:31.425966+00
8f1e1938-ae06-41e8-9c5c-26ee183a1794	3cd8f0e8-1500-4b15-86ce-134f7d0b7101	aa582a00-096b-4aba-9544-37f207e3fe61	\N	0	f	2026-02-02 23:35:31.425966+00
1c592603-54d5-456e-a157-1dd2f2666fd3	e2c96964-3451-46e1-b4ff-4b98d55f578b	941705ea-8ae6-400d-8f3c-3c642ceb0141	\N	0	f	2026-02-02 23:35:31.425966+00
9fc94e53-9ffd-4d29-bffb-b051adb36f3f	e2c96964-3451-46e1-b4ff-4b98d55f578b	07155186-f636-438d-b752-363086816f50	\N	1	f	2026-02-02 23:35:31.425966+00
e14d7ccb-1d64-4742-a6a3-782d6b3a7b6c	e2c96964-3451-46e1-b4ff-4b98d55f578b	0119eb7a-5510-4d35-9bc8-741e5068166d	\N	2	f	2026-02-02 23:35:31.425966+00
c2227595-3b48-4d81-8599-9dfa6b2548f9	e2c96964-3451-46e1-b4ff-4b98d55f578b	a3e85938-7d6b-4ab9-be24-216bf0e55580	\N	3	f	2026-02-02 23:35:31.425966+00
1a947c02-1ab7-45ff-919f-3527bb8f3d1f	babf694d-3b80-4979-bea2-1187fd1cbc04	941705ea-8ae6-400d-8f3c-3c642ceb0141	\N	0	f	2026-02-02 23:35:31.425966+00
fb741fed-e908-41a6-9cd8-75162c794600	33977cc9-7b04-468c-8408-fdfbaea74f9a	003bb194-9e69-44b2-b7bc-9fa97531a19c	\N	0	f	2026-02-02 23:35:31.425966+00
0b077397-3766-410e-a413-64c2f1e839e3	7d163776-e19c-4442-9581-5d83f9afbbc4	fb4ab971-6df8-40fa-a09f-ce70d53e9640	\N	0	f	2026-02-02 23:35:31.425966+00
8ec43361-a93c-466b-b759-185d9ef139b7	5f61e3c2-c39a-48ea-9916-81efd171a05a	32fb08b5-8eb0-4b90-8ed2-012d5902ca97	\N	0	f	2026-02-02 23:35:50.122488+00
feb9153f-3465-4490-b8cc-9aa90e8f7204	24c67850-c921-45e6-923c-9ce8c2b90396	32fb08b5-8eb0-4b90-8ed2-012d5902ca97	\N	0	f	2026-02-02 23:35:50.122488+00
a78d0a2c-0dc7-4d84-ba58-060f8416612a	3224fb7f-d313-4761-9d07-ee8b994abd16	db7b58e7-35e3-4074-abc1-dcde590456b9	\N	0	f	2026-02-02 23:35:50.122488+00
8acefd41-6fce-4fae-8356-c8fa912d21b5	3224fb7f-d313-4761-9d07-ee8b994abd16	aa1c7f3d-1e39-449d-aac9-984768a2095b	\N	1	f	2026-02-02 23:35:50.122488+00
728ef3be-1c81-4754-823e-33f37432fe24	3224fb7f-d313-4761-9d07-ee8b994abd16	f67a6f86-5075-4723-97d0-6caf84e93acb	\N	2	f	2026-02-02 23:35:50.122488+00
11f4d8e6-a07e-4cf1-b30d-f6f135ccb50a	3224fb7f-d313-4761-9d07-ee8b994abd16	c222c074-b145-4599-bff9-8081b0ace36c	\N	3	f	2026-02-02 23:35:50.122488+00
e85e0b57-3d12-4b6a-b726-a7d40ca87577	3224fb7f-d313-4761-9d07-ee8b994abd16	d30ae9d2-69ad-471f-a4a5-fb7ec8e74fad	\N	4	f	2026-02-02 23:35:50.122488+00
1eaa3622-0524-4f4f-85c8-39de9ef79607	3224fb7f-d313-4761-9d07-ee8b994abd16	c77f97a5-0c5b-4bbf-8986-e6a902cce5b8	\N	5	f	2026-02-02 23:35:50.122488+00
3a09b8e3-8e2c-4c96-b018-b48aafaae4ef	878965de-e638-40ce-8c4d-472bbc01f67d	aa1c7f3d-1e39-449d-aac9-984768a2095b	\N	0	f	2026-02-02 23:35:50.122488+00
3aa32e37-a92b-433c-87e3-217f36d51086	8318baf4-2d54-454d-a54f-b91670d76fbd	a6f4c612-2c05-4da7-bf49-fb1ff1312d21	\N	0	f	2026-02-02 23:35:50.122488+00
544ab8c4-48dd-41d1-94e2-1b0f15039c63	8318baf4-2d54-454d-a54f-b91670d76fbd	c77f97a5-0c5b-4bbf-8986-e6a902cce5b8	\N	1	f	2026-02-02 23:35:50.122488+00
d6105d60-777a-4351-b5d4-4f4eadd37cfa	8318baf4-2d54-454d-a54f-b91670d76fbd	f67a6f86-5075-4723-97d0-6caf84e93acb	\N	2	f	2026-02-02 23:35:50.122488+00
15b2b237-4f2e-4aff-9b17-142b1c1583a9	8318baf4-2d54-454d-a54f-b91670d76fbd	c222c074-b145-4599-bff9-8081b0ace36c	\N	3	f	2026-02-02 23:35:50.122488+00
a5e87e21-4b30-495b-a796-67d503bc1914	4b83d797-552a-4d03-ae76-02e6ae2c89c9	a6f4c612-2c05-4da7-bf49-fb1ff1312d21	\N	0	f	2026-02-02 23:35:50.122488+00
2b989b19-d672-4062-83db-b35160da5d7f	838d396d-0411-4173-8c03-ae5e82e8628b	32fb08b5-8eb0-4b90-8ed2-012d5902ca97	\N	0	f	2026-02-02 23:35:50.122488+00
144e50ec-32ff-4703-9395-dffbe7bf156f	ebb37922-65a1-460f-8c3a-cfa046134570	d30ae9d2-69ad-471f-a4a5-fb7ec8e74fad	\N	0	f	2026-02-02 23:35:50.122488+00
4e30a0b8-472b-4947-83ab-9f6c58f64b08	ac3c4092-593d-4458-b4ec-55419778b113	eeb11056-4633-4ad4-b440-7c1a1c401028	\N	0	f	2026-02-02 23:35:57.790032+00
c4d8fcf5-3960-445e-9f51-f7fb83c13f15	1edbb30d-d00a-40f9-98c8-dcb5d7e76a74	eeb11056-4633-4ad4-b440-7c1a1c401028	\N	0	f	2026-02-02 23:35:57.790032+00
8afadd9c-220b-4c06-a9b4-9fbe206a8237	cedb5f11-9c88-4a71-a8d6-dc4668752eef	a7d54a4e-f479-4c38-82a8-3d52a05a2031	\N	0	f	2026-02-02 23:35:57.790032+00
306e149a-13a9-433e-bf08-12148868e640	cedb5f11-9c88-4a71-a8d6-dc4668752eef	45f0f884-122c-4ec9-a227-15e50b22347b	\N	1	f	2026-02-02 23:35:57.790032+00
6549db20-a0ec-4baf-a961-6e856cc8e4c1	cedb5f11-9c88-4a71-a8d6-dc4668752eef	79f29cbd-031f-4c03-8016-991260d961ea	\N	2	f	2026-02-02 23:35:57.790032+00
990b3026-8c5f-4c36-9f25-7a21ae715455	cedb5f11-9c88-4a71-a8d6-dc4668752eef	0ae6c02f-d248-4cf4-b481-17a0e6ea9ff9	\N	3	f	2026-02-02 23:35:57.790032+00
4de3b307-498a-4f46-88c0-de4311d9e153	cedb5f11-9c88-4a71-a8d6-dc4668752eef	8862eaf1-af52-417f-9ee2-5d7c3e30b4d8	\N	4	f	2026-02-02 23:35:57.790032+00
a981634e-6aed-4ff6-b5f6-6c1d6bf99618	cedb5f11-9c88-4a71-a8d6-dc4668752eef	63016b1c-f15f-4ed8-9bec-d4a05d271916	\N	5	f	2026-02-02 23:35:57.790032+00
12aac3f8-5070-4aee-ba6d-c959558cb138	fd2a2e67-1a0d-4eae-bda9-c573f547e81c	45f0f884-122c-4ec9-a227-15e50b22347b	\N	0	f	2026-02-02 23:35:57.790032+00
e641c9ba-73c9-4418-a580-14196917fedb	129f9c61-2cf4-4310-ab11-f9e1ad9259dc	4cd89ebd-8a7a-415b-94e0-d0d66cee6d13	\N	0	f	2026-02-02 23:35:57.790032+00
13b67e8b-fdab-441a-9c4f-e6c217ae8134	129f9c61-2cf4-4310-ab11-f9e1ad9259dc	63016b1c-f15f-4ed8-9bec-d4a05d271916	\N	1	f	2026-02-02 23:35:57.790032+00
e5595cce-7c20-4534-8477-f993cdcab60c	129f9c61-2cf4-4310-ab11-f9e1ad9259dc	79f29cbd-031f-4c03-8016-991260d961ea	\N	2	f	2026-02-02 23:35:57.790032+00
398dce2c-0a2c-4e53-b679-54be2efcb75b	129f9c61-2cf4-4310-ab11-f9e1ad9259dc	0ae6c02f-d248-4cf4-b481-17a0e6ea9ff9	\N	3	f	2026-02-02 23:35:57.790032+00
ef5fea44-8cff-478c-843c-cc55c4870b0a	7d004dd5-5577-4fc4-9efa-56c8bc45165b	4cd89ebd-8a7a-415b-94e0-d0d66cee6d13	\N	0	f	2026-02-02 23:35:57.790032+00
c80a1971-dec3-4aa6-9ccd-4e56e9fe08f5	6098837b-45dd-4e24-abbe-21178f7338d1	eeb11056-4633-4ad4-b440-7c1a1c401028	\N	0	f	2026-02-02 23:35:57.790032+00
00b43c89-dc42-4342-9dc9-82b95263aa95	c5981082-cb60-4efc-a4f5-9d477c3e3bb7	8862eaf1-af52-417f-9ee2-5d7c3e30b4d8	\N	0	f	2026-02-02 23:35:57.790032+00
c3a0b4a2-0749-4ff8-8bcc-74cacf7de5f7	0a62e1a5-01a5-4887-a9ea-b40c03de2faf	07cf14d5-4a53-4209-8fce-3f6eae5105f4	\N	0	f	2026-02-02 23:36:08.017767+00
ab349e18-0af8-4efe-976c-bde87e796458	d7957c49-61dc-4438-a464-7a23e8731db9	07cf14d5-4a53-4209-8fce-3f6eae5105f4	\N	0	f	2026-02-02 23:36:08.017767+00
6a172ac8-162f-420a-935b-096c53f441b7	be38ebc1-fff7-44ed-96d7-554a3d774440	9e4f734d-40d3-44a1-951d-98a2b0612370	\N	0	f	2026-02-02 23:36:08.017767+00
ea9165eb-b646-4c73-b36d-16e290cb3046	be38ebc1-fff7-44ed-96d7-554a3d774440	3789b692-4df3-4dce-8f83-ef565bd1ea8b	\N	1	f	2026-02-02 23:36:08.017767+00
bdd5d752-996f-4015-9efd-74ff1cc2b072	be38ebc1-fff7-44ed-96d7-554a3d774440	8d92f4de-cfc3-4706-8607-89fd534ee39d	\N	2	f	2026-02-02 23:36:08.017767+00
0b74d4e9-bd6d-4764-a9e4-5c3c083feef2	be38ebc1-fff7-44ed-96d7-554a3d774440	6ff1512c-f846-4c4f-8412-8c37a6e3bcdc	\N	3	f	2026-02-02 23:36:08.017767+00
21cac505-3f84-4bff-8718-6d8f31a6ea3d	be38ebc1-fff7-44ed-96d7-554a3d774440	2f93d6b7-1422-49c3-aedb-f0d5c488b5be	\N	4	f	2026-02-02 23:36:08.017767+00
1799f04d-85b7-4d62-8e44-1d22df1b51b0	be38ebc1-fff7-44ed-96d7-554a3d774440	6c6b318a-c292-407f-a030-7732c48b9e7e	\N	5	f	2026-02-02 23:36:08.017767+00
25c926a5-c94c-4e77-9198-13bb1363e2c4	796e7a75-9c66-4332-bea1-11e0bf7cab29	3789b692-4df3-4dce-8f83-ef565bd1ea8b	\N	0	f	2026-02-02 23:36:08.017767+00
97aa2b47-02f7-4b8f-af41-0c01546e68da	e53cb404-2e5b-45ec-ab1b-688e8857e640	03f55f99-310d-468a-818c-955e3cde2318	\N	0	f	2026-02-02 23:36:08.017767+00
7b431f58-cbbb-4609-876b-e8f5e5140bae	e53cb404-2e5b-45ec-ab1b-688e8857e640	6c6b318a-c292-407f-a030-7732c48b9e7e	\N	1	f	2026-02-02 23:36:08.017767+00
7ca5ac3a-9058-4dda-99d7-230f74c97c2c	e53cb404-2e5b-45ec-ab1b-688e8857e640	8d92f4de-cfc3-4706-8607-89fd534ee39d	\N	2	f	2026-02-02 23:36:08.017767+00
92af8fd3-2d3e-4a70-88e9-8d8457d19f9a	e53cb404-2e5b-45ec-ab1b-688e8857e640	6ff1512c-f846-4c4f-8412-8c37a6e3bcdc	\N	3	f	2026-02-02 23:36:08.017767+00
cb287d1a-ec7b-4c36-aa98-048f16682840	2a542e11-2895-44a6-8534-ae1d5511be25	03f55f99-310d-468a-818c-955e3cde2318	\N	0	f	2026-02-02 23:36:08.017767+00
2645e614-df2d-4662-87f8-f3ea16cf58ef	5e0f3a75-aeab-4630-905f-a0368f95e037	07cf14d5-4a53-4209-8fce-3f6eae5105f4	\N	0	f	2026-02-02 23:36:08.017767+00
65651e8e-65be-4bc0-9f28-6e5f102e4a65	41810782-9beb-47c5-85d7-ee196cd8e7b3	2f93d6b7-1422-49c3-aedb-f0d5c488b5be	\N	0	f	2026-02-02 23:36:08.017767+00
d2f411a3-001a-44a1-9460-ef30b62f8783	1bc19d1f-97e3-4897-8cd8-baf0e160ec48	b3c8a483-b598-4f5d-8a74-abffc6312a5a	\N	0	f	2026-02-03 00:01:52.337231+00
12af2450-adf0-4268-abce-b1683c2c5ebb	1bc19d1f-97e3-4897-8cd8-baf0e160ec48	098f2f2b-30d0-4a72-b85c-c2748a7181f5	\N	1	f	2026-02-03 00:01:52.337231+00
17bea1c3-eaaa-4191-9a93-82e7c445bbbe	ae7d64a9-7b6c-435a-91f3-4e0a68813991	f78e79d9-30c8-4bbe-afdc-fe45e5331295	\N	0	f	2026-02-03 00:01:52.337231+00
73f5458a-fc72-48e8-8409-c6d968f8a160	ae7d64a9-7b6c-435a-91f3-4e0a68813991	cd520763-84be-4c79-bdde-0001fae90ec0	\N	1	f	2026-02-03 00:01:52.337231+00
729c5cde-ea82-48fb-adf4-ee83631fc15e	ae7d64a9-7b6c-435a-91f3-4e0a68813991	c4a04f62-cfd6-49eb-ab69-e4feb74e092b	\N	2	f	2026-02-03 00:01:52.337231+00
d44380eb-a718-4af4-8508-a770bfca45a0	ae7d64a9-7b6c-435a-91f3-4e0a68813991	2c3b0d59-9da1-402b-a30e-96d71841da59	\N	3	f	2026-02-03 00:01:52.337231+00
5d50e10d-f044-44f7-81b6-9a8891734de7	a145c1b7-b516-4ccb-9654-7a9d116b115f	30a75b25-9be2-41a3-a91a-4c727ca84cda	\N	0	f	2026-02-03 00:01:52.337231+00
69e931e8-641d-4d31-9358-5a47dcc4bc5b	099db8d2-18a3-4d0c-9b94-7c4b190eaa22	30a75b25-9be2-41a3-a91a-4c727ca84cda	\N	0	f	2026-02-03 00:01:52.337231+00
f0e04e7b-7465-443a-872d-9ec27891ad70	099db8d2-18a3-4d0c-9b94-7c4b190eaa22	098f2f2b-30d0-4a72-b85c-c2748a7181f5	\N	1	f	2026-02-03 00:01:52.337231+00
4165c1cb-0bb8-4f3b-b0bc-87f03a9636ef	50eb73eb-1827-4e98-afa3-0d61640dfa6a	30a75b25-9be2-41a3-a91a-4c727ca84cda	\N	0	f	2026-02-03 00:01:52.337231+00
1505a1e3-6b1f-4a29-9f68-b2e3bb3bb518	50eb73eb-1827-4e98-afa3-0d61640dfa6a	098f2f2b-30d0-4a72-b85c-c2748a7181f5	\N	1	f	2026-02-03 00:01:52.337231+00
6ca0664a-c6bc-47f6-803c-3b885b903b68	6042e226-007f-4044-a4b0-e44d79d00d78	fd6c5ad6-ed3f-414e-9d6f-14d1241b3837	\N	0	f	2026-02-03 00:15:23.834113+00
5bf53fb5-7c40-42e1-b2c2-ae763e8f6d6c	6042e226-007f-4044-a4b0-e44d79d00d78	db6bd52d-642f-4ad2-8723-ff84c2841f00	\N	1	f	2026-02-03 00:15:23.834113+00
572887fc-e803-4e73-9adf-11701cedec20	395ceb63-69bf-4ac6-9cb9-e48d94ffaa87	84702018-d995-45e1-9b30-091e916eb5be	\N	0	f	2026-02-03 00:15:23.834113+00
d36496fa-c883-4bd8-8220-3795920534be	395ceb63-69bf-4ac6-9cb9-e48d94ffaa87	e502a1b9-609e-409f-844a-5e94e4e0f8eb	\N	1	f	2026-02-03 00:15:23.834113+00
95b72e1b-418c-4e6c-86c3-dff30093e547	395ceb63-69bf-4ac6-9cb9-e48d94ffaa87	1c6e9151-c522-40d2-b7a7-d8b22fea23ce	\N	2	f	2026-02-03 00:15:23.834113+00
af18db1c-d884-47b9-bdb7-ce450d7cae9c	395ceb63-69bf-4ac6-9cb9-e48d94ffaa87	d8bf244a-4751-43ce-b9ae-94497d7da1fb	\N	3	f	2026-02-03 00:15:23.834113+00
fd14e10f-e18b-427c-9853-0a2509e77b80	395ceb63-69bf-4ac6-9cb9-e48d94ffaa87	0898026a-85c3-418a-a0fd-4c4ed63bc441	\N	4	f	2026-02-03 00:15:23.834113+00
ac979cd1-a5c8-4b5e-93fe-da5c3e672ee5	aa02f063-7d3a-4fa5-be00-def0bf045452	4f3f8c2d-906d-476c-b7d5-d713a28a2c15	\N	0	f	2026-02-03 00:15:23.834113+00
9d5d6a8c-1c95-4543-8b30-5e176a79c9e6	566e08de-fa57-4c35-b414-7089e98b5ccc	4f3f8c2d-906d-476c-b7d5-d713a28a2c15	\N	0	f	2026-02-03 00:15:23.834113+00
9929581b-2a75-4cef-acc7-a67499c6fbc1	e3d71238-a20b-4895-b9d3-46448b5aaf43	4f3f8c2d-906d-476c-b7d5-d713a28a2c15	\N	0	f	2026-02-03 00:15:23.834113+00
ffedb357-2b7e-4294-8cb1-255ce9ab3b47	3c288804-433e-44c6-895c-6684a72f295f	8a50163d-ab72-4558-a63d-0ce554c10c2d	\N	0	f	2026-02-03 00:17:08.56203+00
9b0cbe64-0c1d-4f9c-b6bb-4da3817c5890	fc7885b0-e512-4a69-815f-9700205df72d	aafdff18-bbe1-41d3-a2fb-f92ed50708ec	\N	0	f	2026-02-03 00:17:08.56203+00
e59a6048-a2dd-4fda-a5dc-895345f69281	fc7885b0-e512-4a69-815f-9700205df72d	88746564-ca06-4fb5-8588-504dd9b98e8f	\N	1	f	2026-02-03 00:17:08.56203+00
eabc9f3e-2f02-4533-bbda-22840d8c3ab0	fc7885b0-e512-4a69-815f-9700205df72d	a186ea0d-32b7-4486-ac77-6e05a44f9b38	\N	2	f	2026-02-03 00:17:08.56203+00
04156551-d40d-4f8f-b480-54b6e4f31828	fc7885b0-e512-4a69-815f-9700205df72d	4a841fa5-7baf-499b-b987-297c14cdeb59	\N	3	f	2026-02-03 00:17:08.56203+00
ed262534-241d-43ad-9ad2-27feffeb39b5	fc7885b0-e512-4a69-815f-9700205df72d	2d9b293e-b602-40cd-8353-790952179712	\N	4	f	2026-02-03 00:17:08.56203+00
f5f04039-6351-4ba0-a11e-466940cde206	82607625-b583-47df-9333-3f148255c059	92251f10-55c5-49b4-ad3a-c3a2e977d956	\N	0	f	2026-02-03 00:17:08.56203+00
33e863cf-df28-41e8-b166-302a4599d7b1	491031f4-36cf-4c49-908d-2d86365be6b6	92251f10-55c5-49b4-ad3a-c3a2e977d956	\N	0	f	2026-02-03 00:17:08.56203+00
e30f32f7-ab7b-4306-a1b8-0e8d7b941375	9efee311-4015-4252-ae09-719ccff683f7	92251f10-55c5-49b4-ad3a-c3a2e977d956	\N	0	f	2026-02-03 00:17:08.56203+00
52ce1328-4e86-48c6-8baf-f0639a74b702	e35abeff-622b-41c6-954a-9d942424a918	33af7ac5-1308-49a0-886d-4bffd3126031	\N	0	f	2026-02-03 00:17:08.56203+00
101cf0d7-2805-42c0-a3d3-812ffc3b789a	9db9f93e-4db2-46e4-8504-969684456748	9de3560c-3c13-4002-a201-23c20e884cb5	\N	0	f	2026-02-03 00:18:40.997001+00
fc420a34-cbdb-4e0b-84d7-6f9e43ab16a2	9db9f93e-4db2-46e4-8504-969684456748	b0b8a8a8-c4ec-4c71-8d79-5f28133a52da	\N	1	f	2026-02-03 00:18:40.997001+00
78527509-68dd-44af-bb28-771a6b59339a	1b39eba8-6928-45ef-8a0a-86501110cf1a	9de3560c-3c13-4002-a201-23c20e884cb5	\N	0	f	2026-02-03 00:18:40.997001+00
2aef693e-57a1-4c2e-8a17-59b306059918	1b39eba8-6928-45ef-8a0a-86501110cf1a	b0b8a8a8-c4ec-4c71-8d79-5f28133a52da	\N	1	f	2026-02-03 00:18:40.997001+00
e47c189f-b1b6-4317-bb6b-ab07bdefcedf	1b39eba8-6928-45ef-8a0a-86501110cf1a	b98b1cf4-5aa5-4150-8ff4-654fa0450c06	\N	2	f	2026-02-03 00:18:40.997001+00
189dbc49-f706-4308-8dde-67c8c31cefa3	09805e8c-e305-4fbe-bbdf-9cba710e9ef0	3c8b2293-c7a6-4a98-9d5c-61a77690134a	\N	0	f	2026-02-03 00:18:40.997001+00
fe490b8d-f861-4da8-a90c-f72a445f5b34	09805e8c-e305-4fbe-bbdf-9cba710e9ef0	dab81446-26ec-47da-a8d3-11dd900735d5	\N	1	f	2026-02-03 00:18:40.997001+00
8262bceb-6386-49aa-9451-b6dbc5168f0b	09805e8c-e305-4fbe-bbdf-9cba710e9ef0	7e27d8af-1115-4adb-a2ba-5332e18c84a9	\N	2	f	2026-02-03 00:18:40.997001+00
1e79180b-34dc-4670-9d19-be65990d2064	09805e8c-e305-4fbe-bbdf-9cba710e9ef0	e99e6e2c-6429-48a4-b36c-62896383fcf1	\N	3	f	2026-02-03 00:18:40.997001+00
f78d0bb9-6831-403b-9b89-09b79aa7d7e3	15623435-0514-4d49-9d2d-7f36267cf515	f2099a2c-ba9a-42d7-90c0-f41f6e1664dd	\N	0	f	2026-02-03 00:18:40.997001+00
ad74b08b-0b7c-4c6b-a0f9-3ba559c71d5c	15623435-0514-4d49-9d2d-7f36267cf515	8f6183b5-3071-4865-9fd3-807d607c6571	\N	1	f	2026-02-03 00:18:40.997001+00
76e2b26b-289a-431e-98d4-0e8fc88560fa	79fa7bf5-d10b-4eb7-a65b-fa496b1a8b17	ba59bee2-e072-4212-af82-f631fa9b6eb3	\N	0	f	2026-02-03 00:18:40.997001+00
264be343-7298-47b5-ade6-e0efa51e22ca	a77fb49b-7c35-492b-9341-8621396d9e6c	7dcc48da-ebac-4c50-8aa6-9d1bb9f1f05c	\N	0	f	2026-02-03 00:26:08.001391+00
f9a8916c-ba5e-4e63-a635-6736ad47c88b	475e0a75-96d2-4bbe-9a66-5e2beac0a6c6	7dcc48da-ebac-4c50-8aa6-9d1bb9f1f05c	\N	0	f	2026-02-03 00:26:08.001391+00
311e84fc-abb7-430e-8e4f-a397bfb992d2	125f15ef-cc7c-4b23-a3cd-660d4b831f32	e6b64fb5-1c12-4df6-bd02-4814aad85011	\N	0	f	2026-02-03 00:26:08.001391+00
d3223e5f-090b-4f72-814f-585377dcd4ee	ee7d3743-6cdb-44fe-a8fa-2f76e696ccee	290e2364-49e7-461a-b068-5b664089f677	\N	0	f	2026-02-03 00:26:08.001391+00
6b852960-b117-4292-8be7-1070f05c0870	ee7d3743-6cdb-44fe-a8fa-2f76e696ccee	67e6fcdb-7508-499e-9ba0-64b26fef9b93	\N	1	f	2026-02-03 00:26:08.001391+00
1173af38-81f4-47c9-a9fd-d3e5ed9f2292	55f017d9-1fe4-499a-816f-98a0129e1aa9	2d4d6b7f-8d90-47a7-887c-8fcb00874bd6	\N	0	f	2026-02-03 00:26:08.001391+00
07cda485-07e3-4800-8adc-db4b855c508b	ef23d573-475f-4258-85c2-c7ab07db899b	b6fc06fd-66d1-4dc6-9ee5-d0899925422f	\N	0	f	2026-02-03 00:28:01.315931+00
2c9a66f6-a17f-4481-ab3e-985e93bf2431	4c7e4f73-464d-49ef-b720-30121cf89e73	b6fc06fd-66d1-4dc6-9ee5-d0899925422f	\N	0	f	2026-02-03 00:28:01.315931+00
d972db96-abbf-4ca6-83e3-d7f6dcf3c6b7	124e64c3-6d4a-4904-8a05-e515612a607b	121e4113-772b-4b78-8da8-ec0dd006f122	\N	0	f	2026-02-03 00:28:01.315931+00
e2047bae-a335-4e3d-a7a5-9f1a1b58994d	f266e4ca-e925-4fa7-9f9d-6da8ef89340f	9e0d028b-0d02-4512-833a-78c50cb7e4bc	\N	0	f	2026-02-03 00:28:01.315931+00
9bceb3aa-5dea-4ea5-95ce-c408eb6300cd	f266e4ca-e925-4fa7-9f9d-6da8ef89340f	ac1aafc9-f50b-43b5-8042-b4946d010337	\N	1	f	2026-02-03 00:28:01.315931+00
15ac48f9-5196-481a-a8ed-2d0dd2a4c842	a3ad5118-7f47-411c-b9ad-a73576e80b9b	c38113c5-f84d-44aa-8e27-460f34ad4731	\N	0	f	2026-02-03 00:28:01.315931+00
f1cb913f-27ff-4bdd-befe-3de05636857a	fadc31be-8e84-4b24-808e-e22da9615dcc	3065113d-510f-4471-af03-a5e4835fe964	\N	0	f	2026-02-03 00:29:17.418733+00
30791e73-7b1d-42ae-ad91-fbe5c142a7b3	1d7440fa-5c84-4969-8611-780d6c67add0	48b2417c-bd22-4bbf-9ac1-4876ac0706fa	\N	0	f	2026-02-03 00:29:17.418733+00
5510a412-4bcf-4172-ba3d-3c7a8e99aeba	1d7440fa-5c84-4969-8611-780d6c67add0	6ef8a0d5-90f6-4fc3-b540-c694e1a92211	\N	1	f	2026-02-03 00:29:17.418733+00
e3d59499-1f06-44cf-a4c3-344e69b4196a	0b116461-a8e2-4106-9d83-25a1ad359174	3065113d-510f-4471-af03-a5e4835fe964	\N	0	f	2026-02-03 00:29:17.418733+00
fc9f011a-1ead-4d2a-bc8d-6efac6c5236d	0b116461-a8e2-4106-9d83-25a1ad359174	82137baa-cb35-4dc9-8ab8-91f58f0d636c	\N	1	f	2026-02-03 00:29:17.418733+00
91a9d940-9967-4e99-bccc-4a8195c91e98	0b116461-a8e2-4106-9d83-25a1ad359174	3de2f387-5d38-492a-8876-9bb9d42789ff	\N	2	f	2026-02-03 00:29:17.418733+00
96f28905-5aaa-4867-bb71-9043c7834ab0	0b116461-a8e2-4106-9d83-25a1ad359174	13305564-9a83-4fe9-a05c-4a98d1685860	\N	3	f	2026-02-03 00:29:17.418733+00
55cdd500-83ed-46db-b69d-9ba217615dce	0b116461-a8e2-4106-9d83-25a1ad359174	fe53be5b-c3cb-4768-9ebb-17f2a51bcea7	\N	4	f	2026-02-03 00:29:17.418733+00
c970e647-c17f-4ad5-b6b6-fa1399d28b54	19b0d201-8ebc-4f41-b3fc-f94db2f08adb	885338a3-d5e9-43e6-864d-48b6317bf391	\N	0	f	2026-02-03 00:29:17.418733+00
936391b9-e394-45a3-b5a4-3bd47488c0e9	e338cbae-1700-4f51-b11e-37d382ad9c6f	3065113d-510f-4471-af03-a5e4835fe964	\N	0	f	2026-02-03 00:29:17.418733+00
be90cc08-19df-4802-99ef-f99b3931a3b0	e338cbae-1700-4f51-b11e-37d382ad9c6f	885338a3-d5e9-43e6-864d-48b6317bf391	\N	1	f	2026-02-03 00:29:17.418733+00
fc002b69-9af1-40bd-8652-df704cd330ce	9e27cdf2-4a66-4edc-99ca-2d7fceb3f664	9308b475-ed0a-412f-88d7-8d236ca79f68	\N	0	f	2026-02-03 00:37:10.294469+00
5b71eb02-310c-4d57-ad10-2d633f889810	cb505477-f53a-4f42-98ce-e31d45f7113c	afe81d0a-b012-4a1d-86a7-581a69edcc60	\N	0	f	2026-02-03 00:37:10.294469+00
f862c9a7-c4f1-4579-9801-2f532276693b	cb505477-f53a-4f42-98ce-e31d45f7113c	3976bf9e-4e99-452c-b69e-40e07812fa68	\N	1	f	2026-02-03 00:37:10.294469+00
b723a634-4060-482a-b932-482c64afaa28	a7809e6f-be35-4efc-a017-f6e7d320321b	9308b475-ed0a-412f-88d7-8d236ca79f68	\N	0	f	2026-02-03 00:37:10.294469+00
d26869cb-e304-484e-af13-2165b14c7761	a7809e6f-be35-4efc-a017-f6e7d320321b	86fa64d4-c38f-4af7-8362-f5e11eb4030d	\N	1	f	2026-02-03 00:37:10.294469+00
90a309fa-61e1-447d-919c-6cda15fd7c11	a7809e6f-be35-4efc-a017-f6e7d320321b	b840d83a-59fb-4ea4-a3eb-e42ba6e308e6	\N	2	f	2026-02-03 00:37:10.294469+00
8f625cbd-8603-42f6-b516-8cc80ef84d90	a7809e6f-be35-4efc-a017-f6e7d320321b	65985b85-d2b8-4ef2-96aa-954e393250df	\N	3	f	2026-02-03 00:37:10.294469+00
fa2c9fe4-246e-40d3-8d94-930a7defa42f	a7809e6f-be35-4efc-a017-f6e7d320321b	9c912577-5c89-4459-ad22-8122f6722a6e	\N	4	f	2026-02-03 00:37:10.294469+00
3973b94b-c8c6-4f08-aef8-0a850ebf790c	b7b67c82-bff6-4241-a1e2-b882d01d86d3	334e73af-ad03-4f56-afe8-71eea61ec05d	\N	0	f	2026-02-03 00:37:10.294469+00
277b61e4-1da3-454c-8995-7c66adface70	54273901-b355-4d67-9218-707e5838f9cc	9308b475-ed0a-412f-88d7-8d236ca79f68	\N	0	f	2026-02-03 00:37:10.294469+00
e8be574f-8ad6-48a0-bd82-bd97ac88cad8	54273901-b355-4d67-9218-707e5838f9cc	334e73af-ad03-4f56-afe8-71eea61ec05d	\N	1	f	2026-02-03 00:37:10.294469+00
cd3e8783-3bbc-470e-9756-8c6f8226da8f	f490878c-b38c-4c37-a4a0-2325673369c9	53624765-4f76-41ad-ac50-924b09c9193b	\N	0	f	2026-02-03 00:39:09.546187+00
b5afe5c1-0caf-4642-b9f6-51d39973a7a2	9aa12c2c-7ca0-43f7-9408-9e6c6dcf2d19	f63e0ea9-856b-44e2-9929-ca50f64d634e	\N	0	f	2026-02-03 00:39:09.546187+00
21467ff9-b92a-4233-82a5-1bd5535bc0f8	9aa12c2c-7ca0-43f7-9408-9e6c6dcf2d19	0fd89477-d184-4484-86a5-9fa665fcc1b7	\N	1	f	2026-02-03 00:39:09.546187+00
dfee6393-340c-432e-978f-1fea3aed40fb	1a387267-f121-42fa-b222-d000dd89a05e	53624765-4f76-41ad-ac50-924b09c9193b	\N	0	f	2026-02-03 00:39:09.546187+00
38ee4616-e906-46e5-8cd9-6ff873daae07	1a387267-f121-42fa-b222-d000dd89a05e	16f839aa-4d6a-4b9d-9955-65e318f03a86	\N	1	f	2026-02-03 00:39:09.546187+00
7ffd94d2-b3f4-4f06-8f74-ad7f4ffedca7	1a387267-f121-42fa-b222-d000dd89a05e	1a4e55a4-f542-459b-8bde-64155588a002	\N	2	f	2026-02-03 00:39:09.546187+00
abca9303-01c8-473c-89bd-c0eaa219410a	1a387267-f121-42fa-b222-d000dd89a05e	1ac7e963-9fe9-4e0f-9df0-83a4f82c5ad7	\N	3	f	2026-02-03 00:39:09.546187+00
a638fa38-c1e4-48d5-9472-cddd3df67291	1a387267-f121-42fa-b222-d000dd89a05e	746987e9-6f88-4a70-a18c-f74406abe65f	\N	4	f	2026-02-03 00:39:09.546187+00
2cdb8393-6df7-4633-a327-24607d000a19	b9644f22-dad1-4bac-b548-511f5f7b2bb1	cb3c0d2e-906f-4e39-9286-c0d4f3a32d7c	\N	0	f	2026-02-03 00:39:09.546187+00
58828feb-7019-4327-b7e1-4b3006c33379	26e0ff36-f7a5-4b5c-a93f-c947982ad207	53624765-4f76-41ad-ac50-924b09c9193b	\N	0	f	2026-02-03 00:39:09.546187+00
33a6b086-cd2a-447c-9782-144c9f6d0b8f	26e0ff36-f7a5-4b5c-a93f-c947982ad207	cb3c0d2e-906f-4e39-9286-c0d4f3a32d7c	\N	1	f	2026-02-03 00:39:09.546187+00
88e8ea97-36f5-41d3-9cf0-16f972694d29	9590b4ae-be0e-4470-b5ce-d98dfc85c407	20c06ecd-5be9-42ea-9387-cceee147c87a	\N	0	f	2026-02-03 00:39:50.953935+00
ab5ff468-26ef-49e3-b103-459e1f4c553f	e90a28f0-2e3e-4d4d-afd1-dab81c20ed19	2a19b60e-d081-466b-9f3b-0c997d5f386e	\N	0	f	2026-02-03 00:39:50.953935+00
aafe3050-f0b6-4131-8121-1539cccd3842	e90a28f0-2e3e-4d4d-afd1-dab81c20ed19	6f6a7b83-084b-4f87-b318-40d06b87adce	\N	1	f	2026-02-03 00:39:50.953935+00
18aea2b7-73d3-4e51-a8d9-ac742945d8de	f8d5891e-7527-4ebf-92f0-c25fc1b75843	20c06ecd-5be9-42ea-9387-cceee147c87a	\N	0	f	2026-02-03 00:39:50.953935+00
32bbf56a-f550-4d32-a932-58c69398c1eb	f8d5891e-7527-4ebf-92f0-c25fc1b75843	b0708d37-98c2-4012-8c66-017ef32188e0	\N	1	f	2026-02-03 00:39:50.953935+00
5fc52e10-69e5-4763-8671-51b79064dcc4	f8d5891e-7527-4ebf-92f0-c25fc1b75843	34fcefdc-4b01-460b-a3b4-ba5fbbf84e9b	\N	2	f	2026-02-03 00:39:50.953935+00
7eda60f0-838c-4ada-9e8b-e10e24f21ffa	f8d5891e-7527-4ebf-92f0-c25fc1b75843	555be799-165c-407b-a028-cfb0989e3d6a	\N	3	f	2026-02-03 00:39:50.953935+00
69f9385f-7f4a-49dd-88d3-2bf8e6a81b5f	f8d5891e-7527-4ebf-92f0-c25fc1b75843	8e774442-1e0b-4b65-b869-e1f7d5e12a8a	\N	4	f	2026-02-03 00:39:50.953935+00
7709e637-ceeb-4598-bea2-ef5f6c0edf3c	2f7171d0-00aa-4c26-a06b-936b350aa491	f66b22c6-5400-4bfd-862f-3b4b1e0fc882	\N	0	f	2026-02-03 00:39:50.953935+00
f589af4e-ab4d-4e73-81e7-eb191fdb92d0	20020979-af70-4295-b378-a718cc967562	20c06ecd-5be9-42ea-9387-cceee147c87a	\N	0	f	2026-02-03 00:39:50.953935+00
2158f593-d030-479c-a904-2702267ec33c	20020979-af70-4295-b378-a718cc967562	f66b22c6-5400-4bfd-862f-3b4b1e0fc882	\N	1	f	2026-02-03 00:39:50.953935+00
8d52d142-74ff-4e26-8a99-0096fc4ec8b7	4b98d2de-a2b3-49eb-8cb8-c4dec4dc8542	457f48df-6953-4cfe-8e9a-c9f3b2420719	\N	0	f	2026-02-03 00:47:50.50374+00
3906a646-9314-4967-8c58-f6bb3bc3d52a	4b98d2de-a2b3-49eb-8cb8-c4dec4dc8542	5cec9b68-7d04-4b58-8d17-b6f21bd356d2	\N	1	f	2026-02-03 00:47:50.50374+00
0ec0cad5-a53a-4aac-8863-9d6a5606d597	b491dbf3-4bf9-4dab-a68b-874ffcd1aa0a	457f48df-6953-4cfe-8e9a-c9f3b2420719	\N	0	f	2026-02-03 00:47:50.50374+00
e15ca5d6-3f64-4d75-820a-e46fa166c2f5	b491dbf3-4bf9-4dab-a68b-874ffcd1aa0a	5cec9b68-7d04-4b58-8d17-b6f21bd356d2	\N	1	f	2026-02-03 00:47:50.50374+00
c46e762d-1e9b-4738-b9dc-826bd32d1ffb	d614e081-d557-4820-b5d8-be92ada9a9ef	489c97bf-6aeb-4175-87c8-825973a923d4	\N	0	f	2026-02-03 00:48:55.700446+00
e8337794-2734-40c0-9d2b-4f4f640fe36e	d614e081-d557-4820-b5d8-be92ada9a9ef	b0ebf304-003c-4854-bb67-46048d9a04e7	\N	1	f	2026-02-03 00:48:55.700446+00
0bb04f8a-297c-4ebb-9e1b-f0827464ab53	90f5e1a8-3ebd-49e6-bda8-2459735e20a2	b34d5f29-7d27-4a2f-978b-7e883f3b66ba	\N	0	f	2026-02-03 00:48:55.700446+00
f887ca59-4685-4462-b0b7-243d0a2be295	792f9944-e48d-4a15-94cc-cbb8df05dfef	00b95d93-83fb-4567-9715-598545172f78	\N	0	f	2026-02-03 00:48:55.700446+00
9b3fe992-cccf-4eba-aa28-42d695ecef63	792f9944-e48d-4a15-94cc-cbb8df05dfef	b34d5f29-7d27-4a2f-978b-7e883f3b66ba	\N	1	f	2026-02-03 00:48:55.700446+00
04956f2c-ea27-414a-af61-9c177a320053	792f9944-e48d-4a15-94cc-cbb8df05dfef	489c97bf-6aeb-4175-87c8-825973a923d4	\N	2	f	2026-02-03 00:48:55.700446+00
e8f3a074-79e6-4309-a8eb-16c7713c2cfd	792f9944-e48d-4a15-94cc-cbb8df05dfef	b0ebf304-003c-4854-bb67-46048d9a04e7	\N	3	f	2026-02-03 00:48:55.700446+00
743a3570-659c-4ad8-957f-a7c6f687f856	2e258b6c-375b-4751-b5f4-470ae9a343e1	c8cdf006-7e13-452e-8125-da3b282823a3	\N	0	f	2026-02-03 00:48:55.700446+00
295ee646-2210-4001-bbae-fa170f87b06d	2e258b6c-375b-4751-b5f4-470ae9a343e1	4703f920-80f1-409f-ad34-ffc158906e4d	\N	1	f	2026-02-03 00:48:55.700446+00
9f339c55-9ed6-451c-ba3e-bc765d115f55	2e258b6c-375b-4751-b5f4-470ae9a343e1	e75e42be-74bd-4c5e-b9ad-9526493560fd	\N	2	f	2026-02-03 00:48:55.700446+00
15116800-4bcd-452c-b7a2-5acafb05e698	78ad37b5-5542-4a79-8f11-55edbadab97f	c8cdf006-7e13-452e-8125-da3b282823a3	\N	0	f	2026-02-03 00:48:55.700446+00
fceb61d2-0588-46ab-8c3e-e09ece01926c	78ad37b5-5542-4a79-8f11-55edbadab97f	489c97bf-6aeb-4175-87c8-825973a923d4	\N	1	f	2026-02-03 00:48:55.700446+00
bb2b30ac-7b07-4b45-a1b3-1edf86772fb5	78ad37b5-5542-4a79-8f11-55edbadab97f	b0ebf304-003c-4854-bb67-46048d9a04e7	\N	2	f	2026-02-03 00:48:55.700446+00
14ceb7f8-4421-470e-a910-01c616135ef7	3bebf426-055d-41ba-b3aa-27dfcb88a6e4	eb07802c-3dae-4c4a-bcf4-de09a17a0506	\N	0	f	2026-02-03 00:48:55.700446+00
422274f5-b255-4d7f-ac19-43a146ff5550	d980285d-b131-45e5-a440-7bddb406ac7c	e2eaeb3a-ea6c-4078-aee9-12be8b5ec19b	\N	0	f	2026-02-03 00:57:19.244113+00
86a603fd-a5bf-495e-b1e4-7c2df8bc1ffd	d980285d-b131-45e5-a440-7bddb406ac7c	4dccc8aa-a398-4223-9dc4-a42e19dcee7d	\N	1	f	2026-02-03 00:57:19.244113+00
28cb83d0-992d-4b4e-a342-16775a9162ed	e042bdf9-cfba-48d9-b8a0-a2d73516acbf	e2eaeb3a-ea6c-4078-aee9-12be8b5ec19b	\N	0	f	2026-02-03 00:57:19.244113+00
659ef8f2-8424-4814-9420-fbd922539fc3	e042bdf9-cfba-48d9-b8a0-a2d73516acbf	4dccc8aa-a398-4223-9dc4-a42e19dcee7d	\N	1	f	2026-02-03 00:57:19.244113+00
3e73aa30-832b-499a-b9b1-99e806366ef7	e042bdf9-cfba-48d9-b8a0-a2d73516acbf	8fa7d638-f304-4c4f-a2f0-6548f004e571	\N	2	f	2026-02-03 00:57:19.244113+00
cfccde59-3b39-4c15-8396-5f5051eac688	df8f6998-daeb-4118-9784-7ebb89d5ec56	0c9281ee-92de-4922-a3b4-24c7407293eb	\N	0	f	2026-02-03 00:57:19.244113+00
68d60d56-2c39-453f-834a-8c8c2ff5437e	df8f6998-daeb-4118-9784-7ebb89d5ec56	c26599ba-c8af-49af-a530-62aec7fb0a5b	\N	1	f	2026-02-03 00:57:19.244113+00
5cdf6770-3225-4720-b1ad-7c8375330bd4	df8f6998-daeb-4118-9784-7ebb89d5ec56	47839bab-e058-4c05-9b00-6e475165241b	\N	2	f	2026-02-03 00:57:19.244113+00
76f3e2c3-3cc3-4b0c-8b45-fcf955b71f0e	6ae12560-a222-4263-bdfb-2674244ba411	2bb64d40-4603-47d8-839f-c58b3f00f46d	\N	0	f	2026-02-03 00:57:19.244113+00
08d45f37-996b-49b3-8b5a-b2347fc1ff3d	6ae12560-a222-4263-bdfb-2674244ba411	c34ff058-794e-451e-8c6e-a2412bf2b693	\N	1	f	2026-02-03 00:57:19.244113+00
92e3f194-8f57-4d73-9aea-f184e33e379f	6ae12560-a222-4263-bdfb-2674244ba411	c26599ba-c8af-49af-a530-62aec7fb0a5b	\N	2	f	2026-02-03 00:57:19.244113+00
009e9cef-f2b5-4ceb-bf9b-52e9e775a2ac	6ae12560-a222-4263-bdfb-2674244ba411	47839bab-e058-4c05-9b00-6e475165241b	\N	3	f	2026-02-03 00:57:19.244113+00
edb077cb-e4e2-4879-a133-8894aee4cf9b	994648f9-7054-4b8c-ad1e-6ef66f27e586	2bb64d40-4603-47d8-839f-c58b3f00f46d	\N	0	f	2026-02-03 00:57:19.244113+00
71bdd038-6af5-45d3-b2d1-dac508cdfa61	994648f9-7054-4b8c-ad1e-6ef66f27e586	39e6f4ee-5a6e-4f4e-87e2-f5b25c05e083	\N	1	f	2026-02-03 00:57:19.244113+00
8f06c196-eb34-4507-8c32-7bf9da366384	0ff448f4-05b4-4ba0-8061-6c7de4bba14c	0c9281ee-92de-4922-a3b4-24c7407293eb	\N	0	f	2026-02-03 00:57:19.244113+00
f811f89c-a860-4075-b417-5af71f4c9be2	0ff448f4-05b4-4ba0-8061-6c7de4bba14c	2bb64d40-4603-47d8-839f-c58b3f00f46d	\N	1	f	2026-02-03 00:57:19.244113+00
8f144dac-b5ac-4742-96c1-5e2c7ed78ed7	0ff448f4-05b4-4ba0-8061-6c7de4bba14c	39e6f4ee-5a6e-4f4e-87e2-f5b25c05e083	\N	2	f	2026-02-03 00:57:19.244113+00
fc2a50d3-39ca-40d9-9fc5-3b09f7cf3ad4	00344a02-79fe-44fc-a261-f61d5a1e297f	ee34250b-72a1-4636-8a90-939cbae934ab	\N	0	f	2026-02-03 03:10:03.586227+00
a86fffef-6d15-43dc-a9da-07035a5dabad	00344a02-79fe-44fc-a261-f61d5a1e297f	650c8445-b087-44c8-981c-a74be4ffde2a	\N	1	f	2026-02-03 03:10:03.586227+00
44350c10-a877-49a0-bd39-a3409624f1af	516e0c8a-cbf6-4a2e-9fba-836ba84748ae	ee34250b-72a1-4636-8a90-939cbae934ab	\N	0	f	2026-02-03 03:10:03.586227+00
fab5a15f-38f6-401f-aa0d-6a34c9e7187a	516e0c8a-cbf6-4a2e-9fba-836ba84748ae	650c8445-b087-44c8-981c-a74be4ffde2a	\N	1	f	2026-02-03 03:10:03.586227+00
cc7d43f8-3196-41ef-8794-5d7b276dd5db	516e0c8a-cbf6-4a2e-9fba-836ba84748ae	3e808a73-6305-4588-9caf-c17fedc4ea4c	\N	2	f	2026-02-03 03:10:03.586227+00
6f9eb3f1-881a-43bd-9c6d-5c8c9a97c728	a15e72be-a1a0-4ddf-ac00-b82ee43f36db	ad491aa6-20d3-4ce5-93eb-7aaef6b7bc59	\N	0	f	2026-02-03 03:10:03.586227+00
b9bbbdf7-7fd7-40ad-9e6b-6b34742feaa1	a15e72be-a1a0-4ddf-ac00-b82ee43f36db	40535cc8-89d5-4300-9ea2-a4263173a13b	\N	1	f	2026-02-03 03:10:03.586227+00
ef10d195-65b5-42ee-bcea-be708bb5a3ca	a15e72be-a1a0-4ddf-ac00-b82ee43f36db	3ede67f6-3895-4fcb-bede-4914cd45df5c	\N	2	f	2026-02-03 03:10:03.586227+00
76bc07ee-8e45-407f-9c2e-ab00b35d5218	8e549ffa-1a85-48af-aef4-87c685abe9ba	6f1357ad-c11d-4434-afbb-ea937225efdb	\N	0	f	2026-02-03 03:10:03.586227+00
b0226d21-5d87-47f4-9068-df6f39966015	8e549ffa-1a85-48af-aef4-87c685abe9ba	191d7bd1-b30d-4fca-b5a6-15abec14c531	\N	1	f	2026-02-03 03:10:03.586227+00
ae9b8089-df6f-41f2-a9aa-38157b4b9964	8e549ffa-1a85-48af-aef4-87c685abe9ba	40535cc8-89d5-4300-9ea2-a4263173a13b	\N	2	f	2026-02-03 03:10:03.586227+00
265bb00e-73ee-4adc-b9d8-28477c54c73b	8e549ffa-1a85-48af-aef4-87c685abe9ba	3ede67f6-3895-4fcb-bede-4914cd45df5c	\N	3	f	2026-02-03 03:10:03.586227+00
e44d3b2f-d283-4998-9a2a-0e2bf3bb9223	eab195f6-d511-4ebf-a9a4-1cee45ed8e2a	6f1357ad-c11d-4434-afbb-ea937225efdb	\N	0	f	2026-02-03 03:10:03.586227+00
ffbcf94e-bb2a-43f7-80db-96393e8a5ced	eab195f6-d511-4ebf-a9a4-1cee45ed8e2a	6de7b096-c133-4ce8-9600-15685528cdff	\N	1	f	2026-02-03 03:10:03.586227+00
e75371cf-9a3b-489f-a68b-c3d8a86188c6	e33ac6d6-1b9c-4ef8-b302-77dd86ea8f07	ad491aa6-20d3-4ce5-93eb-7aaef6b7bc59	\N	0	f	2026-02-03 03:10:03.586227+00
a2986121-f7a4-44dc-9841-01682643bfb0	e33ac6d6-1b9c-4ef8-b302-77dd86ea8f07	6f1357ad-c11d-4434-afbb-ea937225efdb	\N	1	f	2026-02-03 03:10:03.586227+00
a32cf46f-8bad-4c9f-bd0e-8906d23da90a	e33ac6d6-1b9c-4ef8-b302-77dd86ea8f07	6de7b096-c133-4ce8-9600-15685528cdff	\N	2	f	2026-02-03 03:10:03.586227+00
e8b09b2c-71bd-4f12-b41e-0f7cc1be7896	286066e9-386d-4862-a4d8-858da8f28e8f	bf2f2297-00e5-499e-a95d-37c4486d7bdf	\N	0	f	2026-02-03 03:15:26.242881+00
0d01e220-19eb-4094-ad1b-37884d9962fb	286066e9-386d-4862-a4d8-858da8f28e8f	4486fcce-f899-4812-a7aa-3563386a9b90	\N	1	f	2026-02-03 03:15:26.242881+00
399e1bd3-3508-4051-a6d8-1daf5086145a	34e1f22f-7cb4-46e8-b37c-c4d36bbc54e4	1da3f488-9a85-4c4c-afdb-39e3c46a0dc3	\N	0	f	2026-02-03 03:15:26.242881+00
3aab495c-9e65-4d96-8271-c3a77b37e90a	34e1f22f-7cb4-46e8-b37c-c4d36bbc54e4	9c0beea1-4637-4455-9264-726639576a1e	\N	1	f	2026-02-03 03:15:26.242881+00
cc8bdffc-89cb-45be-8ac8-3a3f2f253bef	34e1f22f-7cb4-46e8-b37c-c4d36bbc54e4	5595ad71-4d24-4b94-a93e-6f867bbe3c5d	\N	2	f	2026-02-03 03:15:26.242881+00
f57bae24-bd18-4958-806c-9388391720a5	34e1f22f-7cb4-46e8-b37c-c4d36bbc54e4	dee46032-59c0-45f4-9a9e-eac1b4eaaa61	\N	3	f	2026-02-03 03:15:26.242881+00
20b6b413-e921-403b-b5f1-918658123304	32efd5ce-e852-4fcc-bada-2b9405fff3e5	c51296da-814f-4caa-9d08-c5cbe1b4514d	\N	0	f	2026-02-03 03:15:26.242881+00
a5587aa7-2e7e-4f76-affd-c1dc4f66f026	718c900a-0527-4139-b5fb-75e8699e17ca	c51296da-814f-4caa-9d08-c5cbe1b4514d	\N	0	f	2026-02-03 03:15:26.242881+00
19666627-bd54-4f4c-8df8-238ace2c7832	718c900a-0527-4139-b5fb-75e8699e17ca	4486fcce-f899-4812-a7aa-3563386a9b90	\N	1	f	2026-02-03 03:15:26.242881+00
3dcf8305-8821-4504-a1eb-7920f9362fb7	0041caaf-e58f-4e51-95d1-5574cf8ca15e	5856989a-8307-405e-a2fe-e0b44f4eefae	\N	0	f	2026-02-03 03:15:26.242881+00
90032602-8d34-46ea-a839-85a2106f440e	872cdd6c-ff24-42bd-b816-f7bea22c49b2	ba0b69d0-61e2-4525-b86e-76d32a641908	\N	0	f	2026-02-03 03:15:26.242881+00
e9aceb16-530f-42b7-9cdc-608d5b98210e	ac7e4b17-96e3-4f73-ac6b-0a207fcc5557	473b9e97-ae5b-4a11-b42f-c476eef77bb4	\N	0	f	2026-02-03 22:20:14.420813+00
9251e0a0-9b90-4d79-be8a-b360a73b2b65	c331c7e8-62df-41c7-96d2-2f0ed9470167	871a0bcf-4ada-4f68-ae14-685dccd46c04	\N	0	f	2026-02-03 22:20:14.420813+00
b247f3c5-df64-47a4-bb99-b24b3f18703f	c331c7e8-62df-41c7-96d2-2f0ed9470167	5cd8cd77-753c-4b4a-84d4-b4825e67f7ee	\N	1	f	2026-02-03 22:20:14.420813+00
49d935a7-85b5-4b38-b9be-c9a138501838	c331c7e8-62df-41c7-96d2-2f0ed9470167	0b9f2846-99db-49c5-8242-5fdd559fbd97	\N	2	f	2026-02-03 22:20:14.420813+00
3c061103-19ed-42c4-9872-5a39f05b3d61	c331c7e8-62df-41c7-96d2-2f0ed9470167	b2c8d6ab-c4f8-44bf-a33c-3bf0e0c8cd01	\N	3	f	2026-02-03 22:20:14.420813+00
2ea9aa8e-4c34-4f2d-9b2f-f19671e5d116	c331c7e8-62df-41c7-96d2-2f0ed9470167	0c0c6bf2-5bfb-4838-8382-d3d2f6445062	\N	4	f	2026-02-03 22:20:14.420813+00
09e97649-1a43-4914-beb5-077473f1f04d	9f80148d-1c56-4c1d-a0a4-8b78864048ad	f0e8b7ac-bbef-4c4b-bb8c-8f2e5bc17875	\N	0	f	2026-02-03 22:20:14.420813+00
2237cf29-08e3-477b-8c73-47907c21cc7d	9f42efed-1ffc-45aa-89ed-102206d07daa	4377e1c6-4a3c-4fba-9a14-723d7dd62c30	\N	0	f	2026-02-03 22:20:14.420813+00
d167c664-4508-4e6a-ad6e-4eb2ba33c756	4d282934-af13-46fc-99bd-c04a8c545220	f0e8b7ac-bbef-4c4b-bb8c-8f2e5bc17875	\N	0	f	2026-02-03 22:20:14.420813+00
618f020a-7fe7-442e-94c3-98b18b2ab833	4d282934-af13-46fc-99bd-c04a8c545220	4377e1c6-4a3c-4fba-9a14-723d7dd62c30	\N	1	f	2026-02-03 22:20:14.420813+00
9b0dc1b8-4fda-4be9-b1a7-655d4888b66d	437186b9-a22d-4ab3-8e9a-8b9e1db08aee	8e1aab9d-7e83-4c0b-885a-b74af74c14b1	\N	0	f	2026-02-03 22:23:34.812847+00
ecad9fa7-fd03-4c6d-a49c-529ccc243432	8a20981d-8b65-44af-8283-e44a90297fc7	96140959-aeed-4017-a050-9734800af607	\N	0	f	2026-02-03 22:23:34.812847+00
d5418153-1863-4531-9063-9fa2494ac665	8a20981d-8b65-44af-8283-e44a90297fc7	7f99221b-6575-469d-a429-7f082d50a67a	\N	1	f	2026-02-03 22:23:34.812847+00
a48ad52d-c673-40cf-beaa-953e0c224536	8a20981d-8b65-44af-8283-e44a90297fc7	e61a06c0-b916-4961-a907-2827e584a9ea	\N	2	f	2026-02-03 22:23:34.812847+00
5b8a29ce-8ef1-41d9-8d95-c16444bd184a	8a20981d-8b65-44af-8283-e44a90297fc7	30af7a88-ae2e-4eb5-bcf2-4deee7e6601e	\N	3	f	2026-02-03 22:23:34.812847+00
b62700d8-c63b-4d34-9172-413f552018eb	8a20981d-8b65-44af-8283-e44a90297fc7	1f37bda3-634d-44e8-9609-123c5e707ea2	\N	4	f	2026-02-03 22:23:34.812847+00
654504a1-5064-4cf1-9294-0d2bf2c18a0a	df959f73-5ce3-41bb-b81a-8ce461d70c51	43662660-2232-4bfd-9519-9e9fd933fea0	\N	0	f	2026-02-03 22:23:34.812847+00
128b1e27-83e8-4ae2-840e-32f4872e8f6a	0edcb8d8-8b33-42f8-a8aa-e0b504da3b1f	b0e20d5d-38fb-4ffc-a1f6-456c21efbffe	\N	0	f	2026-02-03 22:23:34.812847+00
2ca0e3e1-cc56-4234-87b2-17cdc4a70c71	955685e0-6780-44f1-803b-90b35aa7ddd8	43662660-2232-4bfd-9519-9e9fd933fea0	\N	0	f	2026-02-03 22:23:34.812847+00
8385255d-57b0-4087-b3ed-2a534fa9e290	955685e0-6780-44f1-803b-90b35aa7ddd8	b0e20d5d-38fb-4ffc-a1f6-456c21efbffe	\N	1	f	2026-02-03 22:23:34.812847+00
d5b149fa-bb54-4e90-ae85-5b3addb555d8	89cf677f-c92e-4e6f-a448-26f075bd55c5	0e8bc33e-6bd9-450c-a7d4-ba5ace8e5d4c	\N	0	f	2026-02-03 22:32:12.499642+00
6b4a41fb-9c40-4f27-bd91-ff46ba38af5a	89cf677f-c92e-4e6f-a448-26f075bd55c5	ec5b0a62-1d73-4974-af5d-94571b3ac645	\N	1	f	2026-02-03 22:32:12.499642+00
d1446358-1dc7-46ee-a430-dba60f4eeb52	89cf677f-c92e-4e6f-a448-26f075bd55c5	2b459f19-7051-4784-97ea-cd80364b6b7c	\N	2	f	2026-02-03 22:32:12.499642+00
d49f043d-7246-4538-996f-a49b53cb63e1	89cf677f-c92e-4e6f-a448-26f075bd55c5	b602fbf9-f783-4321-a2f9-92c9acf45943	\N	3	f	2026-02-03 22:32:12.499642+00
19b14e34-f748-4dda-8d3f-6dd685729243	89cf677f-c92e-4e6f-a448-26f075bd55c5	8faf4001-0542-4ffb-b099-4b857142c571	\N	4	f	2026-02-03 22:32:12.499642+00
e185ebb0-e7b7-48e6-8a01-3eb5b3525404	89cf677f-c92e-4e6f-a448-26f075bd55c5	06911d80-2fdf-4944-befc-5659d8de9f42	\N	5	f	2026-02-03 22:32:12.499642+00
5063466f-dae3-4aad-8378-f74892e5ef09	89cf677f-c92e-4e6f-a448-26f075bd55c5	c7757b67-e08e-4f60-9359-09670c174703	\N	6	f	2026-02-03 22:32:12.499642+00
2fbb152b-46d2-42a2-af74-54772b571255	efd4b6e6-5e27-49a7-b7b1-274789dff708	9a482096-b5b5-43c7-bb9a-fb2e277ea2c4	\N	0	f	2026-02-03 22:32:12.499642+00
d8be845c-886f-4da7-b6e7-a436a10e045f	aed0ddf1-30e5-4115-a448-9e576d43fd6f	ec5b0a62-1d73-4974-af5d-94571b3ac645	\N	0	f	2026-02-03 22:32:12.499642+00
3079db31-4434-4059-8eb2-8ce5cb0323c2	aed0ddf1-30e5-4115-a448-9e576d43fd6f	9a482096-b5b5-43c7-bb9a-fb2e277ea2c4	\N	1	f	2026-02-03 22:32:12.499642+00
571ab428-a94c-492c-8d30-f8450f71c72e	f3a99f13-3861-42f2-a0bd-98177428bd34	ec5b0a62-1d73-4974-af5d-94571b3ac645	\N	0	f	2026-02-03 22:32:12.499642+00
fc2d0764-1058-4417-893c-946f59396ab1	f3a99f13-3861-42f2-a0bd-98177428bd34	9a482096-b5b5-43c7-bb9a-fb2e277ea2c4	\N	1	f	2026-02-03 22:32:12.499642+00
64489daa-c28e-4b66-ac23-14326c36a528	fe8c5740-9638-49e2-ac0c-dfd4659c873d	c3b3904f-f5ad-4ea5-92a4-1a2aa4ad944d	\N	0	f	2026-02-03 22:32:51.22842+00
526b0213-e9a4-450f-b052-bf2d15820ef9	7617a176-1cf4-4f6a-81e3-4fa8861fccad	fa07ae63-e188-4fd1-9375-3f842bdeef86	\N	0	f	2026-02-03 22:32:51.22842+00
ae7a7360-0578-4c77-a26f-b2701a1e7d31	e05bdd2f-c310-45f4-a389-9d9a0fcaaa4e	99ecbc33-2dbe-4c4f-b35b-588b745a06ad	\N	0	f	2026-02-03 22:32:51.22842+00
008c1a7d-5abf-46ed-a17a-da3bf8ba9a08	e05bdd2f-c310-45f4-a389-9d9a0fcaaa4e	2dcff86c-20f8-4b4d-b93d-03af6390eaa8	\N	1	f	2026-02-03 22:32:51.22842+00
10b67eca-f26e-4310-ab17-0699a8ffbd46	e05bdd2f-c310-45f4-a389-9d9a0fcaaa4e	63dc181c-ff2e-4441-b919-c566ce47acc8	\N	2	f	2026-02-03 22:32:51.22842+00
988d678d-bb68-4736-b4c0-6c801528882b	e05bdd2f-c310-45f4-a389-9d9a0fcaaa4e	941a3ebc-a16d-465b-988f-cba83f27d4f2	\N	3	f	2026-02-03 22:32:51.22842+00
2396fb92-327e-4c16-a983-c7c9119bbca9	e05bdd2f-c310-45f4-a389-9d9a0fcaaa4e	7008e324-9f5a-4431-bca1-b4987eb6a46a	\N	4	f	2026-02-03 22:32:51.22842+00
d4ef13e0-913f-4a5b-a7c9-f155a1d8191c	e05bdd2f-c310-45f4-a389-9d9a0fcaaa4e	fa07ae63-e188-4fd1-9375-3f842bdeef86	\N	5	f	2026-02-03 22:32:51.22842+00
42cbce81-0446-4897-a331-f8af6f79b71e	eb36f365-ead8-417d-a8ef-59d36904e9d9	c3b3904f-f5ad-4ea5-92a4-1a2aa4ad944d	\N	0	f	2026-02-03 22:32:51.22842+00
745cbd93-350a-4c7b-855b-6c9ce535833e	1b86c628-3cef-4c69-8791-43aa6a031ce9	1f0945af-937d-4191-9db5-9978049136ce	\N	0	f	2026-02-03 22:32:51.22842+00
4b387aae-338e-42e7-98d4-eb85f9b40fbf	09adc653-8904-4480-aa87-8403f85b5178	c3b3904f-f5ad-4ea5-92a4-1a2aa4ad944d	\N	0	f	2026-02-03 22:32:51.22842+00
e1a45874-1a5f-4f7d-8df0-0dc003198ac4	09adc653-8904-4480-aa87-8403f85b5178	1f0945af-937d-4191-9db5-9978049136ce	\N	1	f	2026-02-03 22:32:51.22842+00
3924abf0-5c52-403d-894d-82f501abcdbb	e7f57481-fcf8-4170-aa18-997dbd088298	c3b3904f-f5ad-4ea5-92a4-1a2aa4ad944d	\N	0	f	2026-02-03 22:32:51.22842+00
cfea29d0-b78a-477c-9fdb-88a684a0872f	e7f57481-fcf8-4170-aa18-997dbd088298	1f0945af-937d-4191-9db5-9978049136ce	\N	1	f	2026-02-03 22:32:51.22842+00
b1af8cca-20d5-49cf-9e34-f51f2d516578	658b2367-89e7-4d86-8785-123f532a7d0b	08ecfbe5-8168-4fc5-84e4-24563c166420	\N	0	f	2026-02-03 22:40:02.573136+00
ebe80871-4aa0-4d43-9b0e-15e939c3545a	72ff78fe-ae48-4c5e-941b-d786a9186e62	68647910-0a6e-4e83-87a0-a594a49314a7	\N	0	f	2026-02-03 22:40:02.573136+00
c5de03e4-c35e-4a91-be2a-872003a628b2	08acd081-f025-4dd1-9366-eb9062dd29ae	f0e475d7-9c4e-40b6-9f61-3d7ef09b3fe5	\N	0	f	2026-02-03 22:40:02.573136+00
3f4e893c-af9a-4bf2-81dc-a806f794390e	08acd081-f025-4dd1-9366-eb9062dd29ae	23217c91-7bad-4349-991b-9b47d08e71f2	\N	1	f	2026-02-03 22:40:02.573136+00
029646e4-33c9-4ce8-a039-e4873a97a259	08acd081-f025-4dd1-9366-eb9062dd29ae	8b20de1d-9404-43a8-ae1b-6be78bb8ac20	\N	2	f	2026-02-03 22:40:02.573136+00
550bc33e-1a65-407a-a313-a931f573fdf4	08acd081-f025-4dd1-9366-eb9062dd29ae	b320f900-ccc4-4edd-ad1c-3ff2a575a501	\N	3	f	2026-02-03 22:40:02.573136+00
20e1eff1-f33c-48e0-8ef4-5a3b41f45d3b	08acd081-f025-4dd1-9366-eb9062dd29ae	bca4c42b-c60d-4fcd-834d-fc6a78c830d8	\N	4	f	2026-02-03 22:40:02.573136+00
25b351ff-3c28-4b3a-94bb-dc94b4044ce8	08acd081-f025-4dd1-9366-eb9062dd29ae	68647910-0a6e-4e83-87a0-a594a49314a7	\N	5	f	2026-02-03 22:40:02.573136+00
2d0c3220-eb28-4c45-b823-070ac23a3e55	22197186-5461-4e50-a7ec-f539077d49e0	08ecfbe5-8168-4fc5-84e4-24563c166420	\N	0	f	2026-02-03 22:40:02.573136+00
c00a9d8c-d0fc-4697-bd12-2a86d4560828	503b0351-f13f-443e-ba76-7d61547b6192	05785b40-b9c2-471a-9f8d-a32882833e5e	\N	0	f	2026-02-03 22:40:02.573136+00
45b4db1f-f045-459d-9700-a739e4da2138	7129c424-aecd-4a4b-8a59-776cdd10f461	08ecfbe5-8168-4fc5-84e4-24563c166420	\N	0	f	2026-02-03 22:40:02.573136+00
edd6b9ed-c626-468c-8a2f-95d24fff817c	7129c424-aecd-4a4b-8a59-776cdd10f461	05785b40-b9c2-471a-9f8d-a32882833e5e	\N	1	f	2026-02-03 22:40:02.573136+00
a5f2e679-de5b-4dfc-980d-adfd16d74b86	2e42bd7c-3494-43c2-8a4a-964571c78118	08ecfbe5-8168-4fc5-84e4-24563c166420	\N	0	f	2026-02-03 22:40:02.573136+00
17758ce1-5eaf-4f6b-8abe-cc3d5ebe8ca6	2e42bd7c-3494-43c2-8a4a-964571c78118	05785b40-b9c2-471a-9f8d-a32882833e5e	\N	1	f	2026-02-03 22:40:02.573136+00
3acdf7f5-edcf-4513-b8d1-bba6fa75cf7d	1e8a6cfd-fa8f-4fb7-bc30-6bb4775063a6	236b516b-6499-49a4-bcd3-f84e43040a44	\N	0	f	2026-02-03 22:41:56.441827+00
3a54af1d-e387-4a1b-81d9-4a79f4168d14	1e8a6cfd-fa8f-4fb7-bc30-6bb4775063a6	a9589f4a-29ff-4a86-91ae-a22b6c603427	\N	1	f	2026-02-03 22:41:56.441827+00
311d5bb5-995a-4bb3-860d-1f92eb045564	96e11b8c-3d0b-4d1e-940e-a10780ecc9a4	bd64fa98-14b6-42c7-b1c3-d45553fa691c	\N	0	f	2026-02-03 22:41:56.441827+00
f099bdf9-a74b-42f4-acd7-8f3d880feec0	96e11b8c-3d0b-4d1e-940e-a10780ecc9a4	15200cfb-ab87-4054-903b-8c14746b5457	\N	1	f	2026-02-03 22:41:56.441827+00
d992fd76-d5ee-4163-88af-097e8139b107	96e11b8c-3d0b-4d1e-940e-a10780ecc9a4	5bde3ac8-6158-405b-ba24-94215143f456	\N	2	f	2026-02-03 22:41:56.441827+00
771aa244-33bc-4011-aeef-707c436147b2	96e11b8c-3d0b-4d1e-940e-a10780ecc9a4	5219cc34-d1d2-4b7b-846c-daa129e3d6d1	\N	3	f	2026-02-03 22:41:56.441827+00
c336ce51-db3d-44b4-8c80-5d659638c310	96e11b8c-3d0b-4d1e-940e-a10780ecc9a4	14408125-bad3-4d5e-b521-6c3f512d6ec3	\N	4	f	2026-02-03 22:41:56.441827+00
6e7b104c-cdbe-453c-b6b7-3bef69c9a579	0a3f00c4-def7-460b-834e-b6dcf42f1713	236b516b-6499-49a4-bcd3-f84e43040a44	\N	0	f	2026-02-03 22:41:56.441827+00
a41428fe-a8e7-4eb6-911e-06132f08ab72	0a3f00c4-def7-460b-834e-b6dcf42f1713	a9589f4a-29ff-4a86-91ae-a22b6c603427	\N	1	f	2026-02-03 22:41:56.441827+00
4c8e2a19-7dc4-4747-9a4d-e9ea6fe0e350	19539c91-6151-4def-b831-b5745f86f661	ec344755-5490-436c-b57e-d8d2c4dcc5ee	\N	0	f	2026-02-03 22:41:56.441827+00
68e17924-2970-4944-919e-c7aed1579916	d2afcdf6-c4fd-4fba-b4eb-3ada2e9ab479	ec344755-5490-436c-b57e-d8d2c4dcc5ee	\N	0	f	2026-02-03 22:41:56.441827+00
50c3b021-6b4f-415d-b039-623011dd177c	d2afcdf6-c4fd-4fba-b4eb-3ada2e9ab479	a9589f4a-29ff-4a86-91ae-a22b6c603427	\N	1	f	2026-02-03 22:41:56.441827+00
b2e3f258-f68a-46f8-a022-1c726e204681	3609de51-afdf-47ea-82d7-2e941bd30a66	ec344755-5490-436c-b57e-d8d2c4dcc5ee	\N	0	f	2026-02-03 22:41:56.441827+00
63d73708-d9b8-4d97-a736-dd32be60afbb	7182cd45-d53b-445c-8ad0-1f305af3c99c	d10dad96-8976-4104-a923-18faa97daaeb	\N	0	f	2026-02-03 22:43:55.152502+00
b8807045-b391-4c46-b005-f565a297676e	7875384c-723f-4bcc-959c-f26c44ed4761	d10dad96-8976-4104-a923-18faa97daaeb	\N	0	f	2026-02-03 22:43:55.152502+00
0e5f336e-b260-40f3-ad90-baf4adca2b05	66f67e8e-0e27-4df2-a486-35b61d34d834	8d8044bc-ce37-4812-96c8-ca0c5b84757f	\N	0	f	2026-02-03 22:43:55.152502+00
c2898b93-6a70-4812-99cc-0f5feae55a3c	66f67e8e-0e27-4df2-a486-35b61d34d834	8844a8c5-6fc4-413a-b08d-10031d113254	\N	1	f	2026-02-03 22:43:55.152502+00
eb3a6f29-6dd8-409a-a329-eeb33e37fc81	57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	8d8044bc-ce37-4812-96c8-ca0c5b84757f	\N	0	f	2026-02-03 22:43:55.152502+00
6e76d0eb-b46f-4503-a44f-68c971bc32ce	57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	8844a8c5-6fc4-413a-b08d-10031d113254	\N	1	f	2026-02-03 22:43:55.152502+00
6af5aca3-fa6d-4aee-846d-d13eda67cc41	57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	faf4de0e-0d1b-4eac-a788-d2bf4f731e79	\N	2	f	2026-02-03 22:43:55.152502+00
9146bec9-4847-4f37-ba4f-16eb9c45991a	57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	d704d598-fe93-49d7-b6ba-38c41d612ed3	\N	3	f	2026-02-03 22:43:55.152502+00
52b4647b-b55e-471f-8f10-bb7dea4b38f1	57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	8fcae1d1-c680-4f07-bd6e-6cd456db9bae	\N	4	f	2026-02-03 22:43:55.152502+00
2c7557b7-88d9-40f4-83a2-ccb7459c542a	57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	bdf7804f-d933-466d-bee5-acbbe3ed4f52	\N	5	f	2026-02-03 22:43:55.152502+00
5f9ddf59-bb86-4b19-8753-b7e3a3427c2c	57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	8b225d04-ab29-4273-9a79-c68ce7ff7412	\N	6	f	2026-02-03 22:43:55.152502+00
ef581c2f-ffee-4f76-ab87-36df1403b364	aa11178c-7861-4db3-b6e8-f0fa17417511	325eafab-45db-4cc0-bb05-45be9428596b	\N	0	f	2026-02-03 22:43:55.152502+00
9e5832e7-dfd8-4a70-b972-42836ec46d2c	b8eeeea8-9839-43d5-9d67-ba3344185565	325eafab-45db-4cc0-bb05-45be9428596b	\N	0	f	2026-02-03 22:43:55.152502+00
a071b263-d88e-4927-8551-bb3d14a4beef	b8eeeea8-9839-43d5-9d67-ba3344185565	8844a8c5-6fc4-413a-b08d-10031d113254	\N	1	f	2026-02-03 22:43:55.152502+00
b6e5edfd-db1c-46d3-87b6-a275c3c3f336	73dae566-b163-4468-8e47-204685b349fb	d10dad96-8976-4104-a923-18faa97daaeb	\N	0	f	2026-02-03 22:43:55.152502+00
cc175cce-6bfc-42ba-a369-d70e134437b2	1211ec58-4d5c-4d73-b9c5-e071cce1ba96	d10dad96-8976-4104-a923-18faa97daaeb	\N	0	f	2026-02-03 22:43:55.152502+00
9e7121c0-c29c-4830-abb0-fefcf95f78c6	1211ec58-4d5c-4d73-b9c5-e071cce1ba96	325eafab-45db-4cc0-bb05-45be9428596b	\N	1	f	2026-02-03 22:43:55.152502+00
0d9c5f2b-c36d-4609-9b84-0c80ed4d1fe2	1211ec58-4d5c-4d73-b9c5-e071cce1ba96	8844a8c5-6fc4-413a-b08d-10031d113254	\N	2	f	2026-02-03 22:43:55.152502+00
\.



COPY "public"."user_recipe_steps" ("id", "user_recipe_id", "step_order", "instruction_en", "instruction_es", "recipe_section_en", "recipe_section_es", "thermomix_time", "thermomix_speed", "thermomix_temperature", "created_at", "updated_at") FROM stdin;
d5a4fbda-27e8-4545-ae35-a455abd63edc	6de3ccca-f494-4bc7-b35f-f88fab8233a9	1	Chop the garlic and asparagus in the Thermomix.	\N	Main	Principal	10	5	0°C	2026-02-02 23:32:36.450504+00	2026-02-02 23:32:36.450504+00
53a71d0a-b990-49f1-8a24-368a8aab8222	6de3ccca-f494-4bc7-b35f-f88fab8233a9	2	Add olive oil, salt, black pepper, and lemon juice to the chopped garlic and asparagus. Mix well.	\N	Main	Principal	15	5	0°C	2026-02-02 23:32:36.450504+00	2026-02-02 23:32:36.450504+00
877f057f-a93d-41c5-b15e-ae1bceea524d	6de3ccca-f494-4bc7-b35f-f88fab8233a9	3	Add the chicken breast to the mixture in the Thermomix and marinate for 10 minutes.	\N	Main	Principal	600	1	0°C	2026-02-02 23:32:36.450504+00	2026-02-02 23:32:36.450504+00
544b8407-ba53-4136-96ce-72c54c740bc9	6de3ccca-f494-4bc7-b35f-f88fab8233a9	4	Cook the rice in the Thermomix by adding 300ml of water and cooking on speed 1 for 15 minutes.	\N	Main	Principal	900	1	100°C	2026-02-02 23:32:36.450504+00	2026-02-02 23:32:36.450504+00
25d8caf2-ff20-4b68-a14b-f528505998df	6de3ccca-f494-4bc7-b35f-f88fab8233a9	5	Place the marinated chicken and asparagus mixture into the air fryer and cook at 180°C for 15 minutes.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:32:36.450504+00	2026-02-02 23:32:36.450504+00
1fa051e2-8a30-4f54-a30d-cf95564adeb7	6de3ccca-f494-4bc7-b35f-f88fab8233a9	6	Serve the chicken and asparagus over the cooked rice.	\N	Main	Principal	\N	\N	\N	2026-02-02 23:32:36.450504+00	2026-02-02 23:32:36.450504+00
07495113-e201-4d29-b4e4-69d933c2e075	cec7915c-4ce9-4d5f-b270-f9a83831b127	1	Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.	\N	Main	Principal	60	1	100°C	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
cf83912f-4a07-4f97-b936-591c120e45e2	cec7915c-4ce9-4d5f-b270-f9a83831b127	2	Cook the quinoa for 15 minutes.	\N	Main	Principal	900	1	100°C	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
dd51a8c8-5601-4b1f-a44c-1386c9362a0f	cec7915c-4ce9-4d5f-b270-f9a83831b127	3	While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.	\N	Main	Principal	30	7	0°C	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
3cd8f0e8-1500-4b15-86ce-134f7d0b7101	cec7915c-4ce9-4d5f-b270-f9a83831b127	4	Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
e2c96964-3451-46e1-b4ff-4b98d55f578b	cec7915c-4ce9-4d5f-b270-f9a83831b127	5	While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.	\N	Main	Principal	60	1	0°C	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
babf694d-3b80-4979-bea2-1187fd1cbc04	cec7915c-4ce9-4d5f-b270-f9a83831b127	6	Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
33977cc9-7b04-468c-8408-fdfbaea74f9a	cec7915c-4ce9-4d5f-b270-f9a83831b127	7	Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
7d163776-e19c-4442-9581-5d83f9afbbc4	cec7915c-4ce9-4d5f-b270-f9a83831b127	8	Transfer to a serving plate and garnish with additional lemon juice if desired.	\N	Main	Principal	\N	\N	\N	2026-02-02 23:35:31.311304+00	2026-02-02 23:35:31.311304+00
5f61e3c2-c39a-48ea-9916-81efd171a05a	81fb771c-78c9-4523-a14f-5052144931c2	1	Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.	\N	Main	Principal	60	1	100°C	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
24c67850-c921-45e6-923c-9ce8c2b90396	81fb771c-78c9-4523-a14f-5052144931c2	2	Cook the quinoa for 15 minutes.	\N	Main	Principal	900	1	100°C	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
3224fb7f-d313-4761-9d07-ee8b994abd16	81fb771c-78c9-4523-a14f-5052144931c2	3	While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.	\N	Main	Principal	30	7	0°C	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
878965de-e638-40ce-8c4d-472bbc01f67d	81fb771c-78c9-4523-a14f-5052144931c2	4	Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
8318baf4-2d54-454d-a54f-b91670d76fbd	81fb771c-78c9-4523-a14f-5052144931c2	5	While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.	\N	Main	Principal	60	1	0°C	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
4b83d797-552a-4d03-ae76-02e6ae2c89c9	81fb771c-78c9-4523-a14f-5052144931c2	6	Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
838d396d-0411-4173-8c03-ae5e82e8628b	81fb771c-78c9-4523-a14f-5052144931c2	7	Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
ebb37922-65a1-460f-8c3a-cfa046134570	81fb771c-78c9-4523-a14f-5052144931c2	8	Transfer to a serving plate and garnish with additional lemon juice if desired.	\N	Main	Principal	\N	\N	\N	2026-02-02 23:35:49.985717+00	2026-02-02 23:35:49.985717+00
ac3c4092-593d-4458-b4ec-55419778b113	d7a68f62-81c1-4f67-92b5-569aab9154ea	1	Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.	\N	Main	Principal	60	1	100°C	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
1edbb30d-d00a-40f9-98c8-dcb5d7e76a74	d7a68f62-81c1-4f67-92b5-569aab9154ea	2	Cook the quinoa for 15 minutes.	\N	Main	Principal	900	1	100°C	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
cedb5f11-9c88-4a71-a8d6-dc4668752eef	d7a68f62-81c1-4f67-92b5-569aab9154ea	3	While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.	\N	Main	Principal	30	7	0°C	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
fd2a2e67-1a0d-4eae-bda9-c573f547e81c	d7a68f62-81c1-4f67-92b5-569aab9154ea	4	Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
129f9c61-2cf4-4310-ab11-f9e1ad9259dc	d7a68f62-81c1-4f67-92b5-569aab9154ea	5	While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.	\N	Main	Principal	60	1	0°C	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
7d004dd5-5577-4fc4-9efa-56c8bc45165b	d7a68f62-81c1-4f67-92b5-569aab9154ea	6	Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
6098837b-45dd-4e24-abbe-21178f7338d1	d7a68f62-81c1-4f67-92b5-569aab9154ea	7	Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
c5981082-cb60-4efc-a4f5-9d477c3e3bb7	d7a68f62-81c1-4f67-92b5-569aab9154ea	8	Transfer to a serving plate and garnish with additional lemon juice if desired.	\N	Main	Principal	\N	\N	\N	2026-02-02 23:35:57.694017+00	2026-02-02 23:35:57.694017+00
0a62e1a5-01a5-4887-a9ea-b40c03de2faf	abed1395-ed78-4d74-a8b6-64eac10b716f	1	Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.	\N	Main	Principal	60	1	100°C	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
d7957c49-61dc-4438-a464-7a23e8731db9	abed1395-ed78-4d74-a8b6-64eac10b716f	2	Cook the quinoa for 15 minutes.	\N	Main	Principal	900	1	100°C	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
be38ebc1-fff7-44ed-96d7-554a3d774440	abed1395-ed78-4d74-a8b6-64eac10b716f	3	While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.	\N	Main	Principal	30	7	0°C	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
796e7a75-9c66-4332-bea1-11e0bf7cab29	abed1395-ed78-4d74-a8b6-64eac10b716f	4	Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
e53cb404-2e5b-45ec-ab1b-688e8857e640	abed1395-ed78-4d74-a8b6-64eac10b716f	5	While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.	\N	Main	Principal	60	1	0°C	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
2a542e11-2895-44a6-8534-ae1d5511be25	abed1395-ed78-4d74-a8b6-64eac10b716f	6	Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
5e0f3a75-aeab-4630-905f-a0368f95e037	abed1395-ed78-4d74-a8b6-64eac10b716f	7	Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.	\N	Main	Principal	\N	\N	0°C	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
41810782-9beb-47c5-85d7-ee196cd8e7b3	abed1395-ed78-4d74-a8b6-64eac10b716f	8	Transfer to a serving plate and garnish with additional lemon juice if desired.	\N	Main	Principal	\N	\N	\N	2026-02-02 23:36:07.932892+00	2026-02-02 23:36:07.932892+00
1bc19d1f-97e3-4897-8cd8-baf0e160ec48	7888f272-1358-4e75-a331-a4baffee184d	1	Chop the garlic and tomatoes.	\N	Main	Principal	10	5	50°C	2026-02-03 00:01:52.234071+00	2026-02-03 00:01:52.234071+00
ae7d64a9-7b6c-435a-91f3-4e0a68813991	7888f272-1358-4e75-a331-a4baffee184d	2	Add olive oil, oregano, salt, and black pepper to the chopped tomatoes and garlic. Mix well.	\N	Main	Principal	15	5	50°C	2026-02-03 00:01:52.234071+00	2026-02-03 00:01:52.234071+00
a145c1b7-b516-4ccb-9654-7a9d116b115f	7888f272-1358-4e75-a331-a4baffee184d	3	Cut the chicken breast into bite-sized pieces and add to the bowl. Stir to coat the chicken with the tomato mixture.	\N	Main	Principal	15	1	50°C	2026-02-03 00:01:52.234071+00	2026-02-03 00:01:52.234071+00
099db8d2-18a3-4d0c-9b94-7c4b190eaa22	7888f272-1358-4e75-a331-a4baffee184d	4	Transfer the chicken and tomato mixture to the air fryer basket and cook at 200°C for 15 minutes.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:01:52.234071+00	2026-02-03 00:01:52.234071+00
50eb73eb-1827-4e98-afa3-0d61640dfa6a	7888f272-1358-4e75-a331-a4baffee184d	5	Serve the Mediterranean chicken with tomatoes hot.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:01:52.234071+00	2026-02-03 00:01:52.234071+00
6042e226-007f-4044-a4b0-e44d79d00d78	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	1	Chop garlic and tomatoes in the Thermomix.	\N	Main	Principal	10	5	0°C	2026-02-03 00:15:23.72291+00	2026-02-03 00:15:23.72291+00
395ceb63-69bf-4ac6-9cb9-e48d94ffaa87	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	2	Add olive oil, dried oregano, salt, black pepper, and red pepper flakes to the chopped mixture and mix well.	\N	Main	Principal	15	5	0°C	2026-02-03 00:15:23.72291+00	2026-02-03 00:15:23.72291+00
aa02f063-7d3a-4fa5-be00-def0bf045452	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	3	Cut chicken breast into strips and season with the tomato mixture.	\N	Main	Principal	\N	\N	0°C	2026-02-03 00:15:23.72291+00	2026-02-03 00:15:23.72291+00
566e08de-fa57-4c35-b414-7089e98b5ccc	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	4	Transfer the chicken to the air fryer and cook at 200°C for 15 minutes.	\N	Main	Principal	900	\N	0°C	2026-02-03 00:15:23.72291+00	2026-02-03 00:15:23.72291+00
e3d71238-a20b-4895-b9d3-46448b5aaf43	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	5	Let the chicken rest for a few minutes before serving.	\N	Main	Principal	180	\N	0°C	2026-02-03 00:15:23.72291+00	2026-02-03 00:15:23.72291+00
3c288804-433e-44c6-895c-6684a72f295f	d9495978-2959-40cb-b49c-de131a4eaf8e	1	Chop the garlic using the Thermomix.	\N	Main	Principal	10	7	\N	2026-02-03 00:17:08.473714+00	2026-02-03 00:17:08.473714+00
fc7885b0-e512-4a69-815f-9700205df72d	d9495978-2959-40cb-b49c-de131a4eaf8e	2	Combine the chopped garlic, olive oil, dried oregano, salt, black pepper, and red pepper flakes in the Thermomix to make the meatball mixture.	\N	Main	Principal	15	5	\N	2026-02-03 00:17:08.473714+00	2026-02-03 00:17:08.473714+00
82607625-b583-47df-9333-3f148255c059	d9495978-2959-40cb-b49c-de131a4eaf8e	3	Add the chicken breast to the mixture and blend until well combined.	\N	Main	Principal	30	8	\N	2026-02-03 00:17:08.473714+00	2026-02-03 00:17:08.473714+00
491031f4-36cf-4c49-908d-2d86365be6b6	d9495978-2959-40cb-b49c-de131a4eaf8e	4	Form the mixture into meatballs and place them in the air fryer basket.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:17:08.473714+00	2026-02-03 00:17:08.473714+00
9efee311-4015-4252-ae09-719ccff683f7	d9495978-2959-40cb-b49c-de131a4eaf8e	5	Cook the meatballs in the air fryer at 180°C for 10-12 minutes, or until the internal temperature reaches 75°C.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:17:08.473714+00	2026-02-03 00:17:08.473714+00
e35abeff-622b-41c6-954a-9d942424a918	d9495978-2959-40cb-b49c-de131a4eaf8e	6	Cook the rice according to package instructions.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:17:08.473714+00	2026-02-03 00:17:08.473714+00
9db9f93e-4db2-46e4-8504-969684456748	8e491e41-0691-4dc4-a663-c65016a36b00	1	Chop the onion and garlic.	\N	Main	Principal	10	5	\N	2026-02-03 00:18:40.905079+00	2026-02-03 00:18:40.905079+00
1b39eba8-6928-45ef-8a0a-86501110cf1a	8e491e41-0691-4dc4-a663-c65016a36b00	2	Sauté the chopped onion and garlic in olive oil until fragrant.	\N	Main	Principal	180	1	100°C	2026-02-03 00:18:40.905079+00	2026-02-03 00:18:40.905079+00
09805e8c-e305-4fbe-bbdf-9cba710e9ef0	8e491e41-0691-4dc4-a663-c65016a36b00	3	Add the ground beef, salt, pepper, and oregano, and cook until browned.	\N	Main	Principal	300	1	100°C	2026-02-03 00:18:40.905079+00	2026-02-03 00:18:40.905079+00
15623435-0514-4d49-9d2d-7f36267cf515	8e491e41-0691-4dc4-a663-c65016a36b00	4	Add the chopped tomatoes and water. Cook until the mixture is heated through.	\N	Main	Principal	300	1	100°C	2026-02-03 00:18:40.905079+00	2026-02-03 00:18:40.905079+00
79fa7bf5-d10b-4eb7-a65b-fa496b1a8b17	8e491e41-0691-4dc4-a663-c65016a36b00	5	Add the rice and stir to combine. Cook until the rice is tender.	\N	Main	Principal	600	1	100°C	2026-02-03 00:18:40.905079+00	2026-02-03 00:18:40.905079+00
1a0dbe41-4148-4aa1-9a1d-eaaba0387ad2	8e491e41-0691-4dc4-a663-c65016a36b00	6	Let it rest for a few minutes before serving.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:18:40.905079+00	2026-02-03 00:18:40.905079+00
a77fb49b-7c35-492b-9341-8621396d9e6c	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	1	Chop the chicken into bite-sized pieces.	\N	Main	Principal	10	5	\N	2026-02-03 00:26:07.464917+00	2026-02-03 00:26:07.464917+00
475e0a75-96d2-4bbe-9a66-5e2beac0a6c6	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	2	Sauté the chopped chicken until lightly browned.	\N	Main	Principal	300	1	100°C	2026-02-03 00:26:07.464917+00	2026-02-03 00:26:07.464917+00
125f15ef-cc7c-4b23-a3cd-660d4b831f32	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	3	Add the mixed vegetables and sauté for an additional 2 minutes.	\N	Main	Principal	120	1	100°C	2026-02-03 00:26:07.464917+00	2026-02-03 00:26:07.464917+00
ee7d3743-6cdb-44fe-a8fa-2f76e696ccee	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	4	Pour in the broth and soy sauce, then bring to a boil.	\N	Main	Principal	600	1	100°C	2026-02-03 00:26:07.464917+00	2026-02-03 00:26:07.464917+00
55f017d9-1fe4-499a-816f-98a0129e1aa9	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	5	Add the ramen noodles and cook until tender.	\N	Main	Principal	300	1	100°C	2026-02-03 00:26:07.464917+00	2026-02-03 00:26:07.464917+00
ef23d573-475f-4258-85c2-c7ab07db899b	349f970a-8e3a-4051-b3aa-d335c517e26e	1	Chop the chicken into bite-sized pieces.	\N	Main	Principal	10	5	\N	2026-02-03 00:28:01.195136+00	2026-02-03 00:28:01.195136+00
4c7e4f73-464d-49ef-b720-30121cf89e73	349f970a-8e3a-4051-b3aa-d335c517e26e	2	Sauté the chopped chicken until lightly browned.	\N	Main	Principal	300	1	100°C	2026-02-03 00:28:01.195136+00	2026-02-03 00:28:01.195136+00
124e64c3-6d4a-4904-8a05-e515612a607b	349f970a-8e3a-4051-b3aa-d335c517e26e	3	Add the mixed vegetables and sauté for an additional 2 minutes.	\N	Main	Principal	120	1	100°C	2026-02-03 00:28:01.195136+00	2026-02-03 00:28:01.195136+00
f266e4ca-e925-4fa7-9f9d-6da8ef89340f	349f970a-8e3a-4051-b3aa-d335c517e26e	4	Pour in the broth and soy sauce, then bring to a boil.	\N	Main	Principal	600	1	100°C	2026-02-03 00:28:01.195136+00	2026-02-03 00:28:01.195136+00
a3ad5118-7f47-411c-b9ad-a73576e80b9b	349f970a-8e3a-4051-b3aa-d335c517e26e	5	Add the ramen noodles and cook until tender.	\N	Main	Principal	300	1	100°C	2026-02-03 00:28:01.195136+00	2026-02-03 00:28:01.195136+00
fadc31be-8e84-4b24-808e-e22da9615dcc	356a7dc6-2b8f-4989-8abd-96690d43819e	1	Slice the beef into thin strips.	\N	Main	Principal	10	5	Varoma	2026-02-03 00:29:17.323646+00	2026-02-03 00:29:17.323646+00
1d7440fa-5c84-4969-8611-780d6c67add0	356a7dc6-2b8f-4989-8abd-96690d43819e	2	Chop the garlic and ginger.	\N	Main	Principal	5	7	Varoma	2026-02-03 00:29:17.323646+00	2026-02-03 00:29:17.323646+00
0b116461-a8e2-4106-9d83-25a1ad359174	356a7dc6-2b8f-4989-8abd-96690d43819e	3	Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.	\N	Main	Principal	10	1	100°C	2026-02-03 00:29:17.323646+00	2026-02-03 00:29:17.323646+00
19b0d201-8ebc-4f41-b3fc-f94db2f08adb	356a7dc6-2b8f-4989-8abd-96690d43819e	4	Add the broccoli florets to the mixing bowl.	\N	Main	Principal	5	1	100°C	2026-02-03 00:29:17.323646+00	2026-02-03 00:29:17.323646+00
e338cbae-1700-4f51-b11e-37d382ad9c6f	356a7dc6-2b8f-4989-8abd-96690d43819e	5	Cook until the beef is tender and the broccoli is cooked but still crisp.	\N	Main	Principal	600	1	100°C	2026-02-03 00:29:17.323646+00	2026-02-03 00:29:17.323646+00
1234f3e9-c1d0-46e7-a2e7-9374f84d2681	356a7dc6-2b8f-4989-8abd-96690d43819e	6	Transfer to a serving plate and serve hot.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:29:17.323646+00	2026-02-03 00:29:17.323646+00
9e27cdf2-4a66-4edc-99ca-2d7fceb3f664	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	1	Slice the beef into thin strips.	\N	Main	Principal	10	5	Varoma	2026-02-03 00:37:10.200867+00	2026-02-03 00:37:10.200867+00
cb505477-f53a-4f42-98ce-e31d45f7113c	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	2	Chop the garlic and ginger.	\N	Main	Principal	5	7	Varoma	2026-02-03 00:37:10.200867+00	2026-02-03 00:37:10.200867+00
a7809e6f-be35-4efc-a017-f6e7d320321b	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	3	Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.	\N	Main	Principal	10	1	100°C	2026-02-03 00:37:10.200867+00	2026-02-03 00:37:10.200867+00
b7b67c82-bff6-4241-a1e2-b882d01d86d3	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	4	Add the broccoli florets to the mixing bowl.	\N	Main	Principal	5	1	100°C	2026-02-03 00:37:10.200867+00	2026-02-03 00:37:10.200867+00
54273901-b355-4d67-9218-707e5838f9cc	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	5	Cook until the beef is tender and the broccoli is cooked but still crisp.	\N	Main	Principal	600	1	100°C	2026-02-03 00:37:10.200867+00	2026-02-03 00:37:10.200867+00
cd3a3065-6f30-403d-be7f-08387fb8e99b	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	6	Transfer to a serving plate and serve hot.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:37:10.200867+00	2026-02-03 00:37:10.200867+00
f490878c-b38c-4c37-a4a0-2325673369c9	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	1	Slice the beef into thin strips.	\N	Main	Principal	10	5	Varoma	2026-02-03 00:39:09.395963+00	2026-02-03 00:39:09.395963+00
9aa12c2c-7ca0-43f7-9408-9e6c6dcf2d19	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	2	Chop the garlic and ginger.	\N	Main	Principal	5	7	Varoma	2026-02-03 00:39:09.395963+00	2026-02-03 00:39:09.395963+00
1a387267-f121-42fa-b222-d000dd89a05e	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	3	Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.	\N	Main	Principal	10	1	100°C	2026-02-03 00:39:09.395963+00	2026-02-03 00:39:09.395963+00
b9644f22-dad1-4bac-b548-511f5f7b2bb1	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	4	Add the broccoli florets to the mixing bowl.	\N	Main	Principal	5	1	100°C	2026-02-03 00:39:09.395963+00	2026-02-03 00:39:09.395963+00
26e0ff36-f7a5-4b5c-a93f-c947982ad207	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	5	Cook until the beef is tender and the broccoli is cooked but still crisp.	\N	Main	Principal	600	1	100°C	2026-02-03 00:39:09.395963+00	2026-02-03 00:39:09.395963+00
fdc15984-95c1-4df1-9479-e2b554920e32	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	6	Transfer to a serving plate and serve hot.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:39:09.395963+00	2026-02-03 00:39:09.395963+00
9590b4ae-be0e-4470-b5ce-d98dfc85c407	2c0cf733-0852-4340-ae48-0b19429b320d	1	Slice the beef into thin strips.	\N	Main	Principal	10	5	Varoma	2026-02-03 00:39:50.807084+00	2026-02-03 00:39:50.807084+00
e90a28f0-2e3e-4d4d-afd1-dab81c20ed19	2c0cf733-0852-4340-ae48-0b19429b320d	2	Chop the garlic and ginger.	\N	Main	Principal	5	7	Varoma	2026-02-03 00:39:50.807084+00	2026-02-03 00:39:50.807084+00
f8d5891e-7527-4ebf-92f0-c25fc1b75843	2c0cf733-0852-4340-ae48-0b19429b320d	3	Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.	\N	Main	Principal	10	1	100°C	2026-02-03 00:39:50.807084+00	2026-02-03 00:39:50.807084+00
2f7171d0-00aa-4c26-a06b-936b350aa491	2c0cf733-0852-4340-ae48-0b19429b320d	4	Add the broccoli florets to the mixing bowl.	\N	Main	Principal	5	1	100°C	2026-02-03 00:39:50.807084+00	2026-02-03 00:39:50.807084+00
20020979-af70-4295-b378-a718cc967562	2c0cf733-0852-4340-ae48-0b19429b320d	5	Cook until the beef is tender and the broccoli is cooked but still crisp.	\N	Main	Principal	600	1	100°C	2026-02-03 00:39:50.807084+00	2026-02-03 00:39:50.807084+00
b26ec830-82ee-401e-807b-aa65e99189ea	2c0cf733-0852-4340-ae48-0b19429b320d	6	Transfer to a serving plate and serve hot.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:39:50.807084+00	2026-02-03 00:39:50.807084+00
4b98d2de-a2b3-49eb-8cb8-c4dec4dc8542	3db03012-8af9-45f5-927a-7a68864d5d3a	1	Chop the mushrooms and tomatoes into small pieces.	\N	Main	Principal	10	5	0°C	2026-02-03 00:47:50.345904+00	2026-02-03 00:47:50.345904+00
b491dbf3-4bf9-4dab-a68b-874ffcd1aa0a	3db03012-8af9-45f5-927a-7a68864d5d3a	2	Sauté the chopped mushrooms and tomatoes until tender.	\N	Main	Principal	300	1	100°C	2026-02-03 00:47:50.345904+00	2026-02-03 00:47:50.345904+00
d614e081-d557-4820-b5d8-be92ada9a9ef	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	1	Chop the mushrooms and tomatoes into small pieces.	\N	Main	Principal	10	5	0°C	2026-02-03 00:48:55.504035+00	2026-02-03 00:48:55.504035+00
90f5e1a8-3ebd-49e6-bda8-2459735e20a2	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	2	Chop the garlic.	\N	Main	Principal	5	5	0°C	2026-02-03 00:48:55.504035+00	2026-02-03 00:48:55.504035+00
792f9944-e48d-4a15-94cc-cbb8df05dfef	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	3	Add olive oil, garlic, mushrooms, and tomatoes to the Thermomix and sauté until fragrant.	\N	Main	Principal	180	1	100°C	2026-02-03 00:48:55.504035+00	2026-02-03 00:48:55.504035+00
2e258b6c-375b-4751-b5f4-470ae9a343e1	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	4	Season the chicken breast with salt and pepper, then add to the Thermomix.	\N	Main	Principal	300	1	100°C	2026-02-03 00:48:55.504035+00	2026-02-03 00:48:55.504035+00
78ad37b5-5542-4a79-8f11-55edbadab97f	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	5	Transfer the mixture to the air fryer and cook at 180°C for 5 minutes.	\N	Main	Principal	\N	\N	0°C	2026-02-03 00:48:55.504035+00	2026-02-03 00:48:55.504035+00
3bebf426-055d-41ba-b3aa-27dfcb88a6e4	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	6	Garnish with fresh basil before serving.	\N	Main	Principal	\N	\N	0°C	2026-02-03 00:48:55.504035+00	2026-02-03 00:48:55.504035+00
d980285d-b131-45e5-a440-7bddb406ac7c	94b56036-d308-4130-9fb0-77eccf5389cb	1	Chop the garlic and tomatoes.	\N	Main	Principal	10	7	50°C	2026-02-03 00:57:19.107716+00	2026-02-03 00:57:19.107716+00
e042bdf9-cfba-48d9-b8a0-a2d73516acbf	94b56036-d308-4130-9fb0-77eccf5389cb	2	Sauté the garlic and tomatoes in olive oil until fragrant.	\N	Main	Principal	300	1	100°C	2026-02-03 00:57:19.107716+00	2026-02-03 00:57:19.107716+00
df8f6998-daeb-4118-9784-7ebb89d5ec56	94b56036-d308-4130-9fb0-77eccf5389cb	3	Add the rice, salt, black pepper, and 300 ml of water, then cook until rice is tender.	\N	Main	Principal	1200	1	100°C	2026-02-03 00:57:19.107716+00	2026-02-03 00:57:19.107716+00
6ae12560-a222-4263-bdfb-2674244ba411	94b56036-d308-4130-9fb0-77eccf5389cb	4	While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:57:19.107716+00	2026-02-03 00:57:19.107716+00
994648f9-7054-4b8c-ad1e-6ef66f27e586	94b56036-d308-4130-9fb0-77eccf5389cb	5	Place the seasoned chicken breast and asparagus in the air fryer and cook until the chicken reaches 75°C and asparagus is tender.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:57:19.107716+00	2026-02-03 00:57:19.107716+00
0ff448f4-05b4-4ba0-8061-6c7de4bba14c	94b56036-d308-4130-9fb0-77eccf5389cb	6	Once the rice is cooked, fluff it with a fork and serve with the chicken and asparagus.	\N	Main	Principal	\N	\N	\N	2026-02-03 00:57:19.107716+00	2026-02-03 00:57:19.107716+00
00344a02-79fe-44fc-a261-f61d5a1e297f	3e8946a0-3a50-40dc-8b08-6d38a4133c83	1	Chop the garlic and tomatoes.	\N	Main	Principal	10	7	50°C	2026-02-03 03:10:03.452918+00	2026-02-03 03:10:03.452918+00
516e0c8a-cbf6-4a2e-9fba-836ba84748ae	3e8946a0-3a50-40dc-8b08-6d38a4133c83	2	Sauté the garlic and tomatoes in olive oil until fragrant.	\N	Main	Principal	300	1	100°C	2026-02-03 03:10:03.452918+00	2026-02-03 03:10:03.452918+00
a15e72be-a1a0-4ddf-ac00-b82ee43f36db	3e8946a0-3a50-40dc-8b08-6d38a4133c83	3	Add the rice, salt, black pepper, and 300 ml of water, then cook until rice is tender.	\N	Main	Principal	1200	1	100°C	2026-02-03 03:10:03.452918+00	2026-02-03 03:10:03.452918+00
8e549ffa-1a85-48af-aef4-87c685abe9ba	3e8946a0-3a50-40dc-8b08-6d38a4133c83	4	While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.	\N	Main	Principal	\N	\N	\N	2026-02-03 03:10:03.452918+00	2026-02-03 03:10:03.452918+00
eab195f6-d511-4ebf-a9a4-1cee45ed8e2a	3e8946a0-3a50-40dc-8b08-6d38a4133c83	5	Place the seasoned chicken breast and asparagus in the air fryer and cook until the chicken reaches 75°C and asparagus is tender.	\N	Main	Principal	\N	\N	\N	2026-02-03 03:10:03.452918+00	2026-02-03 03:10:03.452918+00
e33ac6d6-1b9c-4ef8-b302-77dd86ea8f07	3e8946a0-3a50-40dc-8b08-6d38a4133c83	6	Once the rice is cooked, fluff it with a fork and serve with the chicken and asparagus.	\N	Main	Principal	\N	\N	\N	2026-02-03 03:10:03.452918+00	2026-02-03 03:10:03.452918+00
286066e9-386d-4862-a4d8-858da8f28e8f	41aa6f29-3d08-41a2-b638-bf84182bf920	1	Chop the garlic and zucchini into small pieces.	\N	Main	Principal	10	5	50°C	2026-02-03 03:15:26.144663+00	2026-02-03 03:15:26.144663+00
34e1f22f-7cb4-46e8-b37c-c4d36bbc54e4	41aa6f29-3d08-41a2-b638-bf84182bf920	2	Add the olive oil, salt, black pepper, and lemon juice to the chopped zucchini and garlic, and mix well.	\N	Main	Principal	10	5	50°C	2026-02-03 03:15:26.144663+00	2026-02-03 03:15:26.144663+00
32efd5ce-e852-4fcc-bada-2b9405fff3e5	41aa6f29-3d08-41a2-b638-bf84182bf920	3	Cut the chicken breast into bite-sized pieces and add to the mixture.	\N	Main	Principal	10	5	50°C	2026-02-03 03:15:26.144663+00	2026-02-03 03:15:26.144663+00
718c900a-0527-4139-b5fb-75e8699e17ca	41aa6f29-3d08-41a2-b638-bf84182bf920	4	Transfer the chicken and zucchini mixture to the air fryer and cook at 180°C for 15 minutes, shaking halfway through.	\N	Main	Principal	\N	\N	0°C	2026-02-03 03:15:26.144663+00	2026-02-03 03:15:26.144663+00
0041caaf-e58f-4e51-95d1-5574cf8ca15e	41aa6f29-3d08-41a2-b638-bf84182bf920	5	Meanwhile, rinse the rice and add it to the Thermomix with 400 ml of water. Cook the rice.	\N	Main	Principal	15	1	100°C	2026-02-03 03:15:26.144663+00	2026-02-03 03:15:26.144663+00
872cdd6c-ff24-42bd-b816-f7bea22c49b2	41aa6f29-3d08-41a2-b638-bf84182bf920	6	Once the chicken is cooked, combine it with the cooked rice and diced tomatoes.	\N	Main	Principal	20	1	100°C	2026-02-03 03:15:26.144663+00	2026-02-03 03:15:26.144663+00
2e94a36e-3c22-4c97-8515-b7f87e714193	41aa6f29-3d08-41a2-b638-bf84182bf920	7	Serve the chicken and rice mixture hot.	\N	Main	Principal	\N	\N	\N	2026-02-03 03:15:26.144663+00	2026-02-03 03:15:26.144663+00
ac7e4b17-96e3-4f73-ac6b-0a207fcc5557	27950842-bff9-4971-9d2e-df32134edf91	1	Chop the garlic cloves into small pieces.	\N	Main	Principal	10	7	50°C	2026-02-03 22:20:14.235687+00	2026-02-03 22:20:14.235687+00
c331c7e8-62df-41c7-96d2-2f0ed9470167	27950842-bff9-4971-9d2e-df32134edf91	2	In a bowl, combine the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to make a marinade.	\N	Main	Principal	30	5	50°C	2026-02-03 22:20:14.235687+00	2026-02-03 22:20:14.235687+00
9f80148d-1c56-4c1d-a0a4-8b78864048ad	27950842-bff9-4971-9d2e-df32134edf91	3	Cut the chicken breast into bite-sized pieces and add to the marinade. Allow to marinate for at least 10 minutes.	\N	Main	Principal	600	Spoon	50°C	2026-02-03 22:20:14.235687+00	2026-02-03 22:20:14.235687+00
9f42efed-1ffc-45aa-89ed-102206d07daa	27950842-bff9-4971-9d2e-df32134edf91	4	Trim the ends of the asparagus and add them to the Thermomix bowl with the marinated chicken.	\N	Main	Principal	10	1	100°C	2026-02-03 22:20:14.235687+00	2026-02-03 22:20:14.235687+00
4d282934-af13-46fc-99bd-c04a8c545220	27950842-bff9-4971-9d2e-df32134edf91	5	Transfer the chicken and asparagus mixture to the air fryer basket.	\N	Main	Principal	\N	\N	0°C	2026-02-03 22:20:14.235687+00	2026-02-03 22:20:14.235687+00
68b13a97-cc4e-46c3-8815-d3fbf87716ea	27950842-bff9-4971-9d2e-df32134edf91	6	Air fry at 200°C for 15 minutes, shaking halfway through for even cooking.	\N	Main	Principal	900	\N	0°C	2026-02-03 22:20:14.235687+00	2026-02-03 22:20:14.235687+00
b27313a7-636b-4be2-80fc-268c2a479fbd	27950842-bff9-4971-9d2e-df32134edf91	7	Serve hot and enjoy your Mediterranean chicken with asparagus.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:20:14.235687+00	2026-02-03 22:20:14.235687+00
437186b9-a22d-4ab3-8e9a-8b9e1db08aee	5ee2165c-67e8-4819-92e5-0978578a667d	1	Chop the garlic cloves into small pieces.	\N	Main	Principal	10	7	50°C	2026-02-03 22:23:34.643548+00	2026-02-03 22:23:34.643548+00
8a20981d-8b65-44af-8283-e44a90297fc7	5ee2165c-67e8-4819-92e5-0978578a667d	2	In a bowl, combine the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to make a marinade.	\N	Main	Principal	30	5	50°C	2026-02-03 22:23:34.643548+00	2026-02-03 22:23:34.643548+00
df959f73-5ce3-41bb-b81a-8ce461d70c51	5ee2165c-67e8-4819-92e5-0978578a667d	3	Cut the chicken breast into bite-sized pieces and add to the marinade. Allow to marinate for at least 10 minutes.	\N	Main	Principal	600	Spoon	50°C	2026-02-03 22:23:34.643548+00	2026-02-03 22:23:34.643548+00
0edcb8d8-8b33-42f8-a8aa-e0b504da3b1f	5ee2165c-67e8-4819-92e5-0978578a667d	4	Trim the ends of the asparagus and add them to the Thermomix bowl with the marinated chicken.	\N	Main	Principal	10	1	100°C	2026-02-03 22:23:34.643548+00	2026-02-03 22:23:34.643548+00
955685e0-6780-44f1-803b-90b35aa7ddd8	5ee2165c-67e8-4819-92e5-0978578a667d	5	Transfer the chicken and asparagus mixture to the air fryer basket.	\N	Main	Principal	\N	\N	0°C	2026-02-03 22:23:34.643548+00	2026-02-03 22:23:34.643548+00
b0aaf46e-2284-45dc-a61c-66bbf5e9f8f7	5ee2165c-67e8-4819-92e5-0978578a667d	6	Air fry at 200°C for 15 minutes, shaking halfway through for even cooking.	\N	Main	Principal	900	\N	0°C	2026-02-03 22:23:34.643548+00	2026-02-03 22:23:34.643548+00
b15f1aaa-813e-4cb9-baa6-48fac523e5ce	5ee2165c-67e8-4819-92e5-0978578a667d	7	Serve hot and enjoy your Mediterranean chicken with asparagus.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:23:34.643548+00	2026-02-03 22:23:34.643548+00
89cf677f-c92e-4e6f-a448-26f075bd55c5	53b2bd54-adc3-4bfc-930a-41d71b8caec7	1	Chop the garlic and season the chicken with olive oil, lemon juice, salt, black pepper, and dried oregano.	\N	Main	Principal	30	5	50°C	2026-02-03 22:32:12.268118+00	2026-02-03 22:32:12.268118+00
efd4b6e6-5e27-49a7-b7b1-274789dff708	53b2bd54-adc3-4bfc-930a-41d71b8caec7	2	Add the asparagus to the Thermomix bowl.	\N	Main	Principal	10	1	100°C	2026-02-03 22:32:12.268118+00	2026-02-03 22:32:12.268118+00
aed0ddf1-30e5-4115-a448-9e576d43fd6f	53b2bd54-adc3-4bfc-930a-41d71b8caec7	3	Transfer the chicken and asparagus mixture to the air fryer basket.	\N	Main	Principal	\N	\N	0°C	2026-02-03 22:32:12.268118+00	2026-02-03 22:32:12.268118+00
f3a99f13-3861-42f2-a0bd-98177428bd34	53b2bd54-adc3-4bfc-930a-41d71b8caec7	4	Air fry at 180°C for about 15 minutes or until the chicken is cooked through (internal temperature should reach 75°C).	\N	Main	Principal	900	\N	0°C	2026-02-03 22:32:12.268118+00	2026-02-03 22:32:12.268118+00
fe8c5740-9638-49e2-ac0c-dfd4659c873d	adb24066-7049-4321-a326-90f56bf30c1a	1	Press the tofu to remove excess moisture and cut it into cubes.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:32:51.083213+00	2026-02-03 22:32:51.083213+00
7617a176-1cf4-4f6a-81e3-4fa8861fccad	adb24066-7049-4321-a326-90f56bf30c1a	2	Chop the garlic.	\N	Main	Principal	10	5	50°C	2026-02-03 22:32:51.083213+00	2026-02-03 22:32:51.083213+00
e05bdd2f-c310-45f4-a389-9d9a0fcaaa4e	adb24066-7049-4321-a326-90f56bf30c1a	3	In the Thermomix, combine olive oil, lemon juice, salt, black pepper, dried oregano, and the chopped garlic. Mix well.	\N	Main	Principal	20	5	50°C	2026-02-03 22:32:51.083213+00	2026-02-03 22:32:51.083213+00
eb36f365-ead8-417d-a8ef-59d36904e9d9	adb24066-7049-4321-a326-90f56bf30c1a	4	Add the tofu cubes to the mixture and marinate for 10 minutes.	\N	Main	Principal	600	1	50°C	2026-02-03 22:32:51.083213+00	2026-02-03 22:32:51.083213+00
1b86c628-3cef-4c69-8791-43aa6a031ce9	adb24066-7049-4321-a326-90f56bf30c1a	5	Prepare the asparagus by trimming the ends.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:32:51.083213+00	2026-02-03 22:32:51.083213+00
09adc653-8904-4480-aa87-8403f85b5178	adb24066-7049-4321-a326-90f56bf30c1a	6	In the air fryer, add the marinated tofu and asparagus. Cook at 200°C for 15 minutes.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:32:51.083213+00	2026-02-03 22:32:51.083213+00
e7f57481-fcf8-4170-aa18-997dbd088298	adb24066-7049-4321-a326-90f56bf30c1a	7	Serve the tofu and asparagus warm.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:32:51.083213+00	2026-02-03 22:32:51.083213+00
658b2367-89e7-4d86-8785-123f532a7d0b	27a78119-5c3a-4e70-837e-6a69ac8d8747	1	Press the tofu to remove excess moisture and cut it into cubes.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:40:02.405157+00	2026-02-03 22:40:02.405157+00
72ff78fe-ae48-4c5e-941b-d786a9186e62	27a78119-5c3a-4e70-837e-6a69ac8d8747	2	Chop the garlic.	\N	Main	Principal	10	5	50°C	2026-02-03 22:40:02.405157+00	2026-02-03 22:40:02.405157+00
08acd081-f025-4dd1-9366-eb9062dd29ae	27a78119-5c3a-4e70-837e-6a69ac8d8747	3	In the Thermomix, combine olive oil, lemon juice, salt, black pepper, dried oregano, and the chopped garlic. Mix well.	\N	Main	Principal	20	5	50°C	2026-02-03 22:40:02.405157+00	2026-02-03 22:40:02.405157+00
22197186-5461-4e50-a7ec-f539077d49e0	27a78119-5c3a-4e70-837e-6a69ac8d8747	4	Add the tofu cubes to the mixture and marinate for 10 minutes.	\N	Main	Principal	600	1	50°C	2026-02-03 22:40:02.405157+00	2026-02-03 22:40:02.405157+00
503b0351-f13f-443e-ba76-7d61547b6192	27a78119-5c3a-4e70-837e-6a69ac8d8747	5	Prepare the asparagus by trimming the ends.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:40:02.405157+00	2026-02-03 22:40:02.405157+00
7129c424-aecd-4a4b-8a59-776cdd10f461	27a78119-5c3a-4e70-837e-6a69ac8d8747	6	In the air fryer, add the marinated tofu and asparagus. Cook at 200°C for 15 minutes.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:40:02.405157+00	2026-02-03 22:40:02.405157+00
2e42bd7c-3494-43c2-8a4a-964571c78118	27a78119-5c3a-4e70-837e-6a69ac8d8747	7	Serve the tofu and asparagus warm.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:40:02.405157+00	2026-02-03 22:40:02.405157+00
1e8a6cfd-fa8f-4fb7-bc30-6bb4775063a6	384de74f-a63e-4738-ac7e-248512e372e1	1	Chop the garlic and asparagus.	\N	Main	Principal	10	5	5°C	2026-02-03 22:41:56.288093+00	2026-02-03 22:41:56.288093+00
96e11b8c-3d0b-4d1e-940e-a10780ecc9a4	384de74f-a63e-4738-ac7e-248512e372e1	2	In a bowl, combine olive oil, lemon juice, salt, black pepper, and dried oregano.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:41:56.288093+00	2026-02-03 22:41:56.288093+00
0a3f00c4-def7-460b-834e-b6dcf42f1713	384de74f-a63e-4738-ac7e-248512e372e1	3	Add the chopped garlic and asparagus to the bowl and mix well.	\N	Main	Principal	10	5	5°C	2026-02-03 22:41:56.288093+00	2026-02-03 22:41:56.288093+00
19539c91-6151-4def-b831-b5745f86f661	384de74f-a63e-4738-ac7e-248512e372e1	4	Cut the chicken breast into bite-sized pieces and add to the bowl, mixing to coat.	\N	Main	Principal	15	5	5°C	2026-02-03 22:41:56.288093+00	2026-02-03 22:41:56.288093+00
d2afcdf6-c4fd-4fba-b4eb-3ada2e9ab479	384de74f-a63e-4738-ac7e-248512e372e1	5	Transfer the chicken and asparagus mixture to the air fryer basket.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:41:56.288093+00	2026-02-03 22:41:56.288093+00
3609de51-afdf-47ea-82d7-2e941bd30a66	384de74f-a63e-4738-ac7e-248512e372e1	6	Cook in the air fryer at 180°C for 15 minutes or until the chicken reaches an internal temperature of 75°C.	\N	Main	Principal	900	Spoon	180°C	2026-02-03 22:41:56.288093+00	2026-02-03 22:41:56.288093+00
2e4ef3d6-5a5c-4079-a9ea-e3e02987d53b	384de74f-a63e-4738-ac7e-248512e372e1	7	Serve hot and enjoy your Mediterranean chicken with asparagus.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:41:56.288093+00	2026-02-03 22:41:56.288093+00
7182cd45-d53b-445c-8ad0-1f305af3c99c	9cdc271d-41ac-42fe-b601-fa38adfc9231	1	Rinse the quinoa under cold water.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
7875384c-723f-4bcc-959c-f26c44ed4761	9cdc271d-41ac-42fe-b601-fa38adfc9231	2	Add quinoa and 300 ml of water to the Thermomix bowl. Cook until quinoa is fluffy.	\N	Main	Principal	1200	1	100°C	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
66f67e8e-0e27-4df2-a486-35b61d34d834	9cdc271d-41ac-42fe-b601-fa38adfc9231	3	Chop the garlic and asparagus.	\N	Main	Principal	10	5	0°C	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
57357e22-2c58-4b9f-a02e-c9e2dcbb08a0	9cdc271d-41ac-42fe-b601-fa38adfc9231	4	In a bowl, combine chopped garlic, asparagus, olive oil, lemon juice, salt, black pepper, and dried oregano. Mix well.	\N	Main	Principal	60	5	0°C	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
aa11178c-7861-4db3-b6e8-f0fa17417511	9cdc271d-41ac-42fe-b601-fa38adfc9231	5	Cut tofu into cubes and add to the bowl with the marinade. Mix gently to coat.	\N	Main	Principal	20	Spoon	0°C	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
b8eeeea8-9839-43d5-9d67-ba3344185565	9cdc271d-41ac-42fe-b601-fa38adfc9231	6	Transfer marinated tofu and asparagus mixture to the air fryer and cook at 200°C for 15 minutes.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
73dae566-b163-4468-8e47-204685b349fb	9cdc271d-41ac-42fe-b601-fa38adfc9231	7	Fluff the cooked quinoa with a fork.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
1211ec58-4d5c-4d73-b9c5-e071cce1ba96	9cdc271d-41ac-42fe-b601-fa38adfc9231	8	Serve the quinoa topped with the roasted tofu and asparagus mix.	\N	Main	Principal	\N	\N	\N	2026-02-03 22:43:54.983507+00	2026-02-03 22:43:54.983507+00
\.



COPY "public"."user_recipe_tags" ("id", "user_recipe_id", "tag_name", "created_at") FROM stdin;
5cd96a7f-6cb9-4068-89d4-49d620f7928c	6de3ccca-f494-4bc7-b35f-f88fab8233a9	sugarFree	2026-02-02 23:32:36.750216+00
67c920c3-a985-4ebf-9337-026b30aae5c6	6de3ccca-f494-4bc7-b35f-f88fab8233a9	mediterranean	2026-02-02 23:32:36.750216+00
d05b8319-f2a0-4a02-a04f-9e4a9b0ba4cd	cec7915c-4ce9-4d5f-b270-f9a83831b127	sugarFree	2026-02-02 23:35:31.521319+00
25346eb1-0fb2-4d55-85ea-2c386c9bee34	cec7915c-4ce9-4d5f-b270-f9a83831b127	mediterranean	2026-02-02 23:35:31.521319+00
685a94fd-2bf7-468b-96da-52adc6c965c8	81fb771c-78c9-4523-a14f-5052144931c2	sugarFree	2026-02-02 23:35:50.202079+00
cca497a1-72eb-4def-926e-02ab5f3fdfe7	81fb771c-78c9-4523-a14f-5052144931c2	mediterranean	2026-02-02 23:35:50.202079+00
b3d13360-3dd5-4a60-9adb-b666c12e14c2	d7a68f62-81c1-4f67-92b5-569aab9154ea	sugarFree	2026-02-02 23:35:57.999576+00
b01cd311-148d-4926-9a9c-4461768c1e0d	d7a68f62-81c1-4f67-92b5-569aab9154ea	mediterranean	2026-02-02 23:35:57.999576+00
848d6875-d7f3-41e4-9d55-ecd08a96f5c8	abed1395-ed78-4d74-a8b6-64eac10b716f	sugarFree	2026-02-02 23:36:08.108757+00
154c72b2-f4e3-46b3-a247-3bb94ba3464e	abed1395-ed78-4d74-a8b6-64eac10b716f	mediterranean	2026-02-02 23:36:08.108757+00
abbc4d61-e461-478e-82e0-125fc8643073	7888f272-1358-4e75-a331-a4baffee184d	mediterranean	2026-02-03 00:01:52.449321+00
46e9425b-da75-4917-b1f1-b52e0a218dcd	7888f272-1358-4e75-a331-a4baffee184d	sugarFree	2026-02-03 00:01:52.449321+00
82298ddb-2603-47e4-a559-707e5783566f	7888f272-1358-4e75-a331-a4baffee184d	chicken	2026-02-03 00:01:52.449321+00
8bdb8ba3-265f-43e8-b9bc-f95771ec3c8e	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	sugarFree	2026-02-03 00:15:23.996655+00
0529c3bd-b44e-40e8-b17b-dd7300ee3f8b	261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	mediterranean	2026-02-03 00:15:23.996655+00
b2d424cf-e42c-4868-aeac-116b7a364028	d9495978-2959-40cb-b49c-de131a4eaf8e	sugarFree	2026-02-03 00:17:08.64232+00
97e0ce00-d94a-4280-99a5-de84dcca6c43	d9495978-2959-40cb-b49c-de131a4eaf8e	mediterranean	2026-02-03 00:17:08.64232+00
13e2316e-f54c-4243-84df-a63db132bc9d	8e491e41-0691-4dc4-a663-c65016a36b00	sugarFree	2026-02-03 00:18:41.132987+00
91944bda-6e5c-4602-baa4-234c784ea7a7	8e491e41-0691-4dc4-a663-c65016a36b00	mediterranean	2026-02-03 00:18:41.132987+00
f9dea7ca-4aca-42d1-9c78-58f26fcf8997	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	sugarFree	2026-02-03 00:26:08.118136+00
3e7bb4cd-5f92-44af-8cba-b56f58b903d3	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	asian	2026-02-03 00:26:08.118136+00
f18117ce-84cc-4517-9a91-da201400068c	c6acf6d5-5d0a-455c-b82b-5bfb1c410714	easy	2026-02-03 00:26:08.118136+00
61069131-e70a-42b2-b072-1c24d247cf32	349f970a-8e3a-4051-b3aa-d335c517e26e	sugarFree	2026-02-03 00:28:01.421084+00
79982a4a-3e21-4cbd-886d-0da1b681b88b	349f970a-8e3a-4051-b3aa-d335c517e26e	asian	2026-02-03 00:28:01.421084+00
afd6b812-5c5d-4a54-a378-72220c8d8546	349f970a-8e3a-4051-b3aa-d335c517e26e	easy	2026-02-03 00:28:01.421084+00
fac616b5-0ea0-4d01-aba1-51f4d08bf493	356a7dc6-2b8f-4989-8abd-96690d43819e	sugarFree	2026-02-03 00:29:17.574422+00
9c2064d7-538d-434a-a87b-7a6bda71733e	356a7dc6-2b8f-4989-8abd-96690d43819e	mediterranean	2026-02-03 00:29:17.574422+00
1e12cbf5-9e55-4a79-bb15-9f8dee136219	356a7dc6-2b8f-4989-8abd-96690d43819e	beef	2026-02-03 00:29:17.574422+00
9d577d73-b3cc-4eda-ae2f-e8ed958c8db9	356a7dc6-2b8f-4989-8abd-96690d43819e	broccoli	2026-02-03 00:29:17.574422+00
0e392cd7-4951-4521-b917-0acc092f37cc	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	sugarFree	2026-02-03 00:37:10.381299+00
20bbe34b-3cb9-4f00-b9ca-7f8eee626afe	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	mediterranean	2026-02-03 00:37:10.381299+00
80266eb2-ed48-4703-8bec-71c838aed128	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	beef	2026-02-03 00:37:10.381299+00
3000f489-8d1a-40d5-abef-e5b07104c5cc	9d9ffeac-79ad-4628-8827-5a2ae56dd68a	broccoli	2026-02-03 00:37:10.381299+00
72f7dee1-918e-42d9-bf9e-e4c0a6d4a3f8	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	sugarFree	2026-02-03 00:39:09.640807+00
5b45fcc4-fe00-4f44-82e8-3938069d3a5b	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	mediterranean	2026-02-03 00:39:09.640807+00
6576b2e8-1f33-4db9-bc53-4e2768ee5e39	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	beef	2026-02-03 00:39:09.640807+00
c992b977-e62b-426e-94ed-4deef32c90d1	213e4f48-bc2a-4ccf-88d5-ad0b455274b5	broccoli	2026-02-03 00:39:09.640807+00
432e566c-9ae5-4e01-8290-18e9c32ff08e	2c0cf733-0852-4340-ae48-0b19429b320d	sugarFree	2026-02-03 00:39:51.042348+00
ba2b767b-6f51-4584-927b-3813d9a8ac9b	2c0cf733-0852-4340-ae48-0b19429b320d	mediterranean	2026-02-03 00:39:51.042348+00
c58951fe-e705-46f2-8cd4-f7bb5154d3cc	2c0cf733-0852-4340-ae48-0b19429b320d	beef	2026-02-03 00:39:51.042348+00
9325e0b4-0bcb-4ade-84a9-ea2b7826accc	2c0cf733-0852-4340-ae48-0b19429b320d	broccoli	2026-02-03 00:39:51.042348+00
92d9479d-f76a-4700-8cc2-61e4960929f8	3db03012-8af9-45f5-927a-7a68864d5d3a	sugarFree	2026-02-03 00:47:50.666165+00
6a5d9ded-77a7-45ce-a0e4-58e156272e11	3db03012-8af9-45f5-927a-7a68864d5d3a	mediterranean	2026-02-03 00:47:50.666165+00
afdef3fd-0286-482f-99cf-447210b06d12	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	sugarFree	2026-02-03 00:48:55.86171+00
22d1d853-8c8f-4c0b-a436-a6b76d5d094e	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	mediterranean	2026-02-03 00:48:55.86171+00
5f863c90-9512-454d-9959-b3c72fe01289	94b56036-d308-4130-9fb0-77eccf5389cb	sugarFree	2026-02-03 00:57:19.352539+00
4558946b-6d29-4916-80aa-52d3c7b4bd73	94b56036-d308-4130-9fb0-77eccf5389cb	mediterranean	2026-02-03 00:57:19.352539+00
9f63074d-4dac-4642-a4f4-f32e25480484	3e8946a0-3a50-40dc-8b08-6d38a4133c83	sugarFree	2026-02-03 03:10:03.67741+00
473ba57d-b7fd-4613-a1fd-a7fe3ed01c12	3e8946a0-3a50-40dc-8b08-6d38a4133c83	mediterranean	2026-02-03 03:10:03.67741+00
d8aeebb8-1034-4039-b9ac-a7c60bd80b83	41aa6f29-3d08-41a2-b638-bf84182bf920	sugarFree	2026-02-03 03:15:26.377309+00
d41b489d-0515-4777-acf2-3c56895eab23	41aa6f29-3d08-41a2-b638-bf84182bf920	mediterranean	2026-02-03 03:15:26.377309+00
24c22f37-9859-4b54-97cc-599cfb1baa59	27950842-bff9-4971-9d2e-df32134edf91	sugarFree	2026-02-03 22:20:14.617548+00
5e864d14-17e1-4ba0-94e8-72cd674b673c	27950842-bff9-4971-9d2e-df32134edf91	mediterranean	2026-02-03 22:20:14.617548+00
3967e6d2-5cf0-4a35-ac46-9e38a7adb341	5ee2165c-67e8-4819-92e5-0978578a667d	sugarFree	2026-02-03 22:23:34.986197+00
52782b53-1bc5-47e6-b563-4d7ebb60f40e	5ee2165c-67e8-4819-92e5-0978578a667d	mediterranean	2026-02-03 22:23:34.986197+00
594b7507-586f-44fc-a12a-483cca1356af	53b2bd54-adc3-4bfc-930a-41d71b8caec7	sugarFree	2026-02-03 22:32:12.710536+00
d1ddf74e-7b8d-465d-882c-1309325d9a88	53b2bd54-adc3-4bfc-930a-41d71b8caec7	mediterranean	2026-02-03 22:32:12.710536+00
eecb7af6-61eb-4eac-a735-6cabf6eeebf1	adb24066-7049-4321-a326-90f56bf30c1a	sugarFree	2026-02-03 22:32:51.378047+00
e6dec710-7ed2-448d-8b55-069813cb903a	adb24066-7049-4321-a326-90f56bf30c1a	mediterranean	2026-02-03 22:32:51.378047+00
db8369e2-5f8f-4f4e-a3b4-2ec18da3507b	27a78119-5c3a-4e70-837e-6a69ac8d8747	sugarFree	2026-02-03 22:40:02.726255+00
c1e6d804-1919-46cd-af35-97cdd8500939	27a78119-5c3a-4e70-837e-6a69ac8d8747	mediterranean	2026-02-03 22:40:02.726255+00
b79ac85c-d693-41a3-93f7-91e03798b529	384de74f-a63e-4738-ac7e-248512e372e1	sugarFree	2026-02-03 22:41:56.615275+00
15b75af7-f29d-407b-ae78-c0693e7c343b	384de74f-a63e-4738-ac7e-248512e372e1	mediterranean	2026-02-03 22:41:56.615275+00
716c2d5a-89d4-431c-8a69-daa6b98a1fca	9cdc271d-41ac-42fe-b601-fa38adfc9231	sugarFree	2026-02-03 22:43:55.31711+00
b4c9b079-0d41-4ce9-b51f-0b9bfe48a95b	9cdc271d-41ac-42fe-b601-fa38adfc9231	mediterranean	2026-02-03 22:43:55.31711+00
\.



COPY "public"."user_recipe_useful_items" ("id", "user_recipe_id", "useful_item_id", "name", "image_url", "notes", "display_order", "created_at") FROM stdin;
fdb174c9-1988-40e3-ac1b-0b765904d22f	3db03012-8af9-45f5-927a-7a68864d5d3a	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	0	2026-02-03 00:47:50.811858+00
31eec555-eab3-4914-a031-6659442582a7	3db03012-8af9-45f5-927a-7a68864d5d3a	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	1	2026-02-03 00:47:50.811858+00
75b1055d-c2e9-4995-9e82-608bf28722a9	3db03012-8af9-45f5-927a-7a68864d5d3a	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	2	2026-02-03 00:47:50.811858+00
086e3ec9-9e67-4d5f-9808-b4bf626cad14	3db03012-8af9-45f5-927a-7a68864d5d3a	\N	Spring form pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png	\N	3	2026-02-03 00:47:50.811858+00
1ad06b01-6519-43a5-838c-1cce772ca225	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	0	2026-02-03 00:48:55.940861+00
0060b0ae-a343-41f9-be51-dc0ff08aad07	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	1	2026-02-03 00:48:55.940861+00
c448ccda-4ddd-4868-bb0b-e103e3ae684a	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	Spring form pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png	\N	2	2026-02-03 00:48:55.940861+00
50f8f3ff-08a4-4f8b-8ae1-c395aeecd08c	65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	3	2026-02-03 00:48:55.940861+00
652231a8-2ffe-4e58-8767-d60f646067e6	94b56036-d308-4130-9fb0-77eccf5389cb	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	0	2026-02-03 00:57:19.480101+00
4cf87cea-e5a4-454b-a8f9-9860ea7f384c	94b56036-d308-4130-9fb0-77eccf5389cb	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	1	2026-02-03 00:57:19.480101+00
9d5ee9cc-885a-446f-9960-586b9e3564cc	94b56036-d308-4130-9fb0-77eccf5389cb	\N	Spring form pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png	\N	2	2026-02-03 00:57:19.480101+00
8a4c3a2e-7a7e-4e8c-afaa-3fc39c3797b4	94b56036-d308-4130-9fb0-77eccf5389cb	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	3	2026-02-03 00:57:19.480101+00
67b01726-06ec-486e-ae9f-8e7dc55d5c11	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	0	2026-02-03 03:10:03.772496+00
1a76868c-cda1-4d60-a99b-b3d7713737a4	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	1	2026-02-03 03:10:03.772496+00
f62ffd51-f80a-4dde-a974-79ee9fd78ee1	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	Spring form pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png	\N	2	2026-02-03 03:10:03.772496+00
fd3d1c0e-2f15-41f9-aee2-311f94f91bd5	3e8946a0-3a50-40dc-8b08-6d38a4133c83	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	3	2026-02-03 03:10:03.772496+00
c5633a0d-e3d2-4916-90b4-ad2bb5b72abd	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	0	2026-02-03 03:15:26.484987+00
8eb1095b-5d79-4393-a70c-71d08b3df6ab	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	Steak knife	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png	\N	1	2026-02-03 03:15:26.484987+00
05791b9e-d9a3-4bcc-9ed0-98c210d39786	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	2	2026-02-03 03:15:26.484987+00
1c9caa46-6e7f-4cb8-9b6e-8ba601c17bc6	41aa6f29-3d08-41a2-b638-bf84182bf920	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	3	2026-02-03 03:15:26.484987+00
3da21b20-e1a3-4b52-b2d3-d591bda85fbd	27950842-bff9-4971-9d2e-df32134edf91	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	0	2026-02-03 22:20:14.787147+00
4fef28d8-27d2-4a58-b75e-e3ac9f234326	27950842-bff9-4971-9d2e-df32134edf91	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	1	2026-02-03 22:20:14.787147+00
d6b615f0-7e12-40fa-b386-8b4ef0073865	27950842-bff9-4971-9d2e-df32134edf91	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	2	2026-02-03 22:20:14.787147+00
b87885b2-ad3f-4ec5-a6d9-8d2ba8c507ae	27950842-bff9-4971-9d2e-df32134edf91	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	3	2026-02-03 22:20:14.787147+00
3be1bfc7-b46f-4c83-ae9a-0c0b38820352	5ee2165c-67e8-4819-92e5-0978578a667d	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	0	2026-02-03 22:23:35.152702+00
95dc148f-bfc3-4768-811e-8b9d34791f31	5ee2165c-67e8-4819-92e5-0978578a667d	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	1	2026-02-03 22:23:35.152702+00
e7cbb53e-8233-4714-9c89-e6d2dba72292	5ee2165c-67e8-4819-92e5-0978578a667d	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	2	2026-02-03 22:23:35.152702+00
c8bcd4a2-d246-4da7-8c02-7ea84e89550a	5ee2165c-67e8-4819-92e5-0978578a667d	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	3	2026-02-03 22:23:35.152702+00
71c06213-800a-4c61-a0da-bae3f8e89a4e	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	0	2026-02-03 22:32:12.939375+00
0817494c-9fd4-4a64-b9e9-e2130de59144	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	1	2026-02-03 22:32:12.939375+00
4b9dba15-f416-4b84-a40f-d3b6da801d37	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	Spring form pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png	\N	2	2026-02-03 22:32:12.939375+00
462d9a9c-ccaf-4fd0-9a2f-dfe08f793023	53b2bd54-adc3-4bfc-930a-41d71b8caec7	\N	Thermometer	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png	\N	3	2026-02-03 22:32:12.939375+00
d6c574e6-b5d6-4929-a6a3-4b81d82676b5	adb24066-7049-4321-a326-90f56bf30c1a	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	0	2026-02-03 22:32:51.529511+00
cb74c8a7-0991-4bab-a6e0-9e98db732362	adb24066-7049-4321-a326-90f56bf30c1a	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	1	2026-02-03 22:32:51.529511+00
62a73504-4b66-43f2-8908-1971b06de50a	adb24066-7049-4321-a326-90f56bf30c1a	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	2	2026-02-03 22:32:51.529511+00
f7eb1807-46ec-469d-9382-ceb1c55bf45a	adb24066-7049-4321-a326-90f56bf30c1a	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	3	2026-02-03 22:32:51.529511+00
dc0a8d67-73a2-4be1-a617-232e3434f900	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	0	2026-02-03 22:40:02.858124+00
d229a87e-8e89-4d51-9792-57c9361b663c	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	1	2026-02-03 22:40:02.858124+00
c34fa9d2-f1d0-4806-b7b5-3fc80ef50df0	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	2	2026-02-03 22:40:02.858124+00
6bda957e-f402-4464-9a35-cb3cbb6c9c61	27a78119-5c3a-4e70-837e-6a69ac8d8747	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	3	2026-02-03 22:40:02.858124+00
af1d116a-a0c2-4edf-b2ec-4983436a6f92	384de74f-a63e-4738-ac7e-248512e372e1	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	0	2026-02-03 22:41:56.789926+00
f8101cee-ac49-4f2a-8575-1cd68289ac87	384de74f-a63e-4738-ac7e-248512e372e1	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	1	2026-02-03 22:41:56.789926+00
db58ab10-d44b-46d8-9a06-704285fc9f6a	384de74f-a63e-4738-ac7e-248512e372e1	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	2	2026-02-03 22:41:56.789926+00
69806181-9628-447d-bf29-3d8314b7e547	384de74f-a63e-4738-ac7e-248512e372e1	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	3	2026-02-03 22:41:56.789926+00
d6bfe62d-7cf6-4622-b07f-940bea450385	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	Bowl	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png	\N	0	2026-02-03 22:43:55.479738+00
c620a29b-b026-4e63-92cd-82e583a74c15	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	Cutting board	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png	\N	1	2026-02-03 22:43:55.479738+00
97c69298-071a-40fa-913c-e3424b08f37a	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	Frying pan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png	\N	2	2026-02-03 22:43:55.479738+00
fa3f2fc7-ffc2-4520-9185-84f52342ff5f	9cdc271d-41ac-42fe-b601-fa38adfc9231	\N	Saucepan	https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png	\N	3	2026-02-03 22:43:55.479738+00
\.



COPY "public"."user_recipes" ("id", "user_id", "original_recipe_id", "name", "description", "recipe_data", "source", "created_at", "updated_at", "total_time", "prep_time", "difficulty", "portions", "measurement_system", "language", "image_url", "schema_version") FROM stdin;
46f8151f-3666-4400-ac72-cfa141c10b03	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Spinach and Strawberry Salad with Grilled Chicken	\N	{"tags": ["salad", "Mediterranean", "healthy", "chicken"], "steps": [{"order": 1, "instruction": "Preheat the grill to medium-high heat (around 200°C)."}, {"order": 2, "instruction": "Season the grilled chicken breast with salt and pepper, then grill for 6-7 minutes on each side or until the internal temperature reaches 75°C."}, {"order": 3, "instruction": "While the chicken is grilling, wash and dry the fresh spinach and place it in a large salad bowl."}, {"order": 4, "instruction": "Slice the strawberries and add them to the spinach."}, {"order": 5, "instruction": "Chop the walnuts and sprinkle them over the salad."}, {"order": 6, "instruction": "Crumble the feta cheese on top of the salad."}, {"order": 7, "instruction": "In a small bowl, whisk together the balsamic vinegar and olive oil to create the dressing."}, {"order": 8, "instruction": "Once the chicken is grilled, let it rest for a few minutes, then slice it into strips."}, {"order": 9, "instruction": "Add the sliced grilled chicken to the salad and drizzle the dressing over the top."}, {"order": 10, "instruction": "Toss gently to combine all the ingredients and serve immediately."}], "language": "en", "portions": 4, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "fresh spinach", "unit": "grams", "quantity": 200}, {"name": "strawberries", "unit": "grams", "quantity": 150}, {"name": "walnuts", "unit": "grams", "quantity": 50}, {"name": "feta cheese", "unit": "grams", "quantity": 100}, {"name": "balsamic vinegar", "unit": "ml", "quantity": 30}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "grilled chicken breast", "unit": "grams", "quantity": 300}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Spinach and Strawberry Salad with Grilled Chicken", "measurementSystem": "metric"}	ai_generated	2026-01-31 21:37:12.36261+00	2026-01-31 21:37:12.36261+00	\N	\N	\N	4	\N	en	\N	1.0
982ffdd2-3d24-4417-b91d-987e933f3949	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Prepare the marinade by combining olive oil, lemon juice, minced garlic, salt, black pepper, and oregano in the Thermomix.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5"}, {"order": 2, "instruction": "Add the chicken breast to the marinade, mixing well to coat.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5"}, {"order": 3, "instruction": "Let the chicken marinate for 10 minutes while preparing the rice.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "1"}, {"order": 4, "instruction": "Add rice and 200 ml of water to the Thermomix and cook until done.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1"}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 180°C for about 12 minutes, flipping halfway through.", "thermomixTemp": "180°C", "thermomixTime": 720, "thermomixSpeed": "1"}, {"order": 6, "instruction": "Add asparagus to the rice in the Thermomix for the last 5 minutes of cooking.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1"}, {"order": 7, "instruction": "Once everything is cooked, fluff the rice and serve it with the chicken and asparagus.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "1"}, {"order": 8, "instruction": "Transfer to a serving plate and enjoy your Mediterranean dish!", "thermomixTemp": "0°C"}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "quantity": 200}, {"name": "rice", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "quantity": 30}, {"name": "garlic", "unit": "cloves", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "quantity": 15}, {"name": "salt", "unit": "grams", "quantity": 5}, {"name": "black pepper", "unit": "grams", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spatula_1743787718709.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 21:17:12.528416+00	2026-02-02 21:17:12.528416+00	\N	\N	\N	4	\N	en	\N	1.0
3ddfc5f2-3f93-47fb-891f-97b56032072a	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus using the Thermomix.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5"}, {"order": 2, "instruction": "Add olive oil, garlic, salt, black pepper, and dried oregano to the Thermomix and sauté for flavor.", "thermomixTemp": "100°C", "thermomixTime": 120, "thermomixSpeed": "1"}, {"order": 3, "instruction": "Add the rice and water (300 ml) to the Thermomix, then cook until rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1"}, {"order": 4, "instruction": "While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.", "thermomixTemp": "0°C"}, {"order": 5, "instruction": "Transfer the seasoned chicken to the air fryer and cook at 180°C for 12-15 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C"}, {"order": 6, "instruction": "Add asparagus to the Thermomix 5 minutes before the rice is done to steam it.", "thermomixTemp": "Varoma", "thermomixTime": 300, "thermomixSpeed": "1"}, {"order": 7, "instruction": "Once the rice and asparagus are cooked, fluff the rice and combine with asparagus.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "Spoon"}, {"order": 8, "instruction": "Serve the rice and asparagus mix on a plate topped with the air-fried chicken.", "thermomixTemp": "0°C"}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Thermomix® Varoma", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_1743787852547.png"}, {"name": "Thermomix® Varoma tray", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_tray_1743787866973.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 21:59:46.956248+00	2026-02-02 21:59:46.956248+00	\N	\N	\N	4	\N	en	\N	1.0
31e0674b-181e-414e-903a-52b4e3ca2970	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus using the Thermomix.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5"}, {"order": 2, "instruction": "Add olive oil, garlic, salt, black pepper, and dried oregano to the Thermomix and sauté for flavor.", "thermomixTemp": "100°C", "thermomixTime": 120, "thermomixSpeed": "1"}, {"order": 3, "instruction": "Add the rice and water (300 ml) to the Thermomix, then cook until rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1"}, {"order": 4, "instruction": "While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.", "thermomixTemp": "0°C"}, {"order": 5, "instruction": "Transfer the seasoned chicken to the air fryer and cook at 180°C for 12-15 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C"}, {"order": 6, "instruction": "Add asparagus to the Thermomix 5 minutes before the rice is done to steam it.", "thermomixTemp": "Varoma", "thermomixTime": 300, "thermomixSpeed": "1"}, {"order": 7, "instruction": "Once the rice and asparagus are cooked, fluff the rice and combine with asparagus.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "Spoon"}, {"order": 8, "instruction": "Serve the rice and asparagus mix on a plate topped with the air-fried chicken.", "thermomixTemp": "0°C"}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Thermomix® Varoma", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_1743787852547.png"}, {"name": "Thermomix® Varoma tray", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermomix_varoma_tray_1743787866973.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 22:00:32.803014+00	2026-02-02 22:00:32.803014+00	\N	\N	\N	4	\N	en	\N	1.0
261f8c43-6f7a-40f2-bbf6-1ae2884f2e43	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Tomatoes	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop garlic and tomatoes in the Thermomix.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "tomatoes"]}, {"order": 2, "instruction": "Add olive oil, dried oregano, salt, black pepper, and red pepper flakes to the chopped mixture and mix well.", "thermomixTemp": "0°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "dried oregano", "salt", "black pepper", "red pepper flakes"]}, {"order": 3, "instruction": "Cut chicken breast into strips and season with the tomato mixture.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Transfer the chicken to the air fryer and cook at 200°C for 15 minutes.", "thermomixTemp": "0°C", "thermomixTime": 900, "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "Let the chicken rest for a few minutes before serving.", "thermomixTemp": "0°C", "thermomixTime": 180, "ingredientsUsed": ["chicken breast"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 400}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 300}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "dried oregano", "unit": "teaspoons", "quantity": 2}, {"name": "salt", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 1}, {"name": "black pepper", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 1}, {"name": "red pepper flakes", "unit": "teaspoon", "quantity": 1}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Tomatoes", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:15:23.49845+00	2026-02-03 00:15:23.49845+00	30	\N	easy	1	metric	en	\N	2.0
6b8ada2b-f063-489a-9779-d50137ed8cd5	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Lemon Oregano Chicken with Asparagus and Rice	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Place the garlic cloves in the Thermomix bowl and chop finely.", "thermomixTime": 10, "thermomixSpeed": "7"}, {"order": 2, "instruction": "Add olive oil, lemon juice, lemon zest, salt, black pepper, and dried oregano to the bowl and mix well.", "thermomixTime": 10, "thermomixSpeed": "5"}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the bowl. Mix until the chicken is well coated.", "thermomixTime": 15, "thermomixSpeed": "5"}, {"order": 4, "instruction": "Transfer the marinated chicken to the air fryer basket. Cook at 180°C for 15 minutes.", "thermomixTemp": null, "thermomixTime": null, "thermomixSpeed": null}, {"order": 5, "instruction": "Meanwhile, rinse the rice and place it in the Thermomix bowl with 300ml of water. Cook the rice.", "thermomixTemp": "100°C", "thermomixTime": 15, "thermomixSpeed": "1"}, {"order": 6, "instruction": "After 10 minutes, add the asparagus to the air fryer with the chicken and continue cooking for another 5 minutes.", "thermomixTemp": null, "thermomixTime": null, "thermomixSpeed": null}, {"order": 7, "instruction": "Once everything is cooked, fluff the rice and serve alongside the chicken and asparagus.", "thermomixTemp": null, "thermomixTime": null, "thermomixSpeed": null}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}, {"name": "lemon zest", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/lima.png", "quantity": 1}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Lemon Oregano Chicken with Asparagus and Rice", "measurementSystem": "metric"}	ai_generated	2026-02-02 22:01:06.182194+00	2026-02-02 22:01:06.182194+00	\N	\N	\N	4	\N	en	\N	1.0
bb6e41e1-4edd-426d-a3d7-ae2fc1663847	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean", "quick"], "steps": [{"order": 1, "instruction": "Prepare the marinade by adding olive oil, lemon juice, garlic, salt, black pepper, and oregano to the Thermomix.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5"}, {"order": 2, "instruction": "Cut the chicken breast into bite-sized pieces and add them to the marinade in the Thermomix. Mix for 15 seconds.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5"}, {"order": 3, "instruction": "Let the chicken marinate for 10 minutes while preparing the rice and asparagus.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "1"}, {"order": 4, "instruction": "Rinse the rice under cold water and add it to the Thermomix with 200 ml of water. Cook for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1"}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 200°C for 10 minutes.", "thermomixTemp": "200°C", "thermomixTime": 600, "thermomixSpeed": "1"}, {"order": 6, "instruction": "Add the asparagus to the air fryer with the chicken for the last 5 minutes of cooking.", "thermomixTemp": "200°C", "thermomixTime": 300, "thermomixSpeed": "1"}, {"order": 7, "instruction": "Once everything is cooked, fluff the rice with a fork and serve it on a plate with the chicken and asparagus on top."}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "salt", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 1}, {"name": "black pepper", "unit": "teaspoon", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 1}, {"name": "dried oregano", "unit": "teaspoon", "quantity": 1}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 22:07:06.577282+00	2026-02-02 22:07:06.577282+00	\N	\N	\N	4	\N	en	\N	1.0
c6521a83-0c94-4cc8-9dce-c31603ba8fbf	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "In a bowl, mix the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to create a marinade.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chicken breast to the marinade and let it sit for a few minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Cook the rice in the Thermomix with water according to package instructions.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 200°C for about 10-12 minutes, checking for an internal temperature of 75°C.", "thermomixTemp": "200°C", "thermomixTime": 720, "ingredientsUsed": ["chicken breast"]}, {"order": 6, "instruction": "In the last 5 minutes of cooking the chicken, add the asparagus to the air fryer.", "thermomixTemp": "200°C", "thermomixTime": 300, "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once everything is cooked, serve the chicken and asparagus over the rice.", "ingredientsUsed": ["chicken breast", "asparagus", "rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 22:15:42.478771+00	2026-02-02 22:15:42.478771+00	\N	\N	\N	4	\N	en	\N	1.0
3e3c44e9-377f-4ea4-9f6c-8e2d7c3c7f15	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "In a bowl, mix the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to create a marinade.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chicken breast to the marinade and let it sit for a few minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Cook the rice in the Thermomix with water according to package instructions.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 200°C for about 10-12 minutes, checking for an internal temperature of 75°C.", "thermomixTemp": "200°C", "thermomixTime": 720, "ingredientsUsed": ["chicken breast"]}, {"order": 6, "instruction": "In the last 5 minutes of cooking the chicken, add the asparagus to the air fryer.", "thermomixTemp": "200°C", "thermomixTime": 300, "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once everything is cooked, serve the chicken and asparagus over the rice.", "ingredientsUsed": ["chicken breast", "asparagus", "rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:02:28.286909+00	2026-02-02 23:02:28.286909+00	\N	\N	\N	4	\N	en	\N	1.0
3aa067a5-7a87-4633-83a5-4361487857e1	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "In a bowl, mix the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to create a marinade.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chicken breast to the marinade and let it sit for a few minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Cook the rice in the Thermomix with water according to package instructions.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 200°C for about 10-12 minutes, checking for an internal temperature of 75°C.", "thermomixTemp": "200°C", "thermomixTime": 720, "ingredientsUsed": ["chicken breast"]}, {"order": 6, "instruction": "In the last 5 minutes of cooking the chicken, add the asparagus to the air fryer.", "thermomixTemp": "200°C", "thermomixTime": 300, "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once everything is cooked, serve the chicken and asparagus over the rice.", "ingredientsUsed": ["chicken breast", "asparagus", "rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:02:49.614341+00	2026-02-02 23:02:49.614341+00	\N	\N	\N	4	\N	en	\N	1.0
5d21e17d-bf56-4253-9d6b-7ed8b12889b0	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "In a bowl, mix the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to create a marinade.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chicken breast to the marinade and let it sit for a few minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Cook the rice in the Thermomix with water according to package instructions.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 5, "instruction": "While the rice is cooking, place the marinated chicken in the air fryer and cook at 200°C for about 10-12 minutes, checking for an internal temperature of 75°C.", "thermomixTemp": "200°C", "thermomixTime": 720, "ingredientsUsed": ["chicken breast"]}, {"order": 6, "instruction": "In the last 5 minutes of cooking the chicken, add the asparagus to the air fryer.", "thermomixTemp": "200°C", "thermomixTime": 300, "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once everything is cooked, serve the chicken and asparagus over the rice.", "ingredientsUsed": ["chicken breast", "asparagus", "rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:09:29.571126+00	2026-02-02 23:09:29.571126+00	\N	\N	\N	4	\N	en	\N	1.0
6de3ccca-f494-4bc7-b35f-f88fab8233a9	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Asparagus and Rice	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus in the Thermomix.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "Add olive oil, salt, black pepper, and lemon juice to the chopped garlic and asparagus. Mix well.", "thermomixTemp": "0°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "salt", "black pepper", "lemon juice"]}, {"order": 3, "instruction": "Add the chicken breast to the mixture in the Thermomix and marinate for 10 minutes.", "thermomixTemp": "0°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Cook the rice in the Thermomix by adding 300ml of water and cooking on speed 1 for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1", "ingredientsUsed": ["white rice"]}, {"order": 5, "instruction": "Place the marinated chicken and asparagus mixture into the air fryer and cook at 180°C for 15 minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Serve the chicken and asparagus over the cooked rice.", "ingredientsUsed": ["chicken breast", "asparagus", "white rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "white rice", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus and Rice", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:32:36.219327+00	2026-02-02 23:32:36.219327+00	30	\N	easy	1	metric	en	\N	2.0
cec7915c-4ce9-4d5f-b270-f9a83831b127	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Lemon Garlic Chicken with Quinoa and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.", "thermomixTemp": "100°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Cook the quinoa for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 3, "instruction": "While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "chicken breast", "salt", "black pepper", "lemon juice", "olive oil"]}, {"order": 4, "instruction": "Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.", "thermomixTemp": "0°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus", "olive oil", "salt", "black pepper"]}, {"order": 6, "instruction": "Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.", "thermomixTemp": "0°C", "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.", "thermomixTemp": "0°C", "ingredientsUsed": ["quinoa"]}, {"order": 8, "instruction": "Transfer to a serving plate and garnish with additional lemon juice if desired.", "ingredientsUsed": ["lemon juice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "quinoa", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Lemon Garlic Chicken with Quinoa and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:35:31.028073+00	2026-02-02 23:35:31.028073+00	30	\N	easy	1	metric	en	\N	2.0
81fb771c-78c9-4523-a14f-5052144931c2	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Lemon Garlic Chicken with Quinoa and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.", "thermomixTemp": "100°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Cook the quinoa for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 3, "instruction": "While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "chicken breast", "salt", "black pepper", "lemon juice", "olive oil"]}, {"order": 4, "instruction": "Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.", "thermomixTemp": "0°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus", "olive oil", "salt", "black pepper"]}, {"order": 6, "instruction": "Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.", "thermomixTemp": "0°C", "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.", "thermomixTemp": "0°C", "ingredientsUsed": ["quinoa"]}, {"order": 8, "instruction": "Transfer to a serving plate and garnish with additional lemon juice if desired.", "ingredientsUsed": ["lemon juice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "quinoa", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Lemon Garlic Chicken with Quinoa and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:35:49.808267+00	2026-02-02 23:35:49.808267+00	30	\N	easy	1	metric	en	\N	2.0
d7a68f62-81c1-4f67-92b5-569aab9154ea	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Lemon Garlic Chicken with Quinoa and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.", "thermomixTemp": "100°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Cook the quinoa for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 3, "instruction": "While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "chicken breast", "salt", "black pepper", "lemon juice", "olive oil"]}, {"order": 4, "instruction": "Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.", "thermomixTemp": "0°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus", "olive oil", "salt", "black pepper"]}, {"order": 6, "instruction": "Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.", "thermomixTemp": "0°C", "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.", "thermomixTemp": "0°C", "ingredientsUsed": ["quinoa"]}, {"order": 8, "instruction": "Transfer to a serving plate and garnish with additional lemon juice if desired.", "ingredientsUsed": ["lemon juice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "quinoa", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Lemon Garlic Chicken with Quinoa and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:35:57.485126+00	2026-02-02 23:35:57.485126+00	30	\N	easy	1	metric	en	\N	2.0
abed1395-ed78-4d74-a8b6-64eac10b716f	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Lemon Garlic Chicken with Quinoa and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water and add it to the Thermomix bowl with 300 ml of water.", "thermomixTemp": "100°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Cook the quinoa for 15 minutes.", "thermomixTemp": "100°C", "thermomixTime": 900, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 3, "instruction": "While the quinoa is cooking, chop the garlic and season the chicken breast with salt, black pepper, lemon juice, and half of the olive oil.", "thermomixTemp": "0°C", "thermomixTime": 30, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "chicken breast", "salt", "black pepper", "lemon juice", "olive oil"]}, {"order": 4, "instruction": "Preheat the air fryer to 180°C and cook the marinated chicken breast for 12 minutes or until the internal temperature reaches 75°C.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "While the chicken is cooking, prepare the asparagus by trimming the ends and drizzling with the remaining olive oil, salt, and pepper.", "thermomixTemp": "0°C", "thermomixTime": 60, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus", "olive oil", "salt", "black pepper"]}, {"order": 6, "instruction": "Add the asparagus to the air fryer and cook for the last 5 minutes of the chicken cooking time.", "thermomixTemp": "0°C", "ingredientsUsed": ["asparagus"]}, {"order": 7, "instruction": "Once the quinoa is cooked, fluff it with a fork and serve alongside the chicken and asparagus.", "thermomixTemp": "0°C", "ingredientsUsed": ["quinoa"]}, {"order": 8, "instruction": "Transfer to a serving plate and garnish with additional lemon juice if desired.", "ingredientsUsed": ["lemon juice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "quinoa", "unit": "grams", "quantity": 100}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Lemon Garlic Chicken with Quinoa and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-02 23:36:07.670539+00	2026-02-02 23:36:07.670539+00	30	\N	easy	1	metric	en	\N	2.0
7888f272-1358-4e75-a331-a4baffee184d	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Tomatoes	\N	{"tags": ["mediterranean", "sugarFree", "chicken"], "steps": [{"order": 1, "instruction": "Chop the garlic and tomatoes.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "tomatoes"]}, {"order": 2, "instruction": "Add olive oil, oregano, salt, and black pepper to the chopped tomatoes and garlic. Mix well.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "dried oregano", "salt", "black pepper"]}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the bowl. Stir to coat the chicken with the tomato mixture.", "thermomixTemp": "50°C", "thermomixTime": 15, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Transfer the chicken and tomato mixture to the air fryer basket and cook at 200°C for 15 minutes.", "ingredientsUsed": ["chicken breast", "tomatoes"]}, {"order": 5, "instruction": "Serve the Mediterranean chicken with tomatoes hot.", "ingredientsUsed": ["chicken breast", "tomatoes"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 300}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "dried oregano", "unit": "teaspoon", "quantity": 1}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Tomatoes", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:01:52.015685+00	2026-02-03 00:01:52.015685+00	30	\N	easy	1	metric	en	\N	2.0
d9495978-2959-40cb-b49c-de131a4eaf8e	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Meatballs with Rice	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic using the Thermomix.", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic"]}, {"order": 2, "instruction": "Combine the chopped garlic, olive oil, dried oregano, salt, black pepper, and red pepper flakes in the Thermomix to make the meatball mixture.", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "dried oregano", "salt", "black pepper", "red pepper flakes"]}, {"order": 3, "instruction": "Add the chicken breast to the mixture and blend until well combined.", "thermomixTime": 30, "thermomixSpeed": "8", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Form the mixture into meatballs and place them in the air fryer basket.", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "Cook the meatballs in the air fryer at 180°C for 10-12 minutes, or until the internal temperature reaches 75°C.", "ingredientsUsed": ["chicken breast"]}, {"order": 6, "instruction": "Cook the rice according to package instructions.", "ingredientsUsed": ["rice"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 500}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 400}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "dried oregano", "unit": "grams", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "red pepper flakes", "unit": "gram", "quantity": 1}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 200}], "usefulItems": [{"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Meatballs with Rice", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:17:08.21933+00	2026-02-03 00:17:08.21933+00	30	\N	easy	1	metric	en	\N	2.0
8e491e41-0691-4dc4-a663-c65016a36b00	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Beef and Rice	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the onion and garlic.", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["onion", "garlic"]}, {"order": 2, "instruction": "Sauté the chopped onion and garlic in olive oil until fragrant.", "thermomixTemp": "100°C", "thermomixTime": 180, "thermomixSpeed": "1", "ingredientsUsed": ["onion", "garlic", "olive oil"]}, {"order": 3, "instruction": "Add the ground beef, salt, pepper, and oregano, and cook until browned.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["ground beef", "salt", "pepper", "dried oregano"]}, {"order": 4, "instruction": "Add the chopped tomatoes and water. Cook until the mixture is heated through.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["tomatoes", "water"]}, {"order": 5, "instruction": "Add the rice and stir to combine. Cook until the rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 6, "instruction": "Let it rest for a few minutes before serving.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "ground beef", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png", "quantity": 400}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 400}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 200}, {"name": "onion", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/cebolla.png", "quantity": 100}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal_y_pimienta.png?t=2024-11-15T21%3A07%3A48.065Z", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}, {"name": "water", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png", "quantity": 400}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Beef and Rice", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:18:40.694861+00	2026-02-03 00:18:40.694861+00	30	\N	easy	1	metric	en	\N	2.0
c6acf6d5-5d0a-455c-b82b-5bfb1c410714	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Sugar-Free Chicken Ramen	\N	{"tags": ["sugarFree", "asian", "easy"], "steps": [{"order": 1, "instruction": "Chop the chicken into bite-sized pieces.", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["chicken breast"]}, {"order": 2, "instruction": "Sauté the chopped chicken until lightly browned.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 3, "instruction": "Add the mixed vegetables and sauté for an additional 2 minutes.", "thermomixTemp": "100°C", "thermomixTime": 120, "thermomixSpeed": "1", "ingredientsUsed": ["mixed vegetables"]}, {"order": 4, "instruction": "Pour in the broth and soy sauce, then bring to a boil.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["broth", "soy sauce"]}, {"order": 5, "instruction": "Add the ramen noodles and cook until tender.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["ramen noodles"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "ramen noodles", "unit": "grams", "quantity": 100}, {"name": "mixed vegetables", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/surtido_de_nueces_1743207250295.png", "quantity": 200}, {"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "broth", "unit": "liter", "quantity": 1}, {"name": "soy sauce", "unit": "ml", "quantity": 30}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Sugar-Free Chicken Ramen", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:26:07.196948+00	2026-02-03 00:26:07.196948+00	30	\N	easy	1	metric	en	\N	2.0
349f970a-8e3a-4051-b3aa-d335c517e26e	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Sugar-Free Chicken Ramen	\N	{"tags": ["sugarFree", "asian", "easy"], "steps": [{"order": 1, "instruction": "Chop the chicken into bite-sized pieces.", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["chicken breast"]}, {"order": 2, "instruction": "Sauté the chopped chicken until lightly browned.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast"]}, {"order": 3, "instruction": "Add the mixed vegetables and sauté for an additional 2 minutes.", "thermomixTemp": "100°C", "thermomixTime": 120, "thermomixSpeed": "1", "ingredientsUsed": ["mixed vegetables"]}, {"order": 4, "instruction": "Pour in the broth and soy sauce, then bring to a boil.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["broth", "soy sauce"]}, {"order": 5, "instruction": "Add the ramen noodles and cook until tender.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["ramen noodles"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "ramen noodles", "unit": "grams", "quantity": 100}, {"name": "mixed vegetables", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/surtido_de_nueces_1743207250295.png", "quantity": 200}, {"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "broth", "unit": "liter", "quantity": 1}, {"name": "soy sauce", "unit": "ml", "quantity": 30}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Tart pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/tart_pan_1743787765790.png"}], "schemaVersion": "1.0", "suggestedName": "Sugar-Free Chicken Ramen", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:28:00.947506+00	2026-02-03 00:28:00.947506+00	30	\N	easy	1	metric	en	\N	2.0
356a7dc6-2b8f-4989-8abd-96690d43819e	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Asian Beef and Broccoli Stir-Fry	\N	{"tags": ["sugarFree", "mediterranean", "beef", "broccoli"], "steps": [{"order": 1, "instruction": "Slice the beef into thin strips.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["beef"]}, {"order": 2, "instruction": "Chop the garlic and ginger.", "thermomixTemp": "Varoma", "thermomixTime": 5, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "ginger"]}, {"order": 3, "instruction": "Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "soy sauce", "sesame oil", "cornstarch", "water"]}, {"order": 4, "instruction": "Add the broccoli florets to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 5, "thermomixSpeed": "1", "ingredientsUsed": ["broccoli"]}, {"order": 5, "instruction": "Cook until the beef is tender and the broccoli is cooked but still crisp.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "broccoli"]}, {"order": 6, "instruction": "Transfer to a serving plate and serve hot.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 25, "difficulty": "easy", "ingredients": [{"name": "beef", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png", "quantity": 300}, {"name": "broccoli", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png", "quantity": 200}, {"name": "soy sauce", "unit": "ml", "quantity": 50}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "sesame oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png", "quantity": 15}, {"name": "cornstarch", "unit": "grams", "quantity": 10}, {"name": "water", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png", "quantity": 100}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Asian Beef and Broccoli Stir-Fry", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:29:17.142207+00	2026-02-03 00:29:17.142207+00	25	\N	easy	1	metric	en	\N	2.0
9d9ffeac-79ad-4628-8827-5a2ae56dd68a	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Asian Beef and Broccoli Stir-Fry	\N	{"tags": ["sugarFree", "mediterranean", "beef", "broccoli"], "steps": [{"order": 1, "instruction": "Slice the beef into thin strips.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["beef"]}, {"order": 2, "instruction": "Chop the garlic and ginger.", "thermomixTemp": "Varoma", "thermomixTime": 5, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "ginger"]}, {"order": 3, "instruction": "Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "soy sauce", "sesame oil", "cornstarch", "water"]}, {"order": 4, "instruction": "Add the broccoli florets to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 5, "thermomixSpeed": "1", "ingredientsUsed": ["broccoli"]}, {"order": 5, "instruction": "Cook until the beef is tender and the broccoli is cooked but still crisp.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "broccoli"]}, {"order": 6, "instruction": "Transfer to a serving plate and serve hot.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 25, "difficulty": "easy", "ingredients": [{"name": "beef", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png", "quantity": 300}, {"name": "broccoli", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png", "quantity": 200}, {"name": "soy sauce", "unit": "ml", "quantity": 50}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "sesame oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png", "quantity": 15}, {"name": "cornstarch", "unit": "grams", "quantity": 10}, {"name": "water", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png", "quantity": 100}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Asian Beef and Broccoli Stir-Fry", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:37:09.951379+00	2026-02-03 00:37:09.951379+00	25	\N	easy	1	metric	en	\N	2.0
213e4f48-bc2a-4ccf-88d5-ad0b455274b5	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Asian Beef and Broccoli Stir-Fry	\N	{"tags": ["sugarFree", "mediterranean", "beef", "broccoli"], "steps": [{"order": 1, "instruction": "Slice the beef into thin strips.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["beef"]}, {"order": 2, "instruction": "Chop the garlic and ginger.", "thermomixTemp": "Varoma", "thermomixTime": 5, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "ginger"]}, {"order": 3, "instruction": "Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "soy sauce", "sesame oil", "cornstarch", "water"]}, {"order": 4, "instruction": "Add the broccoli florets to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 5, "thermomixSpeed": "1", "ingredientsUsed": ["broccoli"]}, {"order": 5, "instruction": "Cook until the beef is tender and the broccoli is cooked but still crisp.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "broccoli"]}, {"order": 6, "instruction": "Transfer to a serving plate and serve hot.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 25, "difficulty": "easy", "ingredients": [{"name": "beef", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png", "quantity": 300}, {"name": "broccoli", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png", "quantity": 200}, {"name": "soy sauce", "unit": "ml", "quantity": 50}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "sesame oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png", "quantity": 15}, {"name": "cornstarch", "unit": "grams", "quantity": 10}, {"name": "water", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png", "quantity": 100}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Asian Beef and Broccoli Stir-Fry", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:39:09.032385+00	2026-02-03 00:39:09.032385+00	25	\N	easy	1	metric	en	\N	2.0
2c0cf733-0852-4340-ae48-0b19429b320d	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Asian Beef and Broccoli Stir-Fry	\N	{"tags": ["sugarFree", "mediterranean", "beef", "broccoli"], "steps": [{"order": 1, "instruction": "Slice the beef into thin strips.", "thermomixTemp": "Varoma", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["beef"]}, {"order": 2, "instruction": "Chop the garlic and ginger.", "thermomixTemp": "Varoma", "thermomixTime": 5, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "ginger"]}, {"order": 3, "instruction": "Add the beef, soy sauce, sesame oil, cornstarch, and water to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "soy sauce", "sesame oil", "cornstarch", "water"]}, {"order": 4, "instruction": "Add the broccoli florets to the mixing bowl.", "thermomixTemp": "100°C", "thermomixTime": 5, "thermomixSpeed": "1", "ingredientsUsed": ["broccoli"]}, {"order": 5, "instruction": "Cook until the beef is tender and the broccoli is cooked but still crisp.", "thermomixTemp": "100°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["beef", "broccoli"]}, {"order": 6, "instruction": "Transfer to a serving plate and serve hot.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 25, "difficulty": "easy", "ingredients": [{"name": "beef", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/carne_molida_1742412039578.png", "quantity": 300}, {"name": "broccoli", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/brocoli_1743008134186.png", "quantity": 200}, {"name": "soy sauce", "unit": "ml", "quantity": 50}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "ginger", "unit": "grams", "quantity": 10}, {"name": "sesame oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajonjoli_1768200930541.png", "quantity": 15}, {"name": "cornstarch", "unit": "grams", "quantity": 10}, {"name": "water", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/agua.png", "quantity": 100}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Offset spatula", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/offset_spatula_1743787502325.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Asian Beef and Broccoli Stir-Fry", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:39:50.61747+00	2026-02-03 00:39:50.61747+00	25	\N	easy	1	metric	en	\N	2.0
3db03012-8af9-45f5-927a-7a68864d5d3a	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Mushroom and Tomato Sauté	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the mushrooms and tomatoes into small pieces.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["mushrooms", "tomatoes"]}, {"order": 2, "instruction": "Sauté the chopped mushrooms and tomatoes until tender.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["mushrooms", "tomatoes"]}], "language": "en", "portions": 1, "totalTime": 15, "difficulty": "easy", "ingredients": [{"name": "mushrooms", "unit": "grams", "quantity": 200}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 150}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Mushroom and Tomato Sauté", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:47:49.980205+00	2026-02-03 00:47:49.980205+00	15	\N	easy	1	metric	en	\N	2.0
65ff0172-eefa-4e5f-a071-5b70fe4b2a1f	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Mushrooms and Tomatoes	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the mushrooms and tomatoes into small pieces.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["mushrooms", "tomatoes"]}, {"order": 2, "instruction": "Chop the garlic.", "thermomixTemp": "0°C", "thermomixTime": 5, "thermomixSpeed": "5", "ingredientsUsed": ["garlic"]}, {"order": 3, "instruction": "Add olive oil, garlic, mushrooms, and tomatoes to the Thermomix and sauté until fragrant.", "thermomixTemp": "100°C", "thermomixTime": 180, "thermomixSpeed": "1", "ingredientsUsed": ["olive oil", "garlic", "mushrooms", "tomatoes"]}, {"order": 4, "instruction": "Season the chicken breast with salt and pepper, then add to the Thermomix.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["chicken breast", "salt", "pepper"]}, {"order": 5, "instruction": "Transfer the mixture to the air fryer and cook at 180°C for 5 minutes.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "mushrooms", "tomatoes"]}, {"order": 6, "instruction": "Garnish with fresh basil before serving.", "thermomixTemp": "0°C", "ingredientsUsed": ["fresh basil"]}], "language": "en", "portions": 1, "totalTime": 15, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "mushrooms", "unit": "grams", "quantity": 150}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 100}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "clove", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 1}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 2}, {"name": "pepper", "unit": "gram", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal_y_pimienta.png?t=2024-11-15T21%3A07%3A48.065Z", "quantity": 1}, {"name": "fresh basil", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/espinca.png", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Mushrooms and Tomatoes", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:48:55.279447+00	2026-02-03 00:48:55.279447+00	15	\N	easy	1	metric	en	\N	2.0
94b56036-d308-4130-9fb0-77eccf5389cb	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and tomatoes.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "tomatoes"]}, {"order": 2, "instruction": "Sauté the garlic and tomatoes in olive oil until fragrant.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["garlic", "tomatoes", "olive oil"]}, {"order": 3, "instruction": "Add the rice, salt, black pepper, and 300 ml of water, then cook until rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice", "salt", "black pepper"]}, {"order": 4, "instruction": "While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.", "ingredientsUsed": ["chicken breast", "lemon juice", "salt", "black pepper"]}, {"order": 5, "instruction": "Place the seasoned chicken breast and asparagus in the air fryer and cook until the chicken reaches 75°C and asparagus is tender.", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Once the rice is cooked, fluff it with a fork and serve with the chicken and asparagus.", "ingredientsUsed": ["rice", "chicken breast", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 250}, {"name": "asparagus", "unit": "grams", "quantity": 100}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 00:57:18.772069+00	2026-02-03 00:57:18.772069+00	40	\N	easy	1	metric	en	\N	2.0
3e8946a0-3a50-40dc-8b08-6d38a4133c83	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Rice and Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and tomatoes.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic", "tomatoes"]}, {"order": 2, "instruction": "Sauté the garlic and tomatoes in olive oil until fragrant.", "thermomixTemp": "100°C", "thermomixTime": 300, "thermomixSpeed": "1", "ingredientsUsed": ["garlic", "tomatoes", "olive oil"]}, {"order": 3, "instruction": "Add the rice, salt, black pepper, and 300 ml of water, then cook until rice is tender.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["rice", "salt", "black pepper"]}, {"order": 4, "instruction": "While the rice is cooking, season the chicken breast with lemon juice, salt, and pepper.", "ingredientsUsed": ["chicken breast", "lemon juice", "salt", "black pepper"]}, {"order": 5, "instruction": "Place the seasoned chicken breast and asparagus in the air fryer and cook until the chicken reaches 75°C and asparagus is tender.", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Once the rice is cooked, fluff it with a fork and serve with the chicken and asparagus.", "ingredientsUsed": ["rice", "chicken breast", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 150}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 250}, {"name": "asparagus", "unit": "grams", "quantity": 100}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Rice and Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 03:10:03.053253+00	2026-02-03 03:10:03.053253+00	40	\N	easy	1	metric	en	\N	2.0
41aa6f29-3d08-41a2-b638-bf84182bf920	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Zucchini and Rice	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and zucchini into small pieces.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "zucchini"]}, {"order": 2, "instruction": "Add the olive oil, salt, black pepper, and lemon juice to the chopped zucchini and garlic, and mix well.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "salt", "black pepper", "lemon juice"]}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the mixture.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Transfer the chicken and zucchini mixture to the air fryer and cook at 180°C for 15 minutes, shaking halfway through.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "zucchini"]}, {"order": 5, "instruction": "Meanwhile, rinse the rice and add it to the Thermomix with 400 ml of water. Cook the rice.", "thermomixTemp": "100°C", "thermomixTime": 15, "thermomixSpeed": "1", "ingredientsUsed": ["rice"]}, {"order": 6, "instruction": "Once the chicken is cooked, combine it with the cooked rice and diced tomatoes.", "thermomixTemp": "100°C", "thermomixTime": 20, "thermomixSpeed": "1", "ingredientsUsed": ["tomatoes"]}, {"order": 7, "instruction": "Serve the chicken and rice mixture hot.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 40, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 500}, {"name": "rice", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/arroz.png", "quantity": 200}, {"name": "tomatoes", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jitomate_guaje.png", "quantity": 300}, {"name": "zucchini", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/calabacita.png", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}], "usefulItems": [{"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Steak knife", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/steak_knife_1743787739356.png"}, {"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Zucchini and Rice", "measurementSystem": "metric"}	ai_generated	2026-02-03 03:15:25.724524+00	2026-02-03 03:15:25.724524+00	40	\N	easy	1	metric	en	\N	2.0
27950842-bff9-4971-9d2e-df32134edf91	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic cloves into small pieces.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic"]}, {"order": 2, "instruction": "In a bowl, combine the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to make a marinade.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the marinade. Allow to marinate for at least 10 minutes.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "Spoon", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Trim the ends of the asparagus and add them to the Thermomix bowl with the marinated chicken.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus"]}, {"order": 5, "instruction": "Transfer the chicken and asparagus mixture to the air fryer basket.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Air fry at 200°C for 15 minutes, shaking halfway through for even cooking.", "thermomixTemp": "0°C", "thermomixTime": 900, "ingredientsUsed": []}, {"order": 7, "instruction": "Serve hot and enjoy your Mediterranean chicken with asparagus.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 250}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 2}, {"name": "black pepper", "unit": "gram", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 1}, {"name": "dried oregano", "unit": "grams", "quantity": 2}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 22:20:13.877199+00	2026-02-03 22:20:13.877199+00	30	\N	easy	1	metric	en	\N	1.0
5ee2165c-67e8-4819-92e5-0978578a667d	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic cloves into small pieces.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "7", "ingredientsUsed": ["garlic"]}, {"order": 2, "instruction": "In a bowl, combine the chopped garlic, olive oil, lemon juice, salt, black pepper, and dried oregano to make a marinade.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Cut the chicken breast into bite-sized pieces and add to the marinade. Allow to marinate for at least 10 minutes.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "Spoon", "ingredientsUsed": ["chicken breast"]}, {"order": 4, "instruction": "Trim the ends of the asparagus and add them to the Thermomix bowl with the marinated chicken.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus"]}, {"order": 5, "instruction": "Transfer the chicken and asparagus mixture to the air fryer basket.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Air fry at 200°C for 15 minutes, shaking halfway through for even cooking.", "thermomixTemp": "0°C", "thermomixTime": 900, "ingredientsUsed": []}, {"order": 7, "instruction": "Serve hot and enjoy your Mediterranean chicken with asparagus.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 250}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 15}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 2}, {"name": "black pepper", "unit": "gram", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 1}, {"name": "dried oregano", "unit": "grams", "quantity": 2}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 22:23:34.131844+00	2026-02-03 22:23:34.131844+00	30	\N	easy	1	metric	en	\N	1.0
53b2bd54-adc3-4bfc-930a-41d71b8caec7	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and season the chicken with olive oil, lemon juice, salt, black pepper, and dried oregano.", "thermomixTemp": "50°C", "thermomixTime": 30, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "chicken breast", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 2, "instruction": "Add the asparagus to the Thermomix bowl.", "thermomixTemp": "100°C", "thermomixTime": 10, "thermomixSpeed": "1", "ingredientsUsed": ["asparagus"]}, {"order": 3, "instruction": "Transfer the chicken and asparagus mixture to the air fryer basket.", "thermomixTemp": "0°C", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 4, "instruction": "Air fry at 180°C for about 15 minutes or until the chicken is cooked through (internal temperature should reach 75°C).", "thermomixTemp": "0°C", "thermomixTime": 900, "ingredientsUsed": ["chicken breast", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 300}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 15}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}, {"name": "Spring form pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/spring_form_pan_1743787728690.png"}, {"name": "Thermometer", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/thermometer_1743787811972.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 22:32:11.526767+00	2026-02-03 22:32:11.526767+00	30	\N	easy	1	metric	en	\N	1.0
adb24066-7049-4321-a326-90f56bf30c1a	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Tofu with Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Press the tofu to remove excess moisture and cut it into cubes.", "ingredientsUsed": ["tofu"]}, {"order": 2, "instruction": "Chop the garlic.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic"]}, {"order": 3, "instruction": "In the Thermomix, combine olive oil, lemon juice, salt, black pepper, dried oregano, and the chopped garlic. Mix well.", "thermomixTemp": "50°C", "thermomixTime": 20, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano", "garlic"]}, {"order": 4, "instruction": "Add the tofu cubes to the mixture and marinate for 10 minutes.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["tofu"]}, {"order": 5, "instruction": "Prepare the asparagus by trimming the ends.", "ingredientsUsed": ["asparagus"]}, {"order": 6, "instruction": "In the air fryer, add the marinated tofu and asparagus. Cook at 200°C for 15 minutes.", "ingredientsUsed": ["tofu", "asparagus"]}, {"order": 7, "instruction": "Serve the tofu and asparagus warm.", "ingredientsUsed": ["tofu", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "tofu", "unit": "grams", "quantity": 300}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Tofu with Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 22:32:50.744143+00	2026-02-03 22:32:50.744143+00	30	\N	easy	1	metric	en	\N	1.0
27a78119-5c3a-4e70-837e-6a69ac8d8747	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Tofu with Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Press the tofu to remove excess moisture and cut it into cubes.", "ingredientsUsed": ["tofu"]}, {"order": 2, "instruction": "Chop the garlic.", "thermomixTemp": "50°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic"]}, {"order": 3, "instruction": "In the Thermomix, combine olive oil, lemon juice, salt, black pepper, dried oregano, and the chopped garlic. Mix well.", "thermomixTemp": "50°C", "thermomixTime": 20, "thermomixSpeed": "5", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano", "garlic"]}, {"order": 4, "instruction": "Add the tofu cubes to the mixture and marinate for 10 minutes.", "thermomixTemp": "50°C", "thermomixTime": 600, "thermomixSpeed": "1", "ingredientsUsed": ["tofu"]}, {"order": 5, "instruction": "Prepare the asparagus by trimming the ends.", "ingredientsUsed": ["asparagus"]}, {"order": 6, "instruction": "In the air fryer, add the marinated tofu and asparagus. Cook at 200°C for 15 minutes.", "ingredientsUsed": ["tofu", "asparagus"]}, {"order": 7, "instruction": "Serve the tofu and asparagus warm.", "ingredientsUsed": ["tofu", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 30, "difficulty": "easy", "ingredients": [{"name": "tofu", "unit": "grams", "quantity": 300}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 3}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 20}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Tofu with Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 22:40:01.986255+00	2026-02-03 22:40:01.986255+00	30	\N	easy	1	metric	en	\N	1.0
384de74f-a63e-4738-ac7e-248512e372e1	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Chicken with Asparagus	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "5°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 2, "instruction": "In a bowl, combine olive oil, lemon juice, salt, black pepper, and dried oregano.", "ingredientsUsed": ["olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 3, "instruction": "Add the chopped garlic and asparagus to the bowl and mix well.", "thermomixTemp": "5°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 4, "instruction": "Cut the chicken breast into bite-sized pieces and add to the bowl, mixing to coat.", "thermomixTemp": "5°C", "thermomixTime": 15, "thermomixSpeed": "5", "ingredientsUsed": ["chicken breast"]}, {"order": 5, "instruction": "Transfer the chicken and asparagus mixture to the air fryer basket.", "ingredientsUsed": ["chicken breast", "asparagus"]}, {"order": 6, "instruction": "Cook in the air fryer at 180°C for 15 minutes or until the chicken reaches an internal temperature of 75°C.", "thermomixTemp": "180°C", "thermomixTime": 900, "thermomixSpeed": "Spoon", "ingredientsUsed": ["chicken breast"]}, {"order": 7, "instruction": "Serve hot and enjoy your Mediterranean chicken with asparagus.", "ingredientsUsed": []}], "language": "en", "portions": 1, "totalTime": 45, "difficulty": "easy", "ingredients": [{"name": "chicken breast", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pechuga_de_pollo.png", "quantity": 200}, {"name": "asparagus", "unit": "grams", "quantity": 150}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 20}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 10}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Chicken with Asparagus", "measurementSystem": "metric"}	ai_generated	2026-02-03 22:41:55.949511+00	2026-02-03 22:41:55.949511+00	45	\N	easy	1	metric	en	\N	1.0
9cdc271d-41ac-42fe-b601-fa38adfc9231	41fda130-9e9e-40f0-af95-679db75ebcd0	\N	Mediterranean Tofu Quinoa Bowl	\N	{"tags": ["sugarFree", "mediterranean"], "steps": [{"order": 1, "instruction": "Rinse the quinoa under cold water.", "ingredientsUsed": ["quinoa"]}, {"order": 2, "instruction": "Add quinoa and 300 ml of water to the Thermomix bowl. Cook until quinoa is fluffy.", "thermomixTemp": "100°C", "thermomixTime": 1200, "thermomixSpeed": "1", "ingredientsUsed": ["quinoa"]}, {"order": 3, "instruction": "Chop the garlic and asparagus.", "thermomixTemp": "0°C", "thermomixTime": 10, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus"]}, {"order": 4, "instruction": "In a bowl, combine chopped garlic, asparagus, olive oil, lemon juice, salt, black pepper, and dried oregano. Mix well.", "thermomixTemp": "0°C", "thermomixTime": 60, "thermomixSpeed": "5", "ingredientsUsed": ["garlic", "asparagus", "olive oil", "lemon juice", "salt", "black pepper", "dried oregano"]}, {"order": 5, "instruction": "Cut tofu into cubes and add to the bowl with the marinade. Mix gently to coat.", "thermomixTemp": "0°C", "thermomixTime": 20, "thermomixSpeed": "Spoon", "ingredientsUsed": ["tofu"]}, {"order": 6, "instruction": "Transfer marinated tofu and asparagus mixture to the air fryer and cook at 200°C for 15 minutes.", "ingredientsUsed": ["tofu", "asparagus"]}, {"order": 7, "instruction": "Fluff the cooked quinoa with a fork.", "ingredientsUsed": ["quinoa"]}, {"order": 8, "instruction": "Serve the quinoa topped with the roasted tofu and asparagus mix.", "ingredientsUsed": ["quinoa", "tofu", "asparagus"]}], "language": "en", "portions": 1, "totalTime": 45, "difficulty": "easy", "ingredients": [{"name": "tofu", "unit": "grams", "quantity": 300}, {"name": "asparagus", "unit": "grams", "quantity": 200}, {"name": "olive oil", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/aceite_de_oliva.png", "quantity": 30}, {"name": "garlic", "unit": "cloves", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/ajo.png", "quantity": 2}, {"name": "lemon juice", "unit": "ml", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/jugo_de_lima.png", "quantity": 30}, {"name": "salt", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/sal.png", "quantity": 5}, {"name": "black pepper", "unit": "grams", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/ingredients/images/pimienta_negra.png", "quantity": 2}, {"name": "dried oregano", "unit": "grams", "quantity": 5}, {"name": "quinoa", "unit": "grams", "quantity": 150}], "usefulItems": [{"name": "Bowl", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/bowl_1743786984444.png"}, {"name": "Cutting board", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/cutting_board_1743787224975.png"}, {"name": "Frying pan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/frying_pan_1743787266244.png"}, {"name": "Saucepan", "imageUrl": "https://zozskiqxdphmkuniahac.supabase.co/storage/v1/object/public/useful-items/images/saucepan_1743787685673.png"}], "schemaVersion": "1.0", "suggestedName": "Mediterranean Tofu Quinoa Bowl", "measurementSystem": "metric"}	ai_generated	2026-02-03 22:43:54.633611+00	2026-02-03 22:43:54.633611+00	45	\N	easy	1	metric	en	\N	1.0
\.



ALTER TABLE ONLY "public"."ai_voice_sessions"
    ADD CONSTRAINT "ai_voice_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_voice_usage"
    ADD CONSTRAINT "ai_voice_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_voice_usage"
    ADD CONSTRAINT "ai_voice_usage_user_id_month_key" UNIQUE ("user_id", "month");



ALTER TABLE ONLY "public"."allergen_groups"
    ADD CONSTRAINT "allergen_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_units"
    ADD CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_display_order_key" UNIQUE ("recipe_id", "display_order");



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_recipe_step_id_ingredient_id_key" UNIQUE ("recipe_step_id", "ingredient_id");



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_step_id_display_order_key" UNIQUE ("recipe_step_id", "display_order");



ALTER TABLE ONLY "public"."recipe_steps"
    ADD CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_steps"
    ADD CONSTRAINT "recipe_steps_recipe_id_order_number_key" UNIQUE ("recipe_id", "order");



ALTER TABLE ONLY "public"."recipe_tags"
    ADD CONSTRAINT "recipe_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_to_tag"
    ADD CONSTRAINT "recipe_to_tag_pkey" PRIMARY KEY ("recipe_id", "tag_id");



ALTER TABLE ONLY "public"."recipe_useful_items"
    ADD CONSTRAINT "recipe_useful_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_useful_items"
    ADD CONSTRAINT "recipe_useful_items_recipe_id_display_order_key" UNIQUE ("recipe_id", "display_order");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."useful_items"
    ADD CONSTRAINT "useful_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_chat_messages"
    ADD CONSTRAINT "user_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_chat_sessions"
    ADD CONSTRAINT "user_chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipe_ingredients"
    ADD CONSTRAINT "user_recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipe_ingredients"
    ADD CONSTRAINT "user_recipe_ingredients_user_recipe_id_display_order_key" UNIQUE ("user_recipe_id", "display_order");



ALTER TABLE ONLY "public"."user_recipe_step_ingredients"
    ADD CONSTRAINT "user_recipe_step_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipe_steps"
    ADD CONSTRAINT "user_recipe_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipe_steps"
    ADD CONSTRAINT "user_recipe_steps_user_recipe_id_step_order_key" UNIQUE ("user_recipe_id", "step_order");



ALTER TABLE ONLY "public"."user_recipe_tags"
    ADD CONSTRAINT "user_recipe_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipe_tags"
    ADD CONSTRAINT "user_recipe_tags_user_recipe_id_tag_name_key" UNIQUE ("user_recipe_id", "tag_name");



ALTER TABLE ONLY "public"."user_recipe_useful_items"
    ADD CONSTRAINT "user_recipe_useful_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_voice_sessions_user_id" ON "public"."ai_voice_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_allergen_groups_category" ON "public"."allergen_groups" USING "btree" ("category");



CREATE INDEX "idx_chat_messages_session" ON "public"."user_chat_messages" USING "btree" ("session_id", "created_at");



CREATE UNIQUE INDEX "idx_ingredients_name_en_unique" ON "public"."ingredients" USING "btree" ("lower"("name_en")) WHERE ("name_en" IS NOT NULL);



CREATE UNIQUE INDEX "idx_ingredients_name_es_unique" ON "public"."ingredients" USING "btree" ("lower"("name_es")) WHERE ("name_es" IS NOT NULL);



CREATE INDEX "idx_recipe_ingredients_ingredient_id" ON "public"."recipe_ingredients" USING "btree" ("ingredient_id");



CREATE INDEX "idx_recipe_ingredients_measurement_unit_id" ON "public"."recipe_ingredients" USING "btree" ("measurement_unit_id");



CREATE INDEX "idx_recipe_ingredients_recipe_id" ON "public"."recipe_ingredients" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipe_step_ingredients_ingredient_id" ON "public"."recipe_step_ingredients" USING "btree" ("ingredient_id");



CREATE INDEX "idx_recipe_step_ingredients_measurement_unit_id" ON "public"."recipe_step_ingredients" USING "btree" ("measurement_unit_id");



CREATE UNIQUE INDEX "idx_recipe_tags_name_en_unique" ON "public"."recipe_tags" USING "btree" ("lower"("name_en")) WHERE ("name_en" IS NOT NULL);



CREATE UNIQUE INDEX "idx_recipe_tags_name_es_unique" ON "public"."recipe_tags" USING "btree" ("lower"("name_es")) WHERE ("name_es" IS NOT NULL);



CREATE INDEX "idx_recipe_to_tag_tag_id" ON "public"."recipe_to_tag" USING "btree" ("tag_id");



CREATE INDEX "idx_recipe_useful_items_useful_item_id" ON "public"."recipe_useful_items" USING "btree" ("useful_item_id");



CREATE INDEX "idx_recipes_is_published" ON "public"."recipes" USING "btree" ("is_published") WHERE ("is_published" = true);



CREATE INDEX "idx_recipes_search" ON "public"."recipes" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("name_en", ''::"text") || ' '::"text") || COALESCE("name_es", ''::"text"))));



CREATE UNIQUE INDEX "idx_useful_items_name_en_unique" ON "public"."useful_items" USING "btree" ("lower"("name_en")) WHERE ("name_en" IS NOT NULL);



CREATE UNIQUE INDEX "idx_useful_items_name_es_unique" ON "public"."useful_items" USING "btree" ("lower"("name_es")) WHERE ("name_es" IS NOT NULL);



CREATE INDEX "idx_user_chat_sessions_user_id" ON "public"."user_chat_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_user_events_user_created" ON "public"."user_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_profiles_kitchen_equipment" ON "public"."user_profiles" USING "gin" ("kitchen_equipment");



CREATE INDEX "idx_user_recipe_ingredients_ingredient" ON "public"."user_recipe_ingredients" USING "btree" ("ingredient_id") WHERE ("ingredient_id" IS NOT NULL);



CREATE INDEX "idx_user_recipe_ingredients_measurement_unit_id" ON "public"."user_recipe_ingredients" USING "btree" ("measurement_unit_id");



CREATE INDEX "idx_user_recipe_ingredients_recipe" ON "public"."user_recipe_ingredients" USING "btree" ("user_recipe_id");



CREATE INDEX "idx_user_recipe_step_ingredients_ingredient" ON "public"."user_recipe_step_ingredients" USING "btree" ("user_recipe_ingredient_id");



CREATE INDEX "idx_user_recipe_step_ingredients_step" ON "public"."user_recipe_step_ingredients" USING "btree" ("user_recipe_step_id");



CREATE INDEX "idx_user_recipe_steps_recipe" ON "public"."user_recipe_steps" USING "btree" ("user_recipe_id");



CREATE INDEX "idx_user_recipe_tags_recipe" ON "public"."user_recipe_tags" USING "btree" ("user_recipe_id");



CREATE INDEX "idx_user_recipe_useful_items_recipe" ON "public"."user_recipe_useful_items" USING "btree" ("user_recipe_id");



CREATE INDEX "idx_user_recipe_useful_items_useful_item_id" ON "public"."user_recipe_useful_items" USING "btree" ("useful_item_id");



CREATE INDEX "idx_user_recipes_original_recipe_id" ON "public"."user_recipes" USING "btree" ("original_recipe_id");



CREATE INDEX "idx_user_recipes_user" ON "public"."user_recipes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "recipe_step_ingredients_step_id_idx" ON "public"."recipe_step_ingredients" USING "btree" ("recipe_step_id");



CREATE INDEX "recipe_steps_recipe_id_idx" ON "public"."recipe_steps" USING "btree" ("recipe_id");



CREATE INDEX "recipe_useful_items_recipe_id_idx" ON "public"."recipe_useful_items" USING "btree" ("recipe_id");



CREATE OR REPLACE TRIGGER "ai_voice_session_completed" AFTER UPDATE ON "public"."ai_voice_sessions" FOR EACH ROW WHEN ((("old"."status" <> 'completed'::"text") AND ("new"."status" = 'completed'::"text"))) EXECUTE FUNCTION "public"."update_ai_voice_usage"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."measurement_units" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."recipe_step_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."recipe_steps" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."recipe_tags" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."recipe_to_tag" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."recipe_useful_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."recipes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."useful_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_chat_sessions_updated_at" BEFORE UPDATE ON "public"."user_chat_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_recipe_ingredients_updated_at" BEFORE UPDATE ON "public"."user_recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_recipe_steps_updated_at" BEFORE UPDATE ON "public"."user_recipe_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_recipes_updated_at" BEFORE UPDATE ON "public"."user_recipes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ai_voice_sessions"
    ADD CONSTRAINT "ai_voice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_voice_usage"
    ADD CONSTRAINT "ai_voice_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_measurement_unit_id_fkey" FOREIGN KEY ("measurement_unit_id") REFERENCES "public"."measurement_units"("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_measurement_unit_id_fkey" FOREIGN KEY ("measurement_unit_id") REFERENCES "public"."measurement_units"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_recipe_step_id_fkey" FOREIGN KEY ("recipe_step_id") REFERENCES "public"."recipe_steps"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_steps"
    ADD CONSTRAINT "recipe_steps_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_to_tag"
    ADD CONSTRAINT "recipe_to_tag_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_to_tag"
    ADD CONSTRAINT "recipe_to_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."recipe_tags"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_useful_items"
    ADD CONSTRAINT "recipe_useful_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_useful_items"
    ADD CONSTRAINT "recipe_useful_items_useful_item_id_fkey" FOREIGN KEY ("useful_item_id") REFERENCES "public"."useful_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_chat_messages"
    ADD CONSTRAINT "user_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."user_chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_chat_sessions"
    ADD CONSTRAINT "user_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_ingredients"
    ADD CONSTRAINT "user_recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "public"."user_recipe_ingredients"
    ADD CONSTRAINT "user_recipe_ingredients_measurement_unit_id_fkey" FOREIGN KEY ("measurement_unit_id") REFERENCES "public"."measurement_units"("id");



ALTER TABLE ONLY "public"."user_recipe_ingredients"
    ADD CONSTRAINT "user_recipe_ingredients_user_recipe_id_fkey" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_step_ingredients"
    ADD CONSTRAINT "user_recipe_step_ingredients_user_recipe_ingredient_id_fkey" FOREIGN KEY ("user_recipe_ingredient_id") REFERENCES "public"."user_recipe_ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_step_ingredients"
    ADD CONSTRAINT "user_recipe_step_ingredients_user_recipe_step_id_fkey" FOREIGN KEY ("user_recipe_step_id") REFERENCES "public"."user_recipe_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_steps"
    ADD CONSTRAINT "user_recipe_steps_user_recipe_id_fkey" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_tags"
    ADD CONSTRAINT "user_recipe_tags_user_recipe_id_fkey" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_useful_items"
    ADD CONSTRAINT "user_recipe_useful_items_useful_item_id_fkey" FOREIGN KEY ("useful_item_id") REFERENCES "public"."useful_items"("id");



ALTER TABLE ONLY "public"."user_recipe_useful_items"
    ADD CONSTRAINT "user_recipe_useful_items_user_recipe_id_fkey" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_original_recipe_id_fkey" FOREIGN KEY ("original_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can read allergen groups" ON "public"."allergen_groups" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view ingredients" ON "public"."ingredients" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view measurement units" ON "public"."measurement_units" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view published recipes" ON "public"."recipes" FOR SELECT TO "authenticated", "anon" USING ((("is_published" = true) OR "public"."is_admin"()));



CREATE POLICY "Anyone can view recipe ingredients" ON "public"."recipe_ingredients" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe step ingredients" ON "public"."recipe_step_ingredients" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe steps" ON "public"."recipe_steps" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe tags" ON "public"."recipe_tags" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe_to_tag" ON "public"."recipe_to_tag" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."recipe_useful_items" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."useful_items" FOR SELECT USING (true);



CREATE POLICY "Only admins can delete from recipe_to_tag" ON "public"."recipe_to_tag" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete ingredients" ON "public"."ingredients" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete measurement units" ON "public"."measurement_units" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete recipe ingredients" ON "public"."recipe_ingredients" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete recipe step ingredients" ON "public"."recipe_step_ingredients" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete recipe steps" ON "public"."recipe_steps" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete recipe tags" ON "public"."recipe_tags" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete recipe useful items" ON "public"."recipe_useful_items" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete recipes" ON "public"."recipes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can delete useful items" ON "public"."useful_items" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Only admins can insert ingredients" ON "public"."ingredients" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert into recipe_to_tag" ON "public"."recipe_to_tag" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert measurement units" ON "public"."measurement_units" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert recipe ingredients" ON "public"."recipe_ingredients" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert recipe step ingredients" ON "public"."recipe_step_ingredients" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert recipe steps" ON "public"."recipe_steps" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert recipe tags" ON "public"."recipe_tags" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert recipe useful items" ON "public"."recipe_useful_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert recipes" ON "public"."recipes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can insert useful items" ON "public"."useful_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update ingredients" ON "public"."ingredients" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update measurement units" ON "public"."measurement_units" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update recipe ingredients" ON "public"."recipe_ingredients" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update recipe step ingredients" ON "public"."recipe_step_ingredients" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update recipe steps" ON "public"."recipe_steps" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update recipe tags" ON "public"."recipe_tags" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update recipe useful items" ON "public"."recipe_useful_items" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update recipe_to_tag" ON "public"."recipe_to_tag" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update recipes" ON "public"."recipes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only admins can update useful items" ON "public"."useful_items" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Users can delete own profile" ON "public"."user_profiles" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own sessions" ON "public"."ai_voice_sessions" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view their own sessions" ON "public"."ai_voice_sessions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own usage" ON "public"."ai_voice_usage" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."ai_voice_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_voice_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allergen_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_step_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_to_tag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_useful_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."useful_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_chat_messages_user_policy" ON "public"."user_chat_messages" TO "authenticated" USING (("session_id" IN ( SELECT "user_chat_sessions"."id"
   FROM "public"."user_chat_sessions"
  WHERE ("user_chat_sessions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("session_id" IN ( SELECT "user_chat_sessions"."id"
   FROM "public"."user_chat_sessions"
  WHERE ("user_chat_sessions"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."user_chat_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_chat_sessions_user_policy" ON "public"."user_chat_sessions" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_events_user_policy" ON "public"."user_events" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_recipe_ingredients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_recipe_ingredients_policy" ON "public"."user_recipe_ingredients" TO "authenticated" USING (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."user_recipe_step_ingredients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_recipe_step_ingredients_policy" ON "public"."user_recipe_step_ingredients" TO "authenticated" USING (("user_recipe_step_id" IN ( SELECT "urs"."id"
   FROM ("public"."user_recipe_steps" "urs"
     JOIN "public"."user_recipes" "ur" ON (("ur"."id" = "urs"."user_recipe_id")))
  WHERE ("ur"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("user_recipe_step_id" IN ( SELECT "urs"."id"
   FROM ("public"."user_recipe_steps" "urs"
     JOIN "public"."user_recipes" "ur" ON (("ur"."id" = "urs"."user_recipe_id")))
  WHERE ("ur"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."user_recipe_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_recipe_steps_policy" ON "public"."user_recipe_steps" TO "authenticated" USING (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."user_recipe_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_recipe_tags_policy" ON "public"."user_recipe_tags" TO "authenticated" USING (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."user_recipe_useful_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_recipe_useful_items_policy" ON "public"."user_recipe_useful_items" TO "authenticated" USING (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("user_recipe_id" IN ( SELECT "user_recipes"."id"
   FROM "public"."user_recipes"
  WHERE ("user_recipes"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."user_recipes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_recipes_user_policy" ON "public"."user_recipes" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON FUNCTION "public"."add_enum_value"("enum_name" "text", "new_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_enum_value"("enum_name" "text", "new_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_enum_value"("enum_name" "text", "new_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_updated_at_column"("table_name" "regclass") TO "anon";
GRANT ALL ON FUNCTION "public"."add_updated_at_column"("table_name" "regclass") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_updated_at_column"("table_name" "regclass") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_updated_at_to_all_tables"("schema_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_updated_at_to_all_tables"("schema_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_updated_at_to_all_tables"("schema_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_enum_values"("enum_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_enum_values"("enum_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_enum_values"("enum_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_voice_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_voice_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_voice_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



























GRANT ALL ON TABLE "public"."ai_voice_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ai_voice_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_voice_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_voice_usage" TO "anon";
GRANT ALL ON TABLE "public"."ai_voice_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_voice_usage" TO "service_role";



GRANT ALL ON TABLE "public"."allergen_groups" TO "anon";
GRANT ALL ON TABLE "public"."allergen_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."allergen_groups" TO "service_role";



GRANT ALL ON TABLE "public"."ingredients" TO "anon";
GRANT ALL ON TABLE "public"."ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_units" TO "anon";
GRANT ALL ON TABLE "public"."measurement_units" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_units" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_step_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_step_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_step_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_steps" TO "anon";
GRANT ALL ON TABLE "public"."recipe_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_steps" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_tags" TO "anon";
GRANT ALL ON TABLE "public"."recipe_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_tags" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_to_tag" TO "anon";
GRANT ALL ON TABLE "public"."recipe_to_tag" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_to_tag" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_useful_items" TO "anon";
GRANT ALL ON TABLE "public"."recipe_useful_items" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_useful_items" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."useful_items" TO "anon";
GRANT ALL ON TABLE "public"."useful_items" TO "authenticated";
GRANT ALL ON TABLE "public"."useful_items" TO "service_role";



GRANT ALL ON TABLE "public"."user_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."user_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."user_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."user_chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_chat_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_events" TO "anon";
GRANT ALL ON TABLE "public"."user_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."user_recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipe_step_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."user_recipe_step_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipe_step_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipe_steps" TO "anon";
GRANT ALL ON TABLE "public"."user_recipe_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipe_steps" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipe_tags" TO "anon";
GRANT ALL ON TABLE "public"."user_recipe_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipe_tags" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipe_useful_items" TO "anon";
GRANT ALL ON TABLE "public"."user_recipe_useful_items" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipe_useful_items" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipes" TO "anon";
GRANT ALL ON TABLE "public"."user_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";


































bash: line 59: syntax error near unexpected token `('
