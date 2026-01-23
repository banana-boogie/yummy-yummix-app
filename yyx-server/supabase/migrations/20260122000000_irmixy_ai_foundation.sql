-- Irmixy AI Foundation Tables
-- Migration for Phase 1: ingredient normalization, allergen filtering, food safety, cooking sessions

-- ============================================================================
-- Ingredient Aliases (Bilingual Normalization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ingredient_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical TEXT NOT NULL,
  alias TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'es')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(alias, language)
);

CREATE INDEX idx_ingredient_aliases_alias ON public.ingredient_aliases(alias);
CREATE INDEX idx_ingredient_aliases_canonical ON public.ingredient_aliases(canonical);

-- RLS: Public read access (reference data)
ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredient_aliases_public_read" ON public.ingredient_aliases
  FOR SELECT USING (true);

-- Seed data for common ingredients
INSERT INTO public.ingredient_aliases (canonical, alias, language) VALUES
  -- Bell pepper
  ('bell_pepper', 'bell pepper', 'en'),
  ('bell_pepper', 'capsicum', 'en'),
  ('bell_pepper', 'sweet pepper', 'en'),
  ('bell_pepper', 'pimiento', 'es'),
  ('bell_pepper', 'pimentón', 'es'),
  ('bell_pepper', 'pimiento morrón', 'es'),

  -- Cilantro/Coriander
  ('coriander', 'cilantro', 'en'),
  ('coriander', 'coriander', 'en'),
  ('coriander', 'coriander leaves', 'en'),
  ('coriander', 'cilantro', 'es'),
  ('coriander', 'culantro', 'es'),

  -- Zucchini
  ('zucchini', 'zucchini', 'en'),
  ('zucchini', 'courgette', 'en'),
  ('zucchini', 'calabacín', 'es'),
  ('zucchini', 'calabacita', 'es'),

  -- Eggplant
  ('eggplant', 'eggplant', 'en'),
  ('eggplant', 'aubergine', 'en'),
  ('eggplant', 'berenjena', 'es'),

  -- Green onion
  ('green_onion', 'scallion', 'en'),
  ('green_onion', 'spring onion', 'en'),
  ('green_onion', 'green onion', 'en'),
  ('green_onion', 'cebollín', 'es'),
  ('green_onion', 'cebolla de verdeo', 'es'),
  ('green_onion', 'cebolleta', 'es'),

  -- Chicken
  ('chicken', 'chicken', 'en'),
  ('chicken', 'pollo', 'es'),

  -- Beef
  ('beef', 'beef', 'en'),
  ('beef', 'carne de res', 'es'),
  ('beef', 'res', 'es'),

  -- Pork
  ('pork', 'pork', 'en'),
  ('pork', 'cerdo', 'es'),
  ('pork', 'puerco', 'es'),

  -- Fish
  ('salmon', 'salmon', 'en'),
  ('salmon', 'salmón', 'es'),
  ('tuna', 'tuna', 'en'),
  ('tuna', 'atún', 'es'),

  -- Common ingredients
  ('rice', 'rice', 'en'),
  ('rice', 'arroz', 'es'),
  ('garlic', 'garlic', 'en'),
  ('garlic', 'ajo', 'es'),
  ('onion', 'onion', 'en'),
  ('onion', 'cebolla', 'es'),
  ('tomato', 'tomato', 'en'),
  ('tomato', 'tomate', 'es')
ON CONFLICT (alias, language) DO NOTHING;

-- ============================================================================
-- Allergen Groups (Rule-Based Filtering)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.allergen_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  ingredient_canonical TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(category, ingredient_canonical)
);

CREATE INDEX idx_allergen_groups_category ON public.allergen_groups(category);
CREATE INDEX idx_allergen_groups_ingredient ON public.allergen_groups(ingredient_canonical);

-- RLS: Public read access
ALTER TABLE public.allergen_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allergen_groups_public_read" ON public.allergen_groups
  FOR SELECT USING (true);

-- Seed allergen data
INSERT INTO public.allergen_groups (category, ingredient_canonical, name_en, name_es) VALUES
  -- Nuts
  ('nuts', 'almond', 'almond', 'almendra'),
  ('nuts', 'peanut', 'peanut', 'cacahuate'),
  ('nuts', 'walnut', 'walnut', 'nuez'),
  ('nuts', 'cashew', 'cashew', 'anacardo'),
  ('nuts', 'pecan', 'pecan', 'pacana'),
  ('nuts', 'hazelnut', 'hazelnut', 'avellana'),
  ('nuts', 'pistachio', 'pistachio', 'pistacho'),
  ('nuts', 'macadamia', 'macadamia', 'macadamia'),

  -- Dairy
  ('dairy', 'milk', 'milk', 'leche'),
  ('dairy', 'cheese', 'cheese', 'queso'),
  ('dairy', 'butter', 'butter', 'mantequilla'),
  ('dairy', 'cream', 'cream', 'crema'),
  ('dairy', 'yogurt', 'yogurt', 'yogur'),
  ('dairy', 'sour_cream', 'sour cream', 'crema agria'),

  -- Gluten
  ('gluten', 'wheat', 'wheat', 'trigo'),
  ('gluten', 'flour', 'flour', 'harina'),
  ('gluten', 'bread', 'bread', 'pan'),
  ('gluten', 'pasta', 'pasta', 'pasta'),
  ('gluten', 'barley', 'barley', 'cebada'),
  ('gluten', 'rye', 'rye', 'centeno'),

  -- Eggs
  ('eggs', 'egg', 'egg', 'huevo'),
  ('eggs', 'mayonnaise', 'mayonnaise', 'mayonesa'),

  -- Seafood
  ('seafood', 'fish', 'fish', 'pescado'),
  ('seafood', 'shrimp', 'shrimp', 'camarón'),
  ('seafood', 'lobster', 'lobster', 'langosta'),
  ('seafood', 'crab', 'crab', 'cangrejo'),
  ('seafood', 'salmon', 'salmon', 'salmón'),
  ('seafood', 'tuna', 'tuna', 'atún'),
  ('seafood', 'shellfish', 'shellfish', 'marisco')
ON CONFLICT (category, ingredient_canonical) DO NOTHING;

-- ============================================================================
-- Food Safety Rules (Temperature & Time Validation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.food_safety_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_canonical TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  min_temp_c INTEGER NOT NULL,
  min_temp_f INTEGER NOT NULL,
  min_cook_min INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_food_safety_ingredient ON public.food_safety_rules(ingredient_canonical);

-- RLS: Public read access
ALTER TABLE public.food_safety_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_safety_rules_public_read" ON public.food_safety_rules
  FOR SELECT USING (true);

-- Seed USDA safety rules
INSERT INTO public.food_safety_rules (ingredient_canonical, category, min_temp_c, min_temp_f, min_cook_min) VALUES
  ('chicken', 'poultry', 74, 165, 10),
  ('turkey', 'poultry', 74, 165, 10),
  ('duck', 'poultry', 74, 165, 10),
  ('ground_beef', 'ground_meat', 71, 160, 8),
  ('ground_pork', 'ground_meat', 71, 160, 8),
  ('ground_turkey', 'ground_meat', 74, 165, 8),
  ('beef', 'whole_meat', 63, 145, 10),
  ('pork', 'whole_meat', 63, 145, 10),
  ('lamb', 'whole_meat', 63, 145, 10),
  ('salmon', 'fish', 63, 145, 8),
  ('tuna', 'fish', 63, 145, 8),
  ('fish', 'fish', 63, 145, 8)
ON CONFLICT (ingredient_canonical) DO NOTHING;

-- ============================================================================
-- Cooking Sessions (Progress Tracking & Resume)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cooking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL,
  recipe_type TEXT NOT NULL CHECK (recipe_type IN ('custom', 'database')),
  recipe_name TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed BOOLEAN NOT NULL DEFAULT false,
  abandoned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_cooking_sessions_user ON public.cooking_sessions(user_id);
CREATE INDEX idx_cooking_sessions_active ON public.cooking_sessions(user_id, completed, abandoned) WHERE NOT completed AND NOT abandoned;
CREATE INDEX idx_cooking_sessions_last_active ON public.cooking_sessions(last_active_at);

-- RLS: Users can only access their own sessions
ALTER TABLE public.cooking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cooking_sessions_user_policy" ON public.cooking_sessions
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_cooking_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cooking_sessions_updated_at
  BEFORE UPDATE ON public.cooking_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_cooking_session_updated_at();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to mark stale cooking sessions as abandoned (called by cron or on-demand)
CREATE OR REPLACE FUNCTION mark_stale_cooking_sessions()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.cooking_sessions
  SET abandoned = true
  WHERE NOT completed
    AND NOT abandoned
    AND last_active_at < (now() - INTERVAL '24 hours');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_stale_cooking_sessions() TO authenticated;

COMMENT ON TABLE public.ingredient_aliases IS 'Bilingual ingredient name normalization for search and allergen matching';
COMMENT ON TABLE public.allergen_groups IS 'Rule-based allergen categories with bilingual names for reliable filtering';
COMMENT ON TABLE public.food_safety_rules IS 'USDA food safety minimum temperatures and cooking times';
COMMENT ON TABLE public.cooking_sessions IS 'User cooking progress tracking for resume functionality';
