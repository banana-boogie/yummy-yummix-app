-- First, let's modify the recipe_steps table to handle progressive speed
ALTER TABLE recipe_steps 
ADD COLUMN thermomix_speed_start INTEGER,
ADD COLUMN thermomix_speed_end INTEGER;

-- Then create our migration function
CREATE OR REPLACE FUNCTION migrate_recipe_steps()
RETURNS void AS $$
DECLARE
    r RECORD;
    step RECORD;
    step_id UUID;
    speed_value JSONB;
BEGIN
    -- Loop through each recipe
    FOR r IN SELECT id, steps FROM recipes WHERE steps IS NOT NULL
    LOOP
        -- For each step in the JSON array
        FOR step IN SELECT * FROM jsonb_array_elements(r.steps) WITH ORDINALITY AS s(step_data, step_number)
        LOOP
            -- Get speed value for processing
            speed_value := step.step_data->'thermomix'->'speed';

            -- Insert into recipe_steps
            INSERT INTO recipe_steps (
                recipe_id,
                order_number,
                instruction_en,
                instruction_es,
                thermomix_time,
                thermomix_speed,
                thermomix_speed_start,
                thermomix_speed_end,
                thermomix_temperature,
                section_en,
                section_es
            )
            VALUES (
                r.id,
                (step.step_data->>'order')::integer,
                step.step_data->'translations'->'en'->>'instruction',
                step.step_data->'translations'->'es'->>'instruction',
                (step.step_data->'thermomix'->>'time')::integer,
                CASE 
                    WHEN jsonb_typeof(speed_value) = 'number' 
                    THEN speed_value::integer 
                    ELSE NULL 
                END,
                CASE 
                    WHEN jsonb_typeof(speed_value) = 'object' 
                    THEN (speed_value->>'start')::integer 
                    ELSE NULL 
                END,
                CASE 
                    WHEN jsonb_typeof(speed_value) = 'object' 
                    THEN (speed_value->>'end')::integer 
                    ELSE NULL 
                END,
                (step.step_data->'thermomix'->>'temperature')::integer,
                step.step_data->'translations'->'en'->>'section',
                step.step_data->'translations'->'es'->>'section'
            )
            RETURNING id INTO step_id;

            -- Insert step ingredients
            -- We'll need to match ingredient names to IDs
            INSERT INTO recipe_step_ingredients (
                recipe_step_id,
                ingredient_id,
                quantity,
                measurement_unit_id
            )
            SELECT 
                step_id,
                i.id,
                ri.quantity,  -- This will need adjustment if quantities differ per step
                ri.measurement_unit_id
            FROM jsonb_array_elements_text(step.step_data->'translations'->'en'->'ingredients') AS ing(name)
            JOIN ingredients i ON LOWER(i.name_en) = LOWER(ing.name)
            JOIN recipe_ingredients ri ON ri.recipe_id = r.id AND ri.ingredient_id = i.id;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
BEGIN;
    SELECT migrate_recipe_steps();
    -- Optionally, after verifying the migration:
    -- ALTER TABLE recipes DROP COLUMN steps;
COMMIT;

-- Clean up
DROP FUNCTION migrate_recipe_steps();