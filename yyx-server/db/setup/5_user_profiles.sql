-- Create enums for better type safety and data consistency
create type user_gender as enum (
  'male',
  'female', 
  'other',
  'preferNotToSay'
);

create type activity_level as enum (
  'sedentary',
  'lightlyActive',
  'moderatelyActive',
  'veryActive',
  'extraActive'
);

create type measurement_system as enum (
  'metric',
  'imperial'
);

create type dietary_restriction as enum (
  'none',
  'nuts',
  'dairy',
  'eggs',
  'seafood',
  'gluten',
  'other'
);

create type diet_type as enum (
  'none',
  'keto',
  'lactoVegetarian',
  'mediterranean',
  'ovoVegetarian',
  'paleo',
  'pescatarian',
  'sugarFree',
  'vegan',
  'vegetarian',
  'other'
);

-- Create the user profiles table
create table public.user_profiles (
  id uuid references auth.users(id) primary key,
  email text not null,
  name text check (length(name) <= 50),
  biography text check (length(biography) <= 150),
  gender user_gender,
  birth_date date,
  is_admin boolean default false,
  -- Store in metric units, handle conversion in application
  height numeric(5,2) check (height > 0 and height < 300), -- in cm
  weight numeric(5,2) check (weight > 0 and weight < 500), -- in kg
  activity_level activity_level,
  dietary_restrictions dietary_restriction[] default array[]::dietary_restriction[],
  other_allergy text[] default array[]::text[],
  diet_types diet_type[] default array[]::diet_type[],
  other_diet text[] default array[]::text[],
  measurement_system measurement_system default 'metric',
  language text default 'en',
  profile_iamge_url text,
  onboarding_complete boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_profiles enable row level security;

-- RLS policies
create policy "Users can view own profile" 
  on public.user_profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on public.user_profiles for update 
  using (auth.uid() = id);

create policy "Users can delete own profile" 
  on public.user_profiles for delete 
  using (auth.uid() = id);

-- Handle new user creation
create function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- First, create a generic trigger function that can be used by any table
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

-- Create an extension to help manage triggers across tables
create extension if not exists "moddatetime";

-- This will automatically create the trigger for any table that has an updated_at column
create trigger handle_updated_at
  before update on public.user_profiles
  for each row
  execute procedure moddatetime (updated_at);