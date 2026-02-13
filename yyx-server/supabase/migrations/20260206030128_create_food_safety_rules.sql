-- Food Safety Rules Table
-- USDA-based cooking temperature and time requirements
-- Used to validate generated recipes meet safety standards

CREATE TABLE IF NOT EXISTS public.food_safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_canonical text NOT NULL UNIQUE,  -- Canonical ingredient name (e.g., "chicken")
  category text NOT NULL,                     -- Category for grouping (e.g., "poultry", "beef")
  min_temp_c integer NOT NULL,                -- Minimum internal temperature (Celsius)
  min_temp_f integer NOT NULL,                -- Minimum internal temperature (Fahrenheit)
  min_cook_min integer NOT NULL,              -- Minimum cooking time (minutes)
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (read-only for all authenticated users)
ALTER TABLE public.food_safety_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Food safety rules are readable by all authenticated users"
ON public.food_safety_rules FOR SELECT
TO authenticated
USING (true);

-- Index for fast lookups by ingredient
CREATE INDEX IF NOT EXISTS idx_food_safety_rules_ingredient
ON public.food_safety_rules (ingredient_canonical);

-- Seed USDA food safety guidelines
-- Source: https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-minimum-internal-temperatures
INSERT INTO public.food_safety_rules (ingredient_canonical, category, min_temp_c, min_temp_f, min_cook_min) VALUES
  -- Poultry (highest risk - 74°C/165°F)
  ('chicken', 'poultry', 74, 165, 15),
  ('turkey', 'poultry', 74, 165, 20),
  ('duck', 'poultry', 74, 165, 20),

  -- Ground meats (70°C/160°F)
  ('ground_beef', 'ground_meat', 70, 160, 10),
  ('ground_pork', 'ground_meat', 70, 160, 10),
  ('ground_lamb', 'ground_meat', 70, 160, 10),

  -- Whole cuts of beef, pork, lamb, veal (63°C/145°F with 3 min rest)
  ('beef', 'red_meat', 63, 145, 10),
  ('pork', 'red_meat', 63, 145, 10),
  ('lamb', 'red_meat', 63, 145, 10),
  ('veal', 'red_meat', 63, 145, 10),

  -- Seafood (63°C/145°F)
  ('fish', 'seafood', 63, 145, 8),
  ('shrimp', 'seafood', 63, 145, 5),
  ('lobster', 'seafood', 63, 145, 8),
  ('crab', 'seafood', 63, 145, 8),

  -- Eggs (71°C/160°F for dishes with eggs)
  ('egg', 'eggs', 71, 160, 5)
ON CONFLICT (ingredient_canonical) DO NOTHING;

COMMENT ON TABLE public.food_safety_rules IS
  'USDA-based minimum cooking temperatures and times for food safety validation';
