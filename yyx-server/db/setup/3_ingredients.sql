create table measurement_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text not null,
  system text not null,
  symbol_en text not null,
  name_en text not null,
  name_en_plural text not null,
  symbol_es text not null,
  name_es text not null,
  name_es_plural text not null,
  updated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
) -- Create the ingredients table
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plural_name TEXT NOT NULL,
  picture_url TEXT,
  nutritional_facts JSONB NOT NULL DEFAULT '{}' :: jsonb,
  -- per 100g or 100ml
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX ingredients_name_idx ON ingredients (name);

-- Create the recipe_ingredients join table
create table recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE ON UPDATE CASCADE,
  quantity numeric(10, 2) null,
  recipe_section_en text not null default 'Main' :: text,
  display_order integer null,
  optional boolean null default false,
  notes_en text null,
  notes_es text null,
  measurement_unit_id UUID REFERENCES measurement_units(id) ON DELETE CASCADE ON UPDATE CASCADE,
  recipe_section_es text not null default 'Principal' :: text,
  tip_en text null,
  tip_es text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint recipe_ingredients_pkey primary key (id)
)