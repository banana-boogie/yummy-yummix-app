-- Cooking Sessions Table
-- Tracks user cooking progress for resume functionality
-- Per irmixy-completion-plan.md Sections 5.3, 5.4

create table if not exists public.cooking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null,
  recipe_type text not null check (recipe_type in ('custom', 'database')),
  current_step integer not null default 0,
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
