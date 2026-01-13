-- Create the recipes table
create table recipes (
  id uuid primary key default uuid_generate_v4(), -- Unique ID for the recipe
  name text not null unique, -- Name of the recipe
  picture_url text, -- Link to the display picture
  is_published boolean default false, -- Whether the recipe is published
  difficulty text  -- Difficulty level
  prep_time integer, -- Preparation time in minutes
  total_time integer, -- Total time in minutes
  portions integer, -- Number of servings
  useful_items text, -- Optional description of useful items
  nutritional_value jsonb, -- Nutritional value as JSON (calories, protein, carbs, fat, etc.)  
  tips_and_tricks text, -- Optional tips and tricks
  created_at timestamptz default now() not null, -- Timestamp of when the recipe was created
  updated_at timestamptz default now() not null -- Timestamp of when the recipe was last updated
);


-- Create an index on the difficulty column to allow for fast filtering by difficulty
create index difficulty_idx on recipes (difficulty);
