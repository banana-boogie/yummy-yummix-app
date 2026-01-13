CREATE TYPE recipe_tag_category AS ENUM (
  'INGREDIENTS',
  'OILS_AND_FATS',
  'GENERAL',
  'CULTURAL_CUISINE',
  'FRUITS',
  'VEGETABLES',
  'HERBS_AND_SPICES',
  'DIETARY_RESTRICTIONS',  -- renamed from "Allergens restrictions and dietary needs" for consistency
  'GRAINS_AND_STARCHES',
  'DAIRY_AND_ALTERNATIVES',
  'HOLIDAY',
  'PROTEINS',
  'NUTS_AND_SEEDS',
  'LEGUMES',
  'SWEETENERS_AND_BAKING',
  'LIQUID'
);

CREATE TABLE recipe_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en TEXT UNIQUE NOT NULL, -- Unique tag name (e.g., "Vegetarian", "Quick", etc.)
  name_es TEXT UNIQUE NOT NULL, -- Unique tag name in Spanish (e.g., "Vegetariano", "Rápido", etc.)
  category recipe_tag_category NOT NULL, -- Category of the tag (e.g., "Diet", "Time", etc.)
  created_at timestamptz default now() not null, -- Timestamp of when the tag was created
  updated_at timestamptz default now() not null -- Timestamp of when the tag was last updated
);

CREATE TABLE recipe_to_tag (
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tag_id UUID REFERENCES recipe_tags(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at timestamptz default now() not null, -- Timestamp of when the tag was created
  updated_at timestamptz default now() not null, -- Timestamp of when the tag was last updated
  PRIMARY KEY (recipe_id, tag_id)
);

