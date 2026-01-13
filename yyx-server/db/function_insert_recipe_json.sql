-- First drop existing functions
DROP FUNCTION IF EXISTS insert_recipe_from_json(jsonb);
DROP FUNCTION IF EXISTS insert_recipe(text,jsonb,text,text,text,integer,integer,text,text,jsonb,text,text[],jsonb);

-- Helper function for Spanish pluralization
CREATE OR REPLACE FUNCTION pluralize_spanish(singular TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        -- Words ending in z change z to ces
        WHEN singular ~ 'z$' THEN 
            regexp_replace(singular, 'z$', 'ces')
        
        -- Words ending in ión change to iones
        WHEN singular ~ 'ión$' THEN 
            regexp_replace(singular, 'ión$', 'iones')
            
        -- Words ending in á, é, í, ó, ú add s
        WHEN singular ~ '[áéíóú]$' THEN 
            singular || 's'
            
        -- Words ending in s or x remain unchanged if they're already plural
        WHEN singular ~ '[sx]$' AND singular !~ '(ís|és)$' THEN 
            singular
            
        -- Words ending in vocal + y add es (rey -> reyes)
        WHEN singular ~ '[aeiou]y$' THEN 
            regexp_replace(singular, 'y$', 'yes')
            
        -- Words ending in consonant + y just add es
        WHEN singular ~ 'y$' THEN 
            singular || 'es'
            
        -- Words ending in vowels just add s
        WHEN singular ~ '[aeiouáéíóú]$' THEN 
            singular || 's'
            
        -- Words ending in n or s add es
        WHEN singular ~ '[ns]$' THEN 
            singular || 'es'
            
        -- Words ending in other consonants add es
        WHEN singular ~ '[bcdfghjklmnpqrstvwxyz]$' THEN 
            singular || 'es'
            
        -- Default case: add s
        ELSE 
            singular || 's'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main recipe insert function
CREATE OR REPLACE FUNCTION insert_recipe(
    p_name TEXT,
    p_steps JSONB,
    p_picture_url TEXT,
    p_difficulty TEXT,
    p_prep_time INTEGER,
    p_total_time INTEGER,
    p_portions TEXT,
    p_useful_items TEXT,
    p_nutritional_facts JSONB,
    p_tips_and_tricks TEXT,
    p_tags TEXT[],
    p_ingredients JSONB
) RETURNS recipes AS $$
DECLARE
    v_recipe_id UUID;
    v_recipe recipes%ROWTYPE;
BEGIN
    -- Insert into recipes table
    INSERT INTO recipes (
        name,
        steps,
        picture_url,
        difficulty,
        prep_time,
        total_time,
        portions,
        useful_items,
        nutritional_facts,
        tips_and_tricks
    ) VALUES (
        p_name,
        p_steps,
        p_picture_url,
        p_difficulty,
        p_prep_time,
        p_total_time,
        p_portions,
        p_useful_items,
        p_nutritional_facts,
        p_tips_and_tricks
    ) RETURNING * INTO v_recipe;

    -- Insert tags
    INSERT INTO recipe_tags (name)
    SELECT DISTINCT unnest(p_tags)
    ON CONFLICT (name) DO NOTHING;

    -- Link tags to recipe
    INSERT INTO recipe_to_tag (recipe_id, tag_id)
    SELECT v_recipe.id, id
    FROM recipe_tags
    WHERE name = ANY(p_tags);

    -- Insert ingredients with smart pluralization
WITH ingredient_inserts AS (
        SELECT DISTINCT 
            (ingredient_data->>'name')::TEXT as name,
            COALESCE(
                (ingredient_data->>'plural_name')::TEXT,
                pluralize_spanish((ingredient_data->>'name')::TEXT)
            ) as plural_name,
            COALESCE(
                (ingredient_data->>'base_unit')::TEXT,
                (ingredient_data->>'unit')::TEXT,
                'unidad'  -- default value if neither base_unit nor unit is provided
            )::measurement_unit as base_unit
        FROM jsonb_array_elements(p_ingredients) as ingredient_data
    )
    INSERT INTO ingredients (name, plural_name, base_unit)
        SELECT name, plural_name, base_unit FROM ingredient_inserts
        ON CONFLICT (name) DO NOTHING;

    -- Link ingredients to recipe
    INSERT INTO recipe_ingredients (
        recipe_id,
        ingredient_id,
        quantity,
        unit,
        notes,
        component,
        display_order,
        optional
    )
    SELECT 
        v_recipe.id,
        i.id,
        (ingredient_data->>'quantity')::NUMERIC,
        (ingredient_data->>'unit')::measurement_unit,
        (ingredient_data->>'notes')::TEXT,
        (ingredient_data->>'component')::TEXT,
        (ingredient_data->>'display_order')::INTEGER,
        (ingredient_data->>'optional')::BOOLEAN
    FROM (
        SELECT jsonb_array_elements(p_ingredients) as ingredient_data
    ) ingredients_json
    JOIN ingredients i ON i.name = (ingredient_data->>'name')::TEXT;

    RETURN v_recipe;
END;
$$ LANGUAGE plpgsql;

-- JSON wrapper function remains the same
CREATE OR REPLACE FUNCTION insert_recipe_from_json(
    recipe_json JSONB
) RETURNS recipes AS $$
BEGIN
    RETURN insert_recipe(
        (recipe_json->>'name')::TEXT,
        (recipe_json->'steps')::JSONB,
        (recipe_json->>'display_picture_url')::TEXT,
        (recipe_json->>'difficulty')::TEXT,
        (recipe_json->>'prep_time')::INTEGER,
        (recipe_json->>'total_time')::INTEGER,
        (recipe_json->>'portions')::TEXT,
        (recipe_json->>'useful_items')::TEXT,
        (recipe_json->'nutritional_facts')::JSONB,
        (recipe_json->>'tips_and_tricks')::TEXT,
        ARRAY(SELECT jsonb_array_elements_text(recipe_json->'tags')),
        (recipe_json->'ingredients')::JSONB
    );
END;
$$ LANGUAGE plpgsql;