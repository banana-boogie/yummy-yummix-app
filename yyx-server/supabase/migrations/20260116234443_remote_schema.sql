

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






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






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
    LANGUAGE "plpgsql"
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


CREATE OR REPLACE FUNCTION "public"."add_updated_at_to_all_tables"("schema_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
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
    LANGUAGE "plpgsql"
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
    LANGUAGE "plpgsql"
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


CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "picture_url" "text",
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
    "ingredient_id" "uuid",
    "quantity" numeric NOT NULL,
    "measurement_unit_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_order" integer,
    "optional" boolean DEFAULT false,
    "recipe_id" "uuid"
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
    "recipe_id" "uuid",
    "useful_item_id" "uuid",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes_en" "text",
    "notes_es" "text"
);


ALTER TABLE "public"."recipe_useful_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "picture_url" "text",
    "prep_time" integer,
    "total_time" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_published" boolean DEFAULT false,
    "name_en" "text",
    "name_es" "text",
    "tips_and_tricks_en" "text",
    "tips_and_tricks_es" "text",
    "useful_items_en" "text",
    "useful_items_es" "text",
    "steps_en" "jsonb",
    "steps_es" "jsonb",
    "portions" smallint,
    "difficulty" "public"."recipe_difficulty",
    "nutritional_facts" "jsonb",
    "steps" "jsonb"
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."useful_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name_en" "text" NOT NULL,
    "name_es" "text" NOT NULL,
    "picture_url" "text",
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


CREATE TABLE IF NOT EXISTS "public"."user_context" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "household_size" integer DEFAULT 1,
    "skill_level" "text",
    "kitchen_equipment" "text"[] DEFAULT '{}'::"text"[],
    "dietary_restrictions" "text"[] DEFAULT '{}'::"text"[],
    "ingredient_dislikes" "text"[] DEFAULT '{}'::"text"[],
    "taste_profile" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_context_skill_level_check" CHECK (("skill_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."user_context" OWNER TO "postgres";


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
    CONSTRAINT "user_profiles_biography_check" CHECK (("length"("biography") <= 150)),
    CONSTRAINT "user_profiles_height_check" CHECK ((("height" > (0)::numeric) AND ("height" < (300)::numeric))),
    CONSTRAINT "user_profiles_name_check" CHECK (("length"("name") <= 30)),
    CONSTRAINT "user_profiles_weight_check" CHECK ((("weight" > (0)::numeric) AND ("weight" < (500)::numeric)))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."other_allergy" IS 'Custom allergies set by the user';



COMMENT ON COLUMN "public"."user_profiles"."other_diet" IS 'Custom diet preferences set by user';



COMMENT ON COLUMN "public"."user_profiles"."is_admin" IS 'flag to set admin users';



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
    CONSTRAINT "user_recipes_source_check" CHECK (("source" = ANY (ARRAY['ai_generated'::"text", 'ai_modified'::"text", 'user_created'::"text"])))
);


ALTER TABLE "public"."user_recipes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_voice_sessions"
    ADD CONSTRAINT "ai_voice_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_voice_usage"
    ADD CONSTRAINT "ai_voice_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_voice_usage"
    ADD CONSTRAINT "ai_voice_usage_user_id_month_key" UNIQUE ("user_id", "month");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_units"
    ADD CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_step_ingredients"
    ADD CONSTRAINT "recipe_step_ingredients_recipe_step_id_ingredient_id_key" UNIQUE ("recipe_step_id", "ingredient_id");



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



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."useful_items"
    ADD CONSTRAINT "useful_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_chat_messages"
    ADD CONSTRAINT "user_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_chat_sessions"
    ADD CONSTRAINT "user_chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_context"
    ADD CONSTRAINT "user_context_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_context"
    ADD CONSTRAINT "user_context_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_chat_messages_session" ON "public"."user_chat_messages" USING "btree" ("session_id", "created_at");



CREATE INDEX "idx_user_events_user_created" ON "public"."user_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_recipes_user" ON "public"."user_recipes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "recipe_step_ingredients_step_id_idx" ON "public"."recipe_step_ingredients" USING "btree" ("recipe_step_id");



CREATE INDEX "recipe_steps_order_number_idx" ON "public"."recipe_steps" USING "btree" ("recipe_id", "order");



CREATE INDEX "recipe_steps_recipe_id_idx" ON "public"."recipe_steps" USING "btree" ("recipe_id");



CREATE INDEX "recipe_to_tag_recipe_id_idx" ON "public"."recipe_to_tag" USING "btree" ("recipe_id");



CREATE INDEX "recipe_to_tag_tag_id_idx" ON "public"."recipe_to_tag" USING "btree" ("tag_id");



CREATE INDEX "recipe_useful_items_recipe_id_idx" ON "public"."recipe_useful_items" USING "btree" ("recipe_id");



CREATE INDEX "recipe_useful_items_useful_item_id_idx" ON "public"."recipe_useful_items" USING "btree" ("useful_item_id");



CREATE INDEX "useful_items_name_en_idx" ON "public"."useful_items" USING "btree" ("name_en");



CREATE INDEX "useful_items_name_es_idx" ON "public"."useful_items" USING "btree" ("name_es");



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



CREATE OR REPLACE TRIGGER "update_user_context_updated_at" BEFORE UPDATE ON "public"."user_context" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



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
    ADD CONSTRAINT "recipe_step_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON UPDATE CASCADE ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."user_context"
    ADD CONSTRAINT "user_context_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_original_recipe_id_fkey" FOREIGN KEY ("original_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow usage updates from triggers" ON "public"."ai_voice_usage" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can view ingredients" ON "public"."ingredients" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view measurement units" ON "public"."measurement_units" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe ingredients" ON "public"."recipe_ingredients" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe step ingredients" ON "public"."recipe_step_ingredients" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe steps" ON "public"."recipe_steps" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe tags" ON "public"."recipe_tags" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipe_to_tag" ON "public"."recipe_to_tag" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view recipes" ON "public"."recipes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Authenticated users can delete recipes" ON "public"."recipes" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert recipes" ON "public"."recipes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update recipes" ON "public"."recipes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."recipe_useful_items" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."useful_items" FOR SELECT USING (true);



CREATE POLICY "Only admins can delete recipe useful items" ON "public"."recipe_useful_items" FOR DELETE TO "authenticated" USING ((( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Only admins can delete useful items" ON "public"."useful_items" FOR DELETE TO "authenticated" USING ((( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) IS TRUE));



CREATE POLICY "Only admins can insert into recipe useful items" ON "public"."recipe_useful_items" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Only admins can insert useful items" ON "public"."useful_items" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Only admins can update recipe useful items" ON "public"."recipe_useful_items" FOR UPDATE TO "authenticated" USING ((( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = true)) WITH CHECK ((( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Only admins can update useful items" ON "public"."useful_items" FOR UPDATE TO "authenticated" USING ((( SELECT "user_profiles"."is_admin"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Only authenticated can delete from recipe_to_tag" ON "public"."recipe_to_tag" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Only authenticated can delete recipe tags" ON "public"."recipe_tags" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Only authenticated can insert into recipe_to_tag" ON "public"."recipe_to_tag" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only authenticated can insert recipe tags" ON "public"."recipe_tags" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only authenticated can update recipe tags" ON "public"."recipe_tags" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Only authenticated can update recipe_to_tag" ON "public"."recipe_to_tag" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Only authenticated users can add recipe ingredients" ON "public"."recipe_ingredients" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only authenticated users can delete ingredients" ON "public"."ingredients" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Only authenticated users can delete measurement units" ON "public"."measurement_units" FOR DELETE TO "authenticated" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'super'::"text"));



CREATE POLICY "Only authenticated users can delete recipe ingredients" ON "public"."recipe_ingredients" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Only authenticated users can delete recipe step ingredients" ON "public"."recipe_step_ingredients" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Only authenticated users can delete recipe steps" ON "public"."recipe_steps" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Only authenticated users can insert ingredients" ON "public"."ingredients" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only authenticated users can insert measurement units" ON "public"."measurement_units" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'super'::"text"));



CREATE POLICY "Only authenticated users can insert recipe step ingredients" ON "public"."recipe_step_ingredients" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only authenticated users can insert recipe steps" ON "public"."recipe_steps" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only authenticated users can update ingredients" ON "public"."ingredients" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Only authenticated users can update measurement units" ON "public"."measurement_units" FOR UPDATE TO "authenticated" USING ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'super'::"text")) WITH CHECK ((( SELECT ("auth"."jwt"() ->> 'role'::"text")) = 'super'::"text"));



CREATE POLICY "Only authenticated users can update recipe ingredients" ON "public"."recipe_ingredients" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Only authenticated users can update recipe step ingredients" ON "public"."recipe_step_ingredients" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Only authenticated users can update recipe steps" ON "public"."recipe_steps" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can insert sessions" ON "public"."ai_voice_sessions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can delete own profile" ON "public"."user_profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own sessions" ON "public"."ai_voice_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own sessions" ON "public"."ai_voice_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own usage" ON "public"."ai_voice_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_voice_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_voice_usage" ENABLE ROW LEVEL SECURITY;


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


CREATE POLICY "user_chat_messages_user_policy" ON "public"."user_chat_messages" USING (("session_id" IN ( SELECT "user_chat_sessions"."id"
   FROM "public"."user_chat_sessions"
  WHERE ("user_chat_sessions"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_chat_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_chat_sessions_user_policy" ON "public"."user_chat_sessions" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_context" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_context_user_policy" ON "public"."user_context" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_events_user_policy" ON "public"."user_events" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_recipes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_recipes_user_policy" ON "public"."user_recipes" USING (("auth"."uid"() = "user_id"));





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



GRANT ALL ON TABLE "public"."user_context" TO "anon";
GRANT ALL ON TABLE "public"."user_context" TO "authenticated";
GRANT ALL ON TABLE "public"."user_context" TO "service_role";



GRANT ALL ON TABLE "public"."user_events" TO "anon";
GRANT ALL ON TABLE "public"."user_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



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


































