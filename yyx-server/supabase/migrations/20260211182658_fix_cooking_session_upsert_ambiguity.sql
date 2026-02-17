-- Fix: "column reference is ambiguous" in upsert_cooking_session_progress
--
-- The RETURNS TABLE output columns (recipe_id, status, etc.) clash with
-- the cooking_sessions table columns inside WHERE/RETURNING clauses.
-- Fix: use table aliases so PostgreSQL knows which columns we mean.

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

  -- Try updating an existing active session.
  return query
  update public.cooking_sessions cs
  set
    recipe_type = p_recipe_type,
    recipe_name = p_recipe_name,
    current_step = p_current_step,
    total_steps = p_total_steps,
    last_active_at = now()
  where cs.user_id = v_user_id
    and cs.recipe_id = p_recipe_id
    and cs.status = 'active'
  returning cs.id, cs.recipe_id, cs.recipe_type, cs.recipe_name,
    cs.current_step, cs.total_steps, cs.status, cs.last_active_at;

  if found then
    return;
  end if;

  -- No active session exists. Insert one; if raced, retry update.
  begin
    return query
    insert into public.cooking_sessions (
      user_id, recipe_id, recipe_type, recipe_name,
      current_step, total_steps, status, started_at, last_active_at
    )
    values (
      v_user_id, p_recipe_id, p_recipe_type, p_recipe_name,
      p_current_step, p_total_steps, 'active', now(), now()
    )
    returning
      cooking_sessions.id, cooking_sessions.recipe_id,
      cooking_sessions.recipe_type, cooking_sessions.recipe_name,
      cooking_sessions.current_step, cooking_sessions.total_steps,
      cooking_sessions.status, cooking_sessions.last_active_at;
  exception
    when unique_violation then
      return query
      update public.cooking_sessions cs2
      set
        recipe_type = p_recipe_type,
        recipe_name = p_recipe_name,
        current_step = p_current_step,
        total_steps = p_total_steps,
        last_active_at = now()
      where cs2.user_id = v_user_id
        and cs2.recipe_id = p_recipe_id
        and cs2.status = 'active'
      returning cs2.id, cs2.recipe_id, cs2.recipe_type, cs2.recipe_name,
        cs2.current_step, cs2.total_steps, cs2.status, cs2.last_active_at;
  end;
end;
$$;
