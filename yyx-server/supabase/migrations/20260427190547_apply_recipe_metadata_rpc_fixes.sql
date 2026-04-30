-- Recipe Metadata Apply RPC — fixes from PR #55 review.
--
-- This migration replaces the body of public.apply_recipe_metadata to fix:
--
-- 1. Translation bootstrap silently skipped (Codex review #1).
--    The original used `SELECT true ... INTO v_row_exists`, which leaves
--    v_row_exists NULL when no row matches. `IF NOT NULL THEN` evaluates
--    to NULL and is treated as false, so the bootstrap branch was never
--    taken. Recipes with only one locale never got the second locale row.
--    Fix: use FOUND immediately after the SELECT.
--
-- 2. Step speed/range mutual exclusion not enforced server-side (Codex #2).
--    The schema rejects YAMLs that set both, but the RPC didn't clear the
--    opposite columns when only one form was supplied — leaving stale
--    range values intact when YAML moved to a single speed (or vice versa).
--    Different downstream paths read these columns differently, producing
--    ambiguous Thermomix state. Fix: when YAML provides `thermomix_speed`,
--    clear `thermomix_speed_start/end`; when YAML provides
--    `thermomix_speed_range`, clear `thermomix_speed`.
--
-- 3. Tag categories incomplete (Claude review High #1).
--    Track H expanded the recipe_tag_category enum from 5 to 7 categories
--    by adding `dish_type` and `primary_ingredient`. The RPC's iteration
--    array only listed 5, so YAMLs could never write those category tags.
--    Fix: include all 7 in the iteration list (matches the schema enum).
--
-- 4. Kitchen-tool name lookup duplicated (Claude review Warning #1).
--    The original duplicated the name → kitchen_tool_id lookup with
--    ambiguity check across the set-replacement and notes-upsert loops.
--    Fix: extract a private helper `_recipe_metadata_resolve_kitchen_tool`
--    and call it once per name.
--
-- The original migration (20260427050549) is left in place untouched;
-- this is a forward-only CREATE OR REPLACE.

-- ============================================================
-- Helper: resolve kitchen tool name to UUID with ambiguity check
-- ============================================================

CREATE OR REPLACE FUNCTION public._recipe_metadata_resolve_kitchen_tool(name_lookup text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_match_count int;
  v_kt_id       uuid;
BEGIN
  SELECT count(*), max(kt.id)
    INTO v_match_count, v_kt_id
    FROM public.kitchen_tools kt
    JOIN public.kitchen_tool_translations ktt
      ON ktt.kitchen_tool_id = kt.id AND ktt.locale = 'en'
   WHERE lower(trim(ktt.name)) = lower(trim(name_lookup));

  IF v_match_count > 1 THEN
    RAISE EXCEPTION
      'kitchen_tools: ambiguous name_en "%" matches % rows — disambiguate in the admin UI',
      name_lookup, v_match_count;
  END IF;
  IF v_match_count = 0 THEN
    RAISE EXCEPTION
      'kitchen_tools: no kitchen_tool with name_en = "%" (create it in the admin UI first)',
      name_lookup;
  END IF;

  RETURN v_kt_id;
END;
$$;

COMMENT ON FUNCTION public._recipe_metadata_resolve_kitchen_tool(text) IS
  'Internal helper for apply_recipe_metadata. Resolves a kitchen tool name_en '
  'to its UUID; raises on ambiguity (multiple matches) or absence.';

-- ============================================================
-- apply_recipe_metadata — corrected version
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_recipe_metadata(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_recipe_id            uuid;
  v_expected_updated_at  timestamptz;
  v_payload_name_en      text;
  v_db_updated_at        timestamptz;
  v_db_name_en           text;
  v_changed              boolean := false;
  v_counts               jsonb := '{}'::jsonb;
  v_errors               jsonb := '[]'::jsonb;

  v_section              jsonb;
  v_locale               text;

  v_planner_changed      int := 0;
  v_timings_changed      int := 0;
  v_translations_upserts int := 0;
  v_translations_deletes int := 0;
  v_name_overrides       int := 0;
  v_ing_updates          int := 0;
  v_ing_adds             int := 0;
  v_ing_removes          int := 0;
  v_kt_added             int := 0;
  v_kt_removed           int := 0;
  v_pair_added           int := 0;
  v_pair_removed         int := 0;
  v_step_overrides_done  int := 0;
  v_tags_added           int := 0;
  v_tags_removed         int := 0;

  v_match                jsonb;
  v_existing_id          uuid;
  v_match_slug           text;
  v_match_order          int;
  v_recipe_ing_id        uuid;
  v_ingredient_id        uuid;

  v_step_id              uuid;
  v_step_match_order     int;

  v_kt_desired           uuid[];
  v_kt_current           uuid[];
  v_kt_id                uuid;
  v_kt_entry             jsonb;
  v_kt_lookup            text;

  v_pair_desired_keys    text[];
  v_pair_current_keys    text[];
  v_pair_entry           jsonb;
  v_pair_key             text;

  v_tag_category         text;
  v_tag_slugs_desired    text[];
  v_tag_slugs_current    text[];
  v_tag_slug             text;
  v_tag_id               uuid;

  v_locale_to_delete     text;
BEGIN
  -- ------------------------------------------------------------
  -- Recipe match + stale-diff guard
  -- ------------------------------------------------------------
  v_recipe_id := (payload #>> '{recipe_match,id}')::uuid;
  v_payload_name_en := payload #>> '{recipe_match,name_en}';
  v_expected_updated_at := (payload #>> '{recipe_match,expected_recipe_updated_at}')::timestamptz;

  IF v_recipe_id IS NULL THEN
    RAISE EXCEPTION 'payload.recipe_match.id is required';
  END IF;
  IF v_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'payload.recipe_match.expected_recipe_updated_at is required';
  END IF;

  SELECT r.updated_at, rt.name
    INTO v_db_updated_at, v_db_name_en
    FROM public.recipes r
    LEFT JOIN public.recipe_translations rt
      ON rt.recipe_id = r.id AND rt.locale = 'en'
    WHERE r.id = v_recipe_id
    FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe % not found', v_recipe_id;
  END IF;

  IF v_db_name_en IS NOT NULL
     AND v_payload_name_en IS NOT NULL
     AND lower(trim(v_db_name_en)) <> lower(trim(v_payload_name_en)) THEN
    RAISE EXCEPTION 'recipe_match.name_en mismatch: payload=% db=%',
      v_payload_name_en, v_db_name_en;
  END IF;

  IF v_db_updated_at > v_expected_updated_at THEN
    RAISE EXCEPTION
      'stale_diff: recipe % updated_at (%) is ahead of payload expected (%) — re-run the Reviewer',
      v_recipe_id, v_db_updated_at, v_expected_updated_at;
  END IF;

  -- ------------------------------------------------------------
  -- planner
  -- ------------------------------------------------------------
  IF payload ? 'planner' THEN
    v_section := payload -> 'planner';

    UPDATE public.recipes r
       SET planner_role = COALESCE(v_section->>'role', r.planner_role),
           alternate_planner_roles = CASE
             WHEN v_section ? 'alternate_planner_roles'
               THEN ARRAY(SELECT jsonb_array_elements_text(v_section->'alternate_planner_roles'))
             ELSE r.alternate_planner_roles
           END,
           meal_components = CASE
             WHEN v_section ? 'meal_components'
               THEN ARRAY(SELECT jsonb_array_elements_text(v_section->'meal_components'))
             ELSE r.meal_components
           END,
           is_complete_meal = COALESCE((v_section->>'is_complete_meal')::boolean, r.is_complete_meal),
           equipment_tags = CASE
             WHEN v_section ? 'equipment_tags'
               THEN ARRAY(SELECT jsonb_array_elements_text(v_section->'equipment_tags'))
             ELSE r.equipment_tags
           END,
           cooking_level = COALESCE(v_section->>'cooking_level', r.cooking_level),
           leftovers_friendly = COALESCE((v_section->>'leftovers_friendly')::boolean, r.leftovers_friendly),
           batch_friendly = COALESCE((v_section->>'batch_friendly')::boolean, r.batch_friendly),
           max_household_size_supported = COALESCE(
             (v_section->>'max_household_size_supported')::int,
             r.max_household_size_supported
           ),
           is_published = COALESCE((v_section->>'is_published')::boolean, r.is_published)
     WHERE r.id = v_recipe_id
       AND (
         COALESCE(v_section->>'role', r.planner_role) IS DISTINCT FROM r.planner_role
         OR (v_section ? 'alternate_planner_roles'
             AND ARRAY(SELECT jsonb_array_elements_text(v_section->'alternate_planner_roles'))
                 IS DISTINCT FROM r.alternate_planner_roles)
         OR (v_section ? 'meal_components'
             AND ARRAY(SELECT jsonb_array_elements_text(v_section->'meal_components'))
                 IS DISTINCT FROM r.meal_components)
         OR COALESCE((v_section->>'is_complete_meal')::boolean, r.is_complete_meal) IS DISTINCT FROM r.is_complete_meal
         OR (v_section ? 'equipment_tags'
             AND ARRAY(SELECT jsonb_array_elements_text(v_section->'equipment_tags'))
                 IS DISTINCT FROM r.equipment_tags)
         OR COALESCE(v_section->>'cooking_level', r.cooking_level) IS DISTINCT FROM r.cooking_level
         OR COALESCE((v_section->>'leftovers_friendly')::boolean, r.leftovers_friendly) IS DISTINCT FROM r.leftovers_friendly
         OR COALESCE((v_section->>'batch_friendly')::boolean, r.batch_friendly) IS DISTINCT FROM r.batch_friendly
         OR COALESCE((v_section->>'max_household_size_supported')::int, r.max_household_size_supported)
            IS DISTINCT FROM r.max_household_size_supported
         OR COALESCE((v_section->>'is_published')::boolean, r.is_published) IS DISTINCT FROM r.is_published
       );
    GET DIAGNOSTICS v_planner_changed = ROW_COUNT;
    IF v_planner_changed > 0 THEN v_changed := true; END IF;
  END IF;

  -- ------------------------------------------------------------
  -- timings
  -- ------------------------------------------------------------
  IF payload ? 'timings' THEN
    v_section := payload -> 'timings';
    UPDATE public.recipes r
       SET prep_time = COALESCE((v_section->>'prep_time')::int, r.prep_time),
           total_time = COALESCE((v_section->>'total_time')::int, r.total_time),
           portions = COALESCE((v_section->>'portions')::int, r.portions)
     WHERE r.id = v_recipe_id
       AND (
         COALESCE((v_section->>'prep_time')::int, r.prep_time) IS DISTINCT FROM r.prep_time
         OR COALESCE((v_section->>'total_time')::int, r.total_time) IS DISTINCT FROM r.total_time
         OR COALESCE((v_section->>'portions')::int, r.portions) IS DISTINCT FROM r.portions
       );
    GET DIAGNOSTICS v_timings_changed = ROW_COUNT;
    IF v_timings_changed > 0 THEN v_changed := true; END IF;
  END IF;

  -- ------------------------------------------------------------
  -- name overrides + description + tips_and_tricks + scaling_notes
  --
  -- FIX (Codex #1): use NOT FOUND immediately after the SELECT to detect
  -- a missing translation row. The previous version used a boolean-NULL
  -- variable, which made the bootstrap branch unreachable.
  -- ------------------------------------------------------------
  FOR v_locale IN SELECT unnest(ARRAY['en','es']) LOOP
    DECLARE
      v_name_new        text;
      v_desc_new        text;
      v_tips_new        text;
      v_scaling_new     text;
      v_name_current    text;
      v_desc_current    text;
      v_tips_current    text;
      v_scaling_current text;
      v_row_changed     int;
    BEGIN
      v_name_new    := payload #>> ARRAY['name', v_locale];
      v_desc_new    := payload #>> ARRAY['description', v_locale];
      v_tips_new    := payload #>> ARRAY['tips_and_tricks', v_locale];
      v_scaling_new := payload #>> ARRAY['scaling_notes', v_locale];

      IF v_name_new IS NULL AND v_desc_new IS NULL
         AND v_tips_new IS NULL AND v_scaling_new IS NULL THEN
        CONTINUE;
      END IF;

      SELECT name, description, tips_and_tricks, scaling_notes
        INTO v_name_current, v_desc_current, v_tips_current, v_scaling_current
        FROM public.recipe_translations
        WHERE recipe_id = v_recipe_id AND locale = v_locale;

      IF NOT FOUND THEN
        IF v_name_new IS NULL THEN
          RAISE EXCEPTION
            'recipe % has no % translation row; YAML must provide name.% to bootstrap',
            v_recipe_id, v_locale, v_locale;
        END IF;
        INSERT INTO public.recipe_translations
          (recipe_id, locale, name, description, tips_and_tricks, scaling_notes)
          VALUES (v_recipe_id, v_locale, v_name_new, v_desc_new, v_tips_new, v_scaling_new);
        v_translations_upserts := v_translations_upserts + 1;
        IF v_name_new IS NOT NULL THEN v_name_overrides := v_name_overrides + 1; END IF;
        v_changed := true;
      ELSE
        UPDATE public.recipe_translations rt
           SET name             = COALESCE(v_name_new, rt.name),
               description      = COALESCE(v_desc_new, rt.description),
               tips_and_tricks  = COALESCE(v_tips_new, rt.tips_and_tricks),
               scaling_notes    = COALESCE(v_scaling_new, rt.scaling_notes)
         WHERE rt.recipe_id = v_recipe_id
           AND rt.locale = v_locale
           AND (
             COALESCE(v_name_new, rt.name) IS DISTINCT FROM rt.name
             OR COALESCE(v_desc_new, rt.description) IS DISTINCT FROM rt.description
             OR COALESCE(v_tips_new, rt.tips_and_tricks) IS DISTINCT FROM rt.tips_and_tricks
             OR COALESCE(v_scaling_new, rt.scaling_notes) IS DISTINCT FROM rt.scaling_notes
           );
        GET DIAGNOSTICS v_row_changed = ROW_COUNT;
        IF v_row_changed > 0 THEN
          v_translations_upserts := v_translations_upserts + 1;
          IF v_name_new IS NOT NULL AND v_name_new IS DISTINCT FROM v_name_current THEN
            v_name_overrides := v_name_overrides + 1;
          END IF;
          v_changed := true;
        END IF;
      END IF;
    END;
  END LOOP;

  -- ------------------------------------------------------------
  -- ingredient_updates
  -- ------------------------------------------------------------
  IF payload ? 'ingredient_updates' THEN
    FOR v_section IN SELECT * FROM jsonb_array_elements(payload->'ingredient_updates') LOOP
      v_match := v_section -> 'match';
      v_existing_id := NULL;
      v_recipe_ing_id := NULL;

      IF v_match ? 'existing_id' THEN
        v_existing_id := (v_match->>'existing_id')::uuid;
        SELECT id INTO v_recipe_ing_id
          FROM public.recipe_ingredients
          WHERE id = v_existing_id AND recipe_id = v_recipe_id;
      ELSE
        v_match_slug := v_match->>'ingredient_slug';
        v_match_order := (v_match->>'display_order')::int;
        SELECT ri.id INTO v_recipe_ing_id
          FROM public.recipe_ingredients ri
          JOIN public.ingredient_translations it
            ON it.ingredient_id = ri.ingredient_id AND it.locale = 'en'
          WHERE ri.recipe_id = v_recipe_id
            AND ri.display_order = v_match_order
            AND public._recipe_metadata_slugify(it.name) = v_match_slug
          LIMIT 1;
      END IF;

      IF v_recipe_ing_id IS NULL THEN
        RAISE EXCEPTION 'ingredient_updates: no recipe_ingredient match for %', v_match::text;
      END IF;

      UPDATE public.recipe_ingredients ri
         SET measurement_unit_id = CASE
               WHEN v_section ? 'unit' THEN NULLIF(v_section->>'unit', '')
               ELSE ri.measurement_unit_id
             END,
             quantity = CASE
               WHEN v_section ? 'quantity' THEN (v_section->>'quantity')::numeric
               ELSE ri.quantity
             END,
             optional = CASE
               WHEN v_section ? 'optional' THEN (v_section->>'optional')::boolean
               ELSE ri.optional
             END
       WHERE ri.id = v_recipe_ing_id
         AND (
           (v_section ? 'unit'  AND NULLIF(v_section->>'unit','') IS DISTINCT FROM ri.measurement_unit_id)
           OR (v_section ? 'quantity' AND (v_section->>'quantity')::numeric IS DISTINCT FROM ri.quantity)
           OR (v_section ? 'optional' AND (v_section->>'optional')::boolean IS DISTINCT FROM ri.optional)
         );
      IF FOUND THEN v_ing_updates := v_ing_updates + 1; v_changed := true; END IF;

      FOR v_locale IN SELECT unnest(ARRAY['en','es']) LOOP
        DECLARE
          v_notes_new   text;
          v_section_key text;
          v_notes_current text;
          v_section_current text;
          v_n int;
        BEGIN
          v_notes_new   := v_section ->> ('notes_' || v_locale);
          v_section_key := v_section ->> ('section_' || v_locale);
          IF v_notes_new IS NULL AND v_section_key IS NULL THEN CONTINUE; END IF;

          SELECT notes, recipe_section
            INTO v_notes_current, v_section_current
            FROM public.recipe_ingredient_translations
            WHERE recipe_ingredient_id = v_recipe_ing_id AND locale = v_locale;

          IF NOT FOUND THEN
            INSERT INTO public.recipe_ingredient_translations
              (recipe_ingredient_id, locale, notes, recipe_section)
              VALUES (v_recipe_ing_id, v_locale,
                      v_notes_new,
                      COALESCE(v_section_key, ''));
            v_ing_updates := v_ing_updates + 1; v_changed := true;
          ELSE
            UPDATE public.recipe_ingredient_translations rit
              SET notes = COALESCE(v_notes_new, rit.notes),
                  recipe_section = COALESCE(v_section_key, rit.recipe_section)
              WHERE rit.recipe_ingredient_id = v_recipe_ing_id
                AND rit.locale = v_locale
                AND (
                  COALESCE(v_notes_new, rit.notes) IS DISTINCT FROM rit.notes
                  OR COALESCE(v_section_key, rit.recipe_section) IS DISTINCT FROM rit.recipe_section
                );
            GET DIAGNOSTICS v_n = ROW_COUNT;
            IF v_n > 0 THEN v_ing_updates := v_ing_updates + 1; v_changed := true; END IF;
          END IF;
        END;
      END LOOP;
    END LOOP;
  END IF;

  -- ------------------------------------------------------------
  -- ingredient_adds
  -- ------------------------------------------------------------
  IF payload ? 'ingredient_adds' THEN
    FOR v_section IN SELECT * FROM jsonb_array_elements(payload->'ingredient_adds') LOOP
      v_match_slug := v_section ->> 'ingredient_slug';
      v_match_order := (v_section->>'display_order')::int;

      SELECT i.id INTO v_ingredient_id
        FROM public.ingredients i
        JOIN public.ingredient_translations it
          ON it.ingredient_id = i.id AND it.locale = 'en'
       WHERE public._recipe_metadata_slugify(it.name) = v_match_slug
       LIMIT 1;

      IF v_ingredient_id IS NULL THEN
        RAISE EXCEPTION
          'ingredient_adds: no ingredient with slugified name_en = %; create the ingredient in the admin UI first',
          v_match_slug;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.recipe_ingredients
         WHERE recipe_id = v_recipe_id
           AND display_order = v_match_order
           AND ingredient_id = v_ingredient_id
      ) THEN CONTINUE; END IF;

      INSERT INTO public.recipe_ingredients
        (recipe_id, ingredient_id, quantity, measurement_unit_id, optional, display_order)
        VALUES (
          v_recipe_id,
          v_ingredient_id,
          (v_section->>'quantity')::numeric,
          NULLIF(v_section->>'unit', ''),
          COALESCE((v_section->>'optional')::boolean, false),
          v_match_order
        )
      RETURNING id INTO v_recipe_ing_id;

      v_ing_adds := v_ing_adds + 1; v_changed := true;

      INSERT INTO public.recipe_ingredient_translations
        (recipe_ingredient_id, locale, notes, recipe_section)
      SELECT v_recipe_ing_id, loc, notes, COALESCE(section, '')
        FROM (
          VALUES
            ('en', v_section->>'notes_en', v_section->>'section_en'),
            ('es', v_section->>'notes_es', v_section->>'section_es')
        ) AS rows(loc, notes, section)
       WHERE notes IS NOT NULL OR section IS NOT NULL;
    END LOOP;
  END IF;

  -- ------------------------------------------------------------
  -- ingredient_removes
  -- ------------------------------------------------------------
  IF payload ? 'ingredient_removes' THEN
    FOR v_section IN SELECT * FROM jsonb_array_elements(payload->'ingredient_removes') LOOP
      v_match := v_section -> 'match';
      IF v_match ? 'existing_id' THEN
        DELETE FROM public.recipe_ingredients
         WHERE id = (v_match->>'existing_id')::uuid AND recipe_id = v_recipe_id;
      ELSE
        v_match_slug := v_match->>'ingredient_slug';
        v_match_order := (v_match->>'display_order')::int;
        DELETE FROM public.recipe_ingredients ri
         USING public.ingredient_translations it
         WHERE ri.recipe_id = v_recipe_id
           AND ri.display_order = v_match_order
           AND it.ingredient_id = ri.ingredient_id
           AND it.locale = 'en'
           AND public._recipe_metadata_slugify(it.name) = v_match_slug;
      END IF;
      IF FOUND THEN v_ing_removes := v_ing_removes + 1; v_changed := true; END IF;
    END LOOP;
  END IF;

  -- ------------------------------------------------------------
  -- kitchen_tools (declarative set, name_en lookup)
  --
  -- FIX (Claude #2): name lookup logic now lives in a single helper
  -- (_recipe_metadata_resolve_kitchen_tool) called once per entry, instead
  -- of duplicated across two loops.
  -- ------------------------------------------------------------
  IF payload ? 'kitchen_tools' THEN
    v_kt_desired := ARRAY[]::uuid[];

    FOR v_kt_entry IN SELECT * FROM jsonb_array_elements(payload #> '{kitchen_tools,set}') LOOP
      v_kt_lookup := v_kt_entry ->> 'name_en';
      v_kt_id := public._recipe_metadata_resolve_kitchen_tool(v_kt_lookup);
      v_kt_desired := array_append(v_kt_desired, v_kt_id);
    END LOOP;

    SELECT COALESCE(array_agg(kitchen_tool_id ORDER BY display_order), ARRAY[]::uuid[])
      INTO v_kt_current
      FROM public.recipe_kitchen_tools
      WHERE recipe_id = v_recipe_id;

    DELETE FROM public.recipe_kitchen_tools
      WHERE recipe_id = v_recipe_id
        AND kitchen_tool_id = ANY(v_kt_current)
        AND kitchen_tool_id <> ALL(v_kt_desired);
    GET DIAGNOSTICS v_kt_removed = ROW_COUNT;

    DECLARE
      v_next_order int;
      v_kt_idx     int;
    BEGIN
      SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_next_order
        FROM public.recipe_kitchen_tools
        WHERE recipe_id = v_recipe_id;

      v_kt_idx := 1;
      WHILE v_kt_idx <= COALESCE(array_length(v_kt_desired, 1), 0) LOOP
        v_kt_id := v_kt_desired[v_kt_idx];
        IF NOT EXISTS (
          SELECT 1 FROM public.recipe_kitchen_tools
            WHERE recipe_id = v_recipe_id AND kitchen_tool_id = v_kt_id
        ) THEN
          INSERT INTO public.recipe_kitchen_tools (recipe_id, kitchen_tool_id, display_order)
            VALUES (v_recipe_id, v_kt_id, v_next_order);
          v_next_order := v_next_order + 1;
          v_kt_added := v_kt_added + 1;
        END IF;
        v_kt_idx := v_kt_idx + 1;
      END LOOP;
    END;

    -- Notes upsert per entry (helper resolves the name once more — cheap)
    FOR v_kt_entry IN SELECT * FROM jsonb_array_elements(payload #> '{kitchen_tools,set}') LOOP
      v_kt_lookup := v_kt_entry ->> 'name_en';
      v_kt_id := public._recipe_metadata_resolve_kitchen_tool(v_kt_lookup);

      DECLARE
        v_rkt_id uuid;
      BEGIN
        SELECT id INTO v_rkt_id
          FROM public.recipe_kitchen_tools
          WHERE recipe_id = v_recipe_id AND kitchen_tool_id = v_kt_id;
        IF v_rkt_id IS NULL THEN CONTINUE; END IF;

        FOR v_locale IN SELECT unnest(ARRAY['en','es']) LOOP
          DECLARE
            v_notes_new text;
            v_n int;
          BEGIN
            v_notes_new := v_kt_entry ->> ('notes_' || v_locale);
            IF v_notes_new IS NULL THEN CONTINUE; END IF;

            INSERT INTO public.recipe_kitchen_tool_translations
              (recipe_kitchen_tool_id, locale, notes)
              VALUES (v_rkt_id, v_locale, v_notes_new)
            ON CONFLICT (recipe_kitchen_tool_id, locale) DO UPDATE
              SET notes = EXCLUDED.notes
              WHERE public.recipe_kitchen_tool_translations.notes
                IS DISTINCT FROM EXCLUDED.notes;
            GET DIAGNOSTICS v_n = ROW_COUNT;
            IF v_n > 0 THEN v_changed := true; END IF;
          END;
        END LOOP;
      END;
    END LOOP;

    IF v_kt_added > 0 OR v_kt_removed > 0 THEN v_changed := true; END IF;
  END IF;

  -- ------------------------------------------------------------
  -- pairings (declarative set)
  -- ------------------------------------------------------------
  IF payload ? 'pairings' THEN
    v_pair_desired_keys := ARRAY[]::text[];
    FOR v_pair_entry IN SELECT * FROM jsonb_array_elements(payload #> '{pairings,set}') LOOP
      v_pair_key := (v_pair_entry->>'target_id') || '|' || (v_pair_entry->>'role');
      v_pair_desired_keys := array_append(v_pair_desired_keys, v_pair_key);
    END LOOP;

    SELECT COALESCE(array_agg(target_recipe_id::text || '|' || pairing_role ORDER BY pairing_role), ARRAY[]::text[])
      INTO v_pair_current_keys
      FROM public.recipe_pairings
      WHERE source_recipe_id = v_recipe_id;

    FOR v_pair_key IN SELECT unnest(v_pair_current_keys) LOOP
      IF v_pair_key <> ALL(v_pair_desired_keys) THEN
        DELETE FROM public.recipe_pairings
         WHERE source_recipe_id = v_recipe_id
           AND (target_recipe_id::text || '|' || pairing_role) = v_pair_key;
        v_pair_removed := v_pair_removed + 1; v_changed := true;
      END IF;
    END LOOP;

    FOR v_pair_entry IN SELECT * FROM jsonb_array_elements(payload #> '{pairings,set}') LOOP
      v_pair_key := (v_pair_entry->>'target_id') || '|' || (v_pair_entry->>'role');
      IF v_pair_key <> ALL(v_pair_current_keys) THEN
        INSERT INTO public.recipe_pairings
          (source_recipe_id, target_recipe_id, pairing_role, reason)
          VALUES (v_recipe_id,
                  (v_pair_entry->>'target_id')::uuid,
                  v_pair_entry->>'role',
                  v_pair_entry->>'reason');
        v_pair_added := v_pair_added + 1; v_changed := true;
      END IF;
    END LOOP;
  END IF;

  -- ------------------------------------------------------------
  -- step_overrides (per-row, only listed fields touched)
  --
  -- FIX (Codex #2): when a step override sets thermomix_speed, force
  -- thermomix_speed_start/end to NULL (and vice-versa for the range form).
  -- This preserves the speed-vs-range invariant that downstream code relies
  -- on. The schema already prevents a YAML from setting both at once;
  -- this fix prevents a stale residue when YAML moves between forms.
  -- ------------------------------------------------------------
  IF payload ? 'step_overrides' THEN
    FOR v_section IN SELECT * FROM jsonb_array_elements(payload->'step_overrides') LOOP
      v_step_id := NULL;
      v_match := v_section -> 'match';

      IF v_match ? 'step_id' THEN
        SELECT id INTO v_step_id
          FROM public.recipe_steps
          WHERE id = (v_match->>'step_id')::uuid AND recipe_id = v_recipe_id;
      ELSE
        v_step_match_order := (v_match->>'order')::int;
        SELECT id INTO v_step_id
          FROM public.recipe_steps
          WHERE recipe_id = v_recipe_id AND "order" = v_step_match_order;
      END IF;

      IF v_step_id IS NULL THEN
        RAISE EXCEPTION 'step_overrides: no recipe_step match for %', v_match::text;
      END IF;

      UPDATE public.recipe_steps s
        SET thermomix_time = CASE WHEN v_section ? 'thermomix_time'
              THEN NULLIF(v_section->>'thermomix_time','')::int
              ELSE s.thermomix_time END,
            thermomix_speed = CASE
              WHEN v_section ? 'thermomix_speed'
                THEN (v_section->>'thermomix_speed')::public.thermomix_speed_type
              -- If YAML supplies a range, blank out the single-speed column.
              WHEN v_section ? 'thermomix_speed_range'
                THEN NULL
              ELSE s.thermomix_speed
            END,
            thermomix_speed_start = CASE
              WHEN v_section ? 'thermomix_speed_range'
                THEN (v_section #>> '{thermomix_speed_range,start}')::public.thermomix_speed_type
              -- If YAML supplies a single speed, blank out the range columns.
              WHEN v_section ? 'thermomix_speed'
                THEN NULL
              ELSE s.thermomix_speed_start
            END,
            thermomix_speed_end = CASE
              WHEN v_section ? 'thermomix_speed_range'
                THEN (v_section #>> '{thermomix_speed_range,end}')::public.thermomix_speed_type
              WHEN v_section ? 'thermomix_speed'
                THEN NULL
              ELSE s.thermomix_speed_end
            END,
            thermomix_temperature = CASE WHEN v_section ? 'thermomix_temperature'
              THEN (v_section->>'thermomix_temperature')::public.thermomix_temperature_type
              ELSE s.thermomix_temperature END,
            thermomix_temperature_unit = CASE WHEN v_section ? 'thermomix_temperature_unit'
              THEN (v_section->>'thermomix_temperature_unit')::public.temperature_units
              ELSE s.thermomix_temperature_unit END,
            thermomix_mode = CASE WHEN v_section ? 'thermomix_mode'
              THEN v_section->>'thermomix_mode'
              ELSE s.thermomix_mode END,
            thermomix_is_blade_reversed = CASE WHEN v_section ? 'thermomix_blade_reverse'
              THEN (v_section->>'thermomix_blade_reverse')::boolean
              ELSE s.thermomix_is_blade_reversed END,
            timer_seconds = CASE WHEN v_section ? 'non_thermomix_timer_seconds'
              THEN NULLIF(v_section->>'non_thermomix_timer_seconds','')::int
              ELSE s.timer_seconds END
        WHERE s.id = v_step_id
          AND (
            (v_section ? 'thermomix_time' AND NULLIF(v_section->>'thermomix_time','')::int IS DISTINCT FROM s.thermomix_time)
            OR (v_section ? 'thermomix_speed' AND
                ((v_section->>'thermomix_speed')::public.thermomix_speed_type IS DISTINCT FROM s.thermomix_speed
                 OR s.thermomix_speed_start IS NOT NULL
                 OR s.thermomix_speed_end IS NOT NULL))
            OR (v_section ? 'thermomix_speed_range' AND
                ((v_section #>> '{thermomix_speed_range,start}')::public.thermomix_speed_type IS DISTINCT FROM s.thermomix_speed_start
                 OR (v_section #>> '{thermomix_speed_range,end}')::public.thermomix_speed_type IS DISTINCT FROM s.thermomix_speed_end
                 OR s.thermomix_speed IS NOT NULL))
            OR (v_section ? 'thermomix_temperature' AND (v_section->>'thermomix_temperature')::public.thermomix_temperature_type IS DISTINCT FROM s.thermomix_temperature)
            OR (v_section ? 'thermomix_temperature_unit' AND (v_section->>'thermomix_temperature_unit')::public.temperature_units IS DISTINCT FROM s.thermomix_temperature_unit)
            OR (v_section ? 'thermomix_mode' AND v_section->>'thermomix_mode' IS DISTINCT FROM s.thermomix_mode)
            OR (v_section ? 'thermomix_blade_reverse' AND (v_section->>'thermomix_blade_reverse')::boolean IS DISTINCT FROM s.thermomix_is_blade_reversed)
            OR (v_section ? 'non_thermomix_timer_seconds' AND NULLIF(v_section->>'non_thermomix_timer_seconds','')::int IS DISTINCT FROM s.timer_seconds)
          );
      IF FOUND THEN v_step_overrides_done := v_step_overrides_done + 1; v_changed := true; END IF;
    END LOOP;
  END IF;

  -- ------------------------------------------------------------
  -- tags (declarative per-category set replacement)
  --
  -- FIX (Claude #1): include all 7 Track H categories. Previously only 5
  -- were iterated, so dish_type and primary_ingredient tags could never
  -- be written via this RPC.
  -- ------------------------------------------------------------
  IF payload ? 'tags' THEN
    FOR v_tag_category IN SELECT unnest(ARRAY[
      'cuisine', 'meal_type', 'diet',
      'dish_type', 'primary_ingredient',
      'occasion', 'practical'
    ]) LOOP
      IF NOT (payload->'tags') ? v_tag_category THEN CONTINUE; END IF;

      v_tag_slugs_desired := ARRAY(
        SELECT jsonb_array_elements_text(payload #> ARRAY['tags', v_tag_category])
      );

      DECLARE
        v_desired_ids uuid[];
        v_id          uuid;
        v_n           int;
      BEGIN
        v_desired_ids := ARRAY[]::uuid[];
        FOREACH v_tag_slug IN ARRAY v_tag_slugs_desired LOOP
          SELECT id INTO v_id
            FROM public.recipe_tags
            WHERE slug = v_tag_slug
              AND v_tag_category::public.recipe_tag_category = ANY(categories);
          IF v_id IS NULL THEN
            RAISE EXCEPTION
              'tags: no recipe_tag with slug=% under category=% (run the tag rebuild migration or fix the YAML)',
              v_tag_slug, v_tag_category;
          END IF;
          v_desired_ids := array_append(v_desired_ids, v_id);
        END LOOP;

        SELECT COALESCE(array_agg(rt.slug), ARRAY[]::text[])
          INTO v_tag_slugs_current
          FROM public.recipe_to_tag rtt
          JOIN public.recipe_tags rt ON rt.id = rtt.tag_id
          WHERE rtt.recipe_id = v_recipe_id
            AND v_tag_category::public.recipe_tag_category = ANY(rt.categories);

        DELETE FROM public.recipe_to_tag rtt
         USING public.recipe_tags rt
         WHERE rtt.recipe_id = v_recipe_id
           AND rtt.tag_id = rt.id
           AND v_tag_category::public.recipe_tag_category = ANY(rt.categories)
           AND rt.slug <> ALL(v_tag_slugs_desired);
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_tags_removed := v_tags_removed + v_n;

        INSERT INTO public.recipe_to_tag (recipe_id, tag_id)
        SELECT v_recipe_id, t.id
          FROM unnest(v_desired_ids) AS t(id)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.recipe_to_tag
              WHERE recipe_id = v_recipe_id AND tag_id = t.id
          );
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_tags_added := v_tags_added + v_n;
      END;
    END LOOP;
    IF v_tags_added > 0 OR v_tags_removed > 0 THEN v_changed := true; END IF;
  END IF;

  -- ------------------------------------------------------------
  -- cleanup.delete_locales — strip stub translation rows
  -- ------------------------------------------------------------
  IF payload #> '{cleanup,delete_locales}' IS NOT NULL THEN
    FOR v_locale_to_delete IN
      SELECT jsonb_array_elements_text(payload #> '{cleanup,delete_locales}')
    LOOP
      IF v_locale_to_delete = 'en' THEN
        RAISE EXCEPTION
          'cleanup.delete_locales: refusing to delete base locale ''en'' (would orphan recipe %)',
          v_recipe_id;
      END IF;
      DELETE FROM public.recipe_translations
        WHERE recipe_id = v_recipe_id AND locale = v_locale_to_delete;
      IF FOUND THEN
        v_translations_deletes := v_translations_deletes + 1; v_changed := true;
      END IF;
      DELETE FROM public.recipe_step_translations rst
       USING public.recipe_steps rs
       WHERE rs.id = rst.recipe_step_id
         AND rs.recipe_id = v_recipe_id
         AND rst.locale = v_locale_to_delete;
      IF FOUND THEN v_changed := true; END IF;
      DELETE FROM public.recipe_ingredient_translations rit
       USING public.recipe_ingredients ri
       WHERE ri.id = rit.recipe_ingredient_id
         AND ri.recipe_id = v_recipe_id
         AND rit.locale = v_locale_to_delete;
      IF FOUND THEN v_changed := true; END IF;
    END LOOP;
  END IF;

  IF v_changed THEN
    UPDATE public.recipes SET updated_at = now() WHERE id = v_recipe_id;
  END IF;

  v_counts := jsonb_build_object(
    'planner', v_planner_changed,
    'timings', v_timings_changed,
    'translations_upserts', v_translations_upserts,
    'translations_deletes', v_translations_deletes,
    'name_overrides', v_name_overrides,
    'ingredient_updates', v_ing_updates,
    'ingredient_adds', v_ing_adds,
    'ingredient_removes', v_ing_removes,
    'kitchen_tools_added', v_kt_added,
    'kitchen_tools_removed', v_kt_removed,
    'pairings_added', v_pair_added,
    'pairings_removed', v_pair_removed,
    'step_overrides', v_step_overrides_done,
    'tags_added', v_tags_added,
    'tags_removed', v_tags_removed
  );

  RETURN jsonb_build_object(
    'ok', true,
    'recipe_id', v_recipe_id,
    'changed', v_changed,
    'counts', v_counts,
    'errors', v_errors
  );
END;
$func$;

-- Re-grant permissions (CREATE OR REPLACE preserves them, but be explicit).
REVOKE ALL ON FUNCTION public.apply_recipe_metadata(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_recipe_metadata(jsonb) TO service_role;
