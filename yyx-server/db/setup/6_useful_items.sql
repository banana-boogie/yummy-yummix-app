-- Create the useful_items table
CREATE TABLE useful_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX useful_items_name_en_idx ON useful_items (name_en);
CREATE INDEX useful_items_name_es_idx ON useful_items (name_es);

-- Create the recipe_useful_items join table
CREATE TABLE recipe_useful_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  useful_item_id UUID REFERENCES useful_items(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  notes_en TEXT DEFAULT '',
  notes_es TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for the join table
CREATE INDEX recipe_useful_items_recipe_id_idx ON recipe_useful_items (recipe_id);
CREATE INDEX recipe_useful_items_useful_item_id_idx ON recipe_useful_items (useful_item_id); 