/*
 * Zürich calendar helpers and the daily streak (US-04, brief section 9 "Time").
 *
 * Every "day" and "week" is a calendar day in Europe/Zurich. Timestamps are stored in UTC
 * (timestamptz). These helpers are internal: the API roles can't call them.
 */

/* Today's date in Zürich. */
create function private.zurich_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Zurich')::date
$$;

/* The Monday of the week that contains p_day (weeks run Monday to Sunday). */
create function private.week_start(p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_day - (extract(isodow from p_day)::integer - 1)
$$;

/*
 * The student's current streak on p_today (US-04 AC2, AC3): the number of consecutive Zürich days
 * with at least one log, ending at p_today if they logged that day, otherwise ending at the day before
 * if they logged then, otherwise 0. Several logs on one day count as one day. Logs after p_today are
 * ignored, so the brief's test table can be checked for any date.
 */
create function private.streak(p_user uuid, p_today date)
returns integer
language sql
stable
set search_path = ''
as $$
  with days as (
    select distinct l.local_date_zurich as day
    from public.action_logs l
    where l.user_id = p_user
      and l.local_date_zurich <= p_today
  ),
  anchor as (
    select case
      when exists (select 1 from days where day = p_today) then p_today
      when exists (select 1 from days where day = p_today - 1) then p_today - 1
    end as day
  ),
  ranked as (
    select d.day, row_number() over (order by d.day desc)::integer as position_from_anchor
    from days d
    cross join anchor a
    where d.day <= a.day
  )
  select count(*)::integer
  from ranked r
  cross join anchor a
  where r.day = a.day - (r.position_from_anchor - 1)
$$;

/* Trigger: sets local_date_zurich from logged_at_utc on every insert and update, overriding any value. */
create function private.set_local_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.local_date_zurich := (new.logged_at_utc at time zone 'Europe/Zurich')::date;
  return new;
end;
$$;

create trigger action_logs_set_local_date
  before insert or update on public.action_logs
  for each row execute function private.set_local_date();

revoke all on function private.zurich_today() from public, anon, authenticated;
revoke all on function private.week_start(date) from public, anon, authenticated;
revoke all on function private.streak(uuid, date) from public, anon, authenticated;
revoke all on function private.set_local_date() from public, anon, authenticated;
