-- Cooking Sessions Table
-- Tracks user cooking progress for resume functionality
-- Per irmixy-completion-plan.md Sections 5.3, 5.4

create table if not exists public.cooking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null,
  recipe_type text not null check (recipe_type in ('custom', 'database')),
  recipe_name text,
  current_step integer not null default 1,
  total_steps integer not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one active session per user+recipe at a time
create unique index if not exists idx_cooking_sessions_one_active
on public.cooking_sessions (user_id, recipe_id)
where status = 'active';

-- Fast lookup for user's active/recent sessions
create index if not exists idx_cooking_sessions_user_status
on public.cooking_sessions (user_id, status);

-- RLS: users can only access their own sessions
alter table public.cooking_sessions enable row level security;

create policy cooking_sessions_user_policy
on public.cooking_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Function to mark stale sessions (>24h inactive) as abandoned
-- Called periodically or on session load
create or replace function public.mark_stale_cooking_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.cooking_sessions
  set
    status = 'abandoned',
    abandoned_at = now()
  where
    user_id = auth.uid()
    and status = 'active'
    and last_active_at < now() - interval '24 hours';

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on table public.cooking_sessions is
  'Tracks cooking progress per user+recipe for resume functionality. One active session per user+recipe.';

comment on function public.mark_stale_cooking_sessions() is
  'Marks active cooking sessions older than 24h as abandoned. Scoped to calling user via auth.uid().';

-- RPC: upsert progress for one active session per user+recipe
create or replace function public.upsert_cooking_session_progress(
  p_recipe_id uuid,
  p_recipe_type text,
  p_recipe_name text,
  p_current_step integer,
  p_total_steps integer
)
returns table (
  id uuid,
  recipe_id uuid,
  recipe_type text,
  recipe_name text,
  current_step integer,
  total_steps integer,
  status text,
  last_active_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_recipe_type not in ('custom', 'database') then
    raise exception 'Invalid recipe_type';
  end if;

  if p_current_step < 1 or p_total_steps < 1 or p_current_step > p_total_steps then
    raise exception 'Invalid progress payload';
  end if;

  -- First try updating an existing active session.
  return query
  update public.cooking_sessions
  set
    recipe_type = p_recipe_type,
    recipe_name = p_recipe_name,
    current_step = p_current_step,
    total_steps = p_total_steps,
    last_active_at = now()
  where user_id = v_user_id
    and recipe_id = p_recipe_id
    and status = 'active'
  returning
    cooking_sessions.id,
    cooking_sessions.recipe_id,
    cooking_sessions.recipe_type,
    cooking_sessions.recipe_name,
    cooking_sessions.current_step,
    cooking_sessions.total_steps,
    cooking_sessions.status,
    cooking_sessions.last_active_at;

  if found then
    return;
  end if;

  -- No active session exists. Insert one; if raced, retry update.
  begin
    return query
    insert into public.cooking_sessions (
      user_id,
      recipe_id,
      recipe_type,
      recipe_name,
      current_step,
      total_steps,
      status,
      started_at,
      last_active_at
    )
    values (
      v_user_id,
      p_recipe_id,
      p_recipe_type,
      p_recipe_name,
      p_current_step,
      p_total_steps,
      'active',
      now(),
      now()
    )
    returning
      cooking_sessions.id,
      cooking_sessions.recipe_id,
      cooking_sessions.recipe_type,
      cooking_sessions.recipe_name,
      cooking_sessions.current_step,
      cooking_sessions.total_steps,
      cooking_sessions.status,
      cooking_sessions.last_active_at;
  exception
    when unique_violation then
      return query
      update public.cooking_sessions
      set
        recipe_type = p_recipe_type,
        recipe_name = p_recipe_name,
        current_step = p_current_step,
        total_steps = p_total_steps,
        last_active_at = now()
      where user_id = v_user_id
        and recipe_id = p_recipe_id
        and status = 'active'
      returning
        cooking_sessions.id,
        cooking_sessions.recipe_id,
        cooking_sessions.recipe_type,
        cooking_sessions.recipe_name,
        cooking_sessions.current_step,
        cooking_sessions.total_steps,
        cooking_sessions.status,
        cooking_sessions.last_active_at;
  end;
end;
$$;

comment on function public.upsert_cooking_session_progress(uuid, text, text, integer, integer) is
  'Upserts active cooking session progress for auth.uid() and returns the active row.';
