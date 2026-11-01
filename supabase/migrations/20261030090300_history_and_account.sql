/*
 * My history and deleting my account (US-05, US-09; milestone 2).
 */

/*
 * My history (US-05 AC1): the caller's last 20 log entries, newest first, with the action's label,
 * the points and CO2 grams stored with the log, and the time in UTC (the app shows it in Zürich time).
 * Removed actions keep their label, because removed actions are only marked inactive.
 */
create function public.get_my_history()
returns table (id bigint, label text, points integer, co2_g integer, logged_at_utc timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select l.id, a.label, l.points, l.co2_g, l.logged_at_utc
  from public.action_logs l
  join public.actions a on a.key = l.action_key
  where l.user_id = v_user
  order by l.logged_at_utc desc, l.id desc
  limit 20;
end;
$$;

/*
 * Deletes the caller's account (US-09 AC1, AC2): the login (auth.users, with its email and password
 * hash) and, through the foreign keys' "on delete cascade", the profile (nickname, names, date of
 * birth, university), every log entry and every follow in both directions. The student then
 * disappears from leaderboards, search and other students' following lists, and can't log in again.
 */
create function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users a where a.id = v_user;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.get_my_history() from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;

grant execute on function public.get_my_history() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
