create table public.voice_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_minutes_limit integer not null,
  reason text,
  granted_by uuid references auth.users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_quotas enable row level security;

create policy "Users can read own quota"
on public.voice_quotas
for select
using ((select auth.uid()) = user_id);
