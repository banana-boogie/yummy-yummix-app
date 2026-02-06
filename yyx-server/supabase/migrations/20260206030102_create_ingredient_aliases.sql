-- Ingredient Aliases Table
-- Maps alternate ingredient names (EN/ES) to canonical forms
-- Used for bilingual ingredient normalization in allergen checks

CREATE TABLE IF NOT EXISTS public.ingredient_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical text NOT NULL,           -- Canonical/standard form (e.g., "chicken")
  alias text NOT NULL,               -- Alternate name (e.g., "pollo", "chicken breast")
  language text NOT NULL CHECK (language IN ('en', 'es')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(alias, language)
);

-- Enable RLS (read-only for all authenticated users)
ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ingredient aliases are readable by all authenticated users"
ON public.ingredient_aliases FOR SELECT
TO authenticated
USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_alias_lang
ON public.ingredient_aliases (lower(alias), language);

-- Seed common EN/ES ingredient mappings
INSERT INTO public.ingredient_aliases (canonical, alias, language) VALUES
  -- Poultry
  ('chicken', 'chicken', 'en'),
  ('chicken', 'chicken breast', 'en'),
  ('chicken', 'chicken thigh', 'en'),
  ('chicken', 'chicken wing', 'en'),
  ('chicken', 'pollo', 'es'),
  ('chicken', 'pechuga de pollo', 'es'),
  ('chicken', 'muslo de pollo', 'es'),
  ('chicken', 'ala de pollo', 'es'),
  ('turkey', 'turkey', 'en'),
  ('turkey', 'turkey breast', 'en'),
  ('turkey', 'pavo', 'es'),
  ('turkey', 'pechuga de pavo', 'es'),

  -- Beef
  ('beef', 'beef', 'en'),
  ('beef', 'beef steak', 'en'),
  ('beef', 'ground beef', 'en'),
  ('beef', 'beef brisket', 'en'),
  ('beef', 'res', 'es'),
  ('beef', 'carne de res', 'es'),
  ('beef', 'bistec', 'es'),
  ('beef', 'carne molida', 'es'),

  -- Pork
  ('pork', 'pork', 'en'),
  ('pork', 'pork chop', 'en'),
  ('pork', 'pork loin', 'en'),
  ('pork', 'bacon', 'en'),
  ('pork', 'cerdo', 'es'),
  ('pork', 'chuleta de cerdo', 'es'),
  ('pork', 'lomo de cerdo', 'es'),
  ('pork', 'tocino', 'es'),

  -- Seafood
  ('fish', 'fish', 'en'),
  ('fish', 'salmon', 'en'),
  ('fish', 'tuna', 'en'),
  ('fish', 'cod', 'en'),
  ('fish', 'tilapia', 'en'),
  ('fish', 'pescado', 'es'),
  ('fish', 'salmón', 'es'),
  ('fish', 'atún', 'es'),
  ('fish', 'bacalao', 'es'),
  ('shrimp', 'shrimp', 'en'),
  ('shrimp', 'prawns', 'en'),
  ('shrimp', 'camarón', 'es'),
  ('shrimp', 'camarones', 'es'),
  ('shrimp', 'langostino', 'es'),

  -- Eggs
  ('egg', 'egg', 'en'),
  ('egg', 'eggs', 'en'),
  ('egg', 'huevo', 'es'),
  ('egg', 'huevos', 'es'),

  -- Dairy (for allergen checks)
  ('milk', 'milk', 'en'),
  ('milk', 'whole milk', 'en'),
  ('milk', 'leche', 'es'),
  ('milk', 'leche entera', 'es'),
  ('cheese', 'cheese', 'en'),
  ('cheese', 'queso', 'es'),
  ('butter', 'butter', 'en'),
  ('butter', 'mantequilla', 'es'),

  -- Common vegetables
  ('onion', 'onion', 'en'),
  ('onion', 'cebolla', 'es'),
  ('garlic', 'garlic', 'en'),
  ('garlic', 'ajo', 'es'),
  ('tomato', 'tomato', 'en'),
  ('tomato', 'tomatoes', 'en'),
  ('tomato', 'tomate', 'es'),
  ('tomato', 'jitomate', 'es')
ON CONFLICT (alias, language) DO NOTHING;

COMMENT ON TABLE public.ingredient_aliases IS
  'Bilingual ingredient name mappings for normalization in allergen/safety checks';
