-- Create ENUM type for valid Thermomix temperatures
CREATE TYPE thermomix_temperature_type AS ENUM (
  -- Celsius values as strings
  '37', '40', '45', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '98', '100', '105', '110', '115', '120', 'Varoma',
  -- Fahrenheit values as strings (ensure no duplicates)
  '130', '140', '150', '160', '170', '175', '185', '195', '200', '205', '212', '220', '230', '240', '250'
);

-- Create ENUM type for valid Thermomix speeds
CREATE TYPE thermomix_speed_type AS ENUM (
  'spoon', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', 
  '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'
);

-- Create recipe_steps table
CREATE TABLE recipe_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    order INTEGER NOT NULL,
    instruction_en TEXT NOT NULL,
    instruction_es TEXT NOT NULL,
    thermomix_time INTEGER,
    thermomix_speed thermomix_speed_type,
    thermomix_temperature thermomix_temperature_type,
    thermomix_is_blade_reversed BOOLEAN,
    section_en TEXT,
    section_es TEXT,
    tip_en TEXT,
    tip_es TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(recipe_id, order_number)
);

-- Create recipe_step_ingredients table
CREATE TABLE recipe_step_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_order INTEGER NOT NULL,
    optional BOOLEAN NOT NULL DEFAULT FALSE,
    quantity DECIMAL NOT NULL,
    recipe_step_id UUID REFERENCES recipe_steps(id) ON DELETE CASCADE ON UPDATE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE ON UPDATE CASCADE,
    measurement_unit_id TEXT REFERENCES measurement_units(id) ON DELETE SET NULL  ON UPDATE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(recipe_step_id, ingredient_id)
);

-- Create indexes for better query performance
CREATE INDEX recipe_steps_recipe_id_idx ON recipe_steps(recipe_id);
CREATE INDEX recipe_steps_order_number_idx ON recipe_steps(recipe_id, order_number);
CREATE INDEX recipe_step_ingredients_id_idx ON recipe_step_ingredients(recipe_step_id);