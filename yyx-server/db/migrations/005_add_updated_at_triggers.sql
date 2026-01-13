-- Create the moddatetime extension if it doesn't exist
create extension if not exists "moddatetime";

-- Add triggers for all tables
create trigger handle_updated_at
  before update on public.ingredients
  for each row
  execute procedure moddatetime (updated_at);

create trigger handle_updated_at
  before update on public.measurement_units
  for each row
  execute procedure moddatetime (updated_at);

create trigger handle_updated_at
  before update on public.recipe_ingredients
  for each row
  execute procedure moddatetime (updated_at);

create trigger handle_updated_at
  before update on public.recipe_step_ingredients
  for each row
  execute procedure moddatetime (updated_at);

create trigger handle_updated_at
  before update on public.recipe_steps
  for each row
  execute procedure moddatetime (updated_at);

create trigger handle_updated_at
  before update on public.recipe_tags
  for each row
  execute procedure moddatetime (updated_at);

create trigger handle_updated_at
  before update on public.recipe_to_tag
  for each row
  execute procedure moddatetime (updated_at);

create trigger handle_updated_at
  before update on public.recipes
  for each row
  execute procedure moddatetime (updated_at);

-- In case we need to rollback
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.ingredients;
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.measurement_units;
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.recipe_ingredients;
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.recipe_step_ingredients;
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.recipe_steps;
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.recipe_tags;
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.recipe_to_tag;
-- DROP TRIGGER IF EXISTS handle_updated_at ON public.recipes; 