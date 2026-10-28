/*
 * Functions the browser calls (milestone 1): the only way the app reads or writes data.
 *
 * Every function runs as its owner (security definer) with an empty search path and fully qualified
 * names, works only on the caller's own data (auth.uid()), and never returns email, first name, last
 * name or date of birth (US-01 AC8). Points and limits come from public.actions, never from the
 * browser (US-03 AC2, AC4). Errors use fixed messages that frontend/src/lib/errors.js turns into text:
 * not_authenticated, not_found, unknown_action, daily_limit_reached.
 */

/* Register form: is this nickname still free? Case-insensitive, after trimming (US-01 AC3). */
create function public.nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.users u
    where lower(u.nickname) = lower(private.trim_edges(coalesce(p_nickname, '')))
  )
$$;

/*
 * Home (US-02, US-04): the caller's nickname, total points, points today, points this week (Monday to
 * Sunday, Zürich), current streak, and total CO2 grams saved (shown from milestone 2, US-14).
 * Every value is computed from the caller's log entries, so it always equals what is stored.
 */
create function public.get_my_status()
returns table (
  nickname text,
  total_points integer,
  today_points integer,
  week_points integer,
  streak integer,
  co2_saved_g bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_today date := private.zurich_today();
  v_week_start date := private.week_start(private.zurich_today());
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select
    u.nickname,
    coalesce((select sum(l.points) from public.action_logs l where l.user_id = u.id), 0)::integer,
    coalesce((select sum(l.points) from public.action_logs l
              where l.user_id = u.id and l.local_date_zurich = v_today), 0)::integer,
    coalesce((select sum(l.points) from public.action_logs l
              where l.user_id = u.id and l.local_date_zurich between v_week_start and v_week_start + 6), 0)::integer,
    private.streak(u.id, v_today),
    coalesce((select sum(l.co2_g) from public.action_logs l where l.user_id = u.id), 0)::bigint
  from public.users u
  where u.id = v_user;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

/* Log screen (US-03 AC1, US-14 AC2): active actions in file order, with how often the caller logged each today. */
create function public.get_log_actions()
returns table (
  key text,
  label text,
  points integer,
  daily_limit integer,
  co2_g integer,
  used_today integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_today date := private.zurich_today();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select
    a.key,
    a.label,
    a.points,
    a.daily_limit,
    a.co2_g,
    (select count(*)::integer from public.action_logs l
     where l.user_id = v_user and l.action_key = a.key and l.local_date_zurich = v_today)
  from public.actions a
  where a.active
  order by a.position, a.key;
end;
$$;

/*
 * Logs one action for the caller (US-03 AC2, AC4; US-04). Locks the caller's profile row first, so two
 * quick taps are handled one after the other and can't both pass the daily limit. At the limit it
 * raises daily_limit_reached and adds nothing. Returns the points added, the new totals and streak,
 * whether the streak went up with this log, and the action's use today.
 */
create function public.log_action(p_action_key text)
returns table (
  points_added integer,
  total_points integer,
  today_points integer,
  streak integer,
  streak_increased boolean,
  used_today integer,
  daily_limit integer,
  co2_g integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_today date;
  v_action public.actions%rowtype;
  v_used integer;
  v_streak_before integer;
  v_streak_after integer;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  perform 1 from public.users u where u.id = v_user for update;
  if not found then
    raise exception 'not_found';
  end if;

  v_today := private.zurich_today();
  select * into v_action from public.actions a where a.key = p_action_key and a.active;
  if not found then
    raise exception 'unknown_action';
  end if;

  select count(*)::integer into v_used
  from public.action_logs l
  where l.user_id = v_user and l.action_key = v_action.key and l.local_date_zurich = v_today;
  if v_used >= v_action.daily_limit then
    raise exception 'daily_limit_reached';
  end if;

  v_streak_before := private.streak(v_user, v_today);
  insert into public.action_logs (user_id, action_key, points, co2_g)
  values (v_user, v_action.key, v_action.points, v_action.co2_g);
  v_streak_after := private.streak(v_user, v_today);

  return query
  select
    v_action.points,
    coalesce((select sum(l.points) from public.action_logs l where l.user_id = v_user), 0)::integer,
    coalesce((select sum(l.points) from public.action_logs l
              where l.user_id = v_user and l.local_date_zurich = v_today), 0)::integer,
    v_streak_after,
    v_streak_after > v_streak_before,
    v_used + 1,
    v_action.daily_limit,
    v_action.co2_g;
end;
$$;

/*
 * Privileges: Supabase grants EXECUTE on new functions to anon and authenticated by default, so revoke
 * everything first, then grant exactly what each function needs.
 */
revoke all on function public.nickname_available(text) from public, anon, authenticated;
revoke all on function public.get_my_status() from public, anon, authenticated;
revoke all on function public.get_log_actions() from public, anon, authenticated;
revoke all on function public.log_action(text) from public, anon, authenticated;

grant execute on function public.nickname_available(text) to anon, authenticated;
grant execute on function public.get_my_status() to authenticated;
grant execute on function public.get_log_actions() to authenticated;
grant execute on function public.log_action(text) to authenticated;
