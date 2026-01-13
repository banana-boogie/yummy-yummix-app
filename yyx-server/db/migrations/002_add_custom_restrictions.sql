-- Create a type for the source of custom restriction
create type custom_restriction_type as enum (
  'allergy',
  'diet'
);

-- Create table for custom restrictions
create table public.user_custom_restrictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type custom_restriction_type not null,
  value text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_custom_restrictions enable row level security;

-- RLS policies
create policy "Users can view own custom restrictions" 
  on public.user_custom_restrictions for select 
  using (auth.uid() = user_id);

create policy "Users can insert own custom restrictions" 
  on public.user_custom_restrictions for insert 
  using (auth.uid() = user_id);

create policy "Users can delete own custom restrictions" 
  on public.user_custom_restrictions for delete 
  using (auth.uid() = user_id);

-- Add trigger for updated_at
create trigger handle_updated_at
  before update on public.user_custom_restrictions
  for each row
  execute procedure moddatetime (updated_at);

-- Add columns for custom restrictions
alter table public.user_profiles
add column custom_allergy text,
add column custom_diet text; 