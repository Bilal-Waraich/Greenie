/*
 * Streak and Zürich calendar tests (US-04, brief section 9 "Time").
 *
 * The first six tests are the brief's US-04 test table, using Mon 26 to Fri 30 October 2026.
 * Logs are inserted with UTC timestamps; the trigger sets each log's Zürich date. Also covers the
 * winter and summer midnight cases, the clock change on Sun 25 Oct 2026, and private.week_start.
 * Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select private.sync_actions('[{"key": "t_act", "label": "Test", "points": 10, "daily_limit": 50, "co2_g": 1}]');

/* Creates a student and returns the id. */
create function pg_temp.student(p_nickname text)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v_id, p_nickname || '@streak.test',
    jsonb_build_object('nickname', p_nickname, 'first_name', 'T', 'last_name', 'T',
                       'date_of_birth', '2000-01-01', 'university', 'Test'));
  return v_id;
end $$;

/* Inserts a log at a UTC instant. */
create function pg_temp.log_at(p_user uuid, p_utc timestamptz)
returns void language sql as $$
  insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc) values (p_user, 't_act', 10, 1, p_utc)
$$;

-- Brief cases 1 to 4: logs on Mon, Tue, Wed at noon Zürich (11:00 UTC in winter time).
create temporary table cases (name text primary key, id uuid);
insert into cases values ('weekdays', pg_temp.student('pgtap_s_weekdays'));
select pg_temp.log_at((select id from cases where name = 'weekdays'), '2026-10-26 11:00Z');
select pg_temp.log_at((select id from cases where name = 'weekdays'), '2026-10-27 11:00Z');
select pg_temp.log_at((select id from cases where name = 'weekdays'), '2026-10-28 11:00Z');

select is(private.streak((select id from cases where name = 'weekdays'), date '2026-10-28'), 3,
  'US-04 case 1: logged Mon, Tue, Wed; today Wed -> 3');
select is(private.streak((select id from cases where name = 'weekdays'), date '2026-10-29'), 3,
  'US-04 case 2: logged Mon, Tue, Wed; nothing yet today; today Thu -> 3');
select is(private.streak((select id from cases where name = 'weekdays'), date '2026-10-30'), 0,
  'US-04 case 3: logged Mon, Tue, Wed; nothing on Thu; today Fri -> 0');
select pg_temp.log_at((select id from cases where name = 'weekdays'), '2026-10-30 11:00Z');
select is(private.streak((select id from cases where name = 'weekdays'), date '2026-10-30'), 1,
  'US-04 case 4: as above, then logs on Fri; today Fri -> 1');

-- Brief case 5: two actions on the same day count as one day.
insert into cases values ('same_day', pg_temp.student('pgtap_s_same_day'));
select pg_temp.log_at((select id from cases where name = 'same_day'), '2026-10-26 08:00Z');
select pg_temp.log_at((select id from cases where name = 'same_day'), '2026-10-26 15:00Z');
select is(private.streak((select id from cases where name = 'same_day'), date '2026-10-26'), 1,
  'US-04 case 5: two actions on the same day count as one day');
select pg_temp.log_at((select id from cases where name = 'same_day'), '2026-10-27 09:00Z');
select is(private.streak((select id from cases where name = 'same_day'), date '2026-10-27'), 2,
  'US-04 case 5: two actions Mon and one Tue -> 2');

-- Brief case 6: action at 23:59 and another at 00:01 count as two consecutive days.
-- Winter time (CET, UTC+1): 22:59Z is 23:59 on 2 Nov, 23:01Z is 00:01 on 3 Nov.
insert into cases values ('winter', pg_temp.student('pgtap_s_winter'));
select pg_temp.log_at((select id from cases where name = 'winter'), '2026-11-02 22:59Z');
select pg_temp.log_at((select id from cases where name = 'winter'), '2026-11-02 23:01Z');
select results_eq(
  $$ select local_date_zurich from public.action_logs where user_id = (select id from cases where name = 'winter') order by logged_at_utc $$,
  $$ values (date '2026-11-02'), (date '2026-11-03') $$,
  'winter: 23:59 and 00:01 fall on two Zürich dates');
select is(private.streak((select id from cases where name = 'winter'), date '2026-11-03'), 2,
  'US-04 case 6 (winter time): 23:59 and 00:01 -> two consecutive days');

-- Summer time (CEST, UTC+2): 21:59Z is 23:59 on 24 Oct, 22:01Z is 00:01 on 25 Oct.
insert into cases values ('summer', pg_temp.student('pgtap_s_summer'));
select pg_temp.log_at((select id from cases where name = 'summer'), '2026-10-24 21:59Z');
select pg_temp.log_at((select id from cases where name = 'summer'), '2026-10-24 22:01Z');
select results_eq(
  $$ select local_date_zurich from public.action_logs where user_id = (select id from cases where name = 'summer') order by logged_at_utc $$,
  $$ values (date '2026-10-24'), (date '2026-10-25') $$,
  'summer: 23:59 and 00:01 fall on two Zürich dates');
select is(private.streak((select id from cases where name = 'summer'), date '2026-10-25'), 2,
  'US-04 case 6 (summer time): 23:59 and 00:01 -> two consecutive days');

-- Clock change at 01:00 UTC on Sun 25 Oct 2026: 00:30Z and 01:30Z are both 02:30 local on 25 Oct.
insert into cases values ('dst', pg_temp.student('pgtap_s_dst'));
select pg_temp.log_at((select id from cases where name = 'dst'), '2026-10-25 00:30Z');
select pg_temp.log_at((select id from cases where name = 'dst'), '2026-10-25 01:30Z');
select results_eq(
  $$ select local_date_zurich from public.action_logs where user_id = (select id from cases where name = 'dst') order by logged_at_utc $$,
  $$ values (date '2026-10-25'), (date '2026-10-25') $$,
  'clock change: both logs are on 25 Oct');
select is(private.streak((select id from cases where name = 'dst'), date '2026-10-25'), 1,
  'clock change: two logs on 25 Oct are one day');

-- Other edges.
insert into cases values ('none', pg_temp.student('pgtap_s_none'));
select is(private.streak((select id from cases where name = 'none'), date '2026-10-28'), 0, 'no logs -> 0');
select is(private.streak((select id from cases where name = 'weekdays'), date '2026-10-25'), 0,
  'logs after the given day are ignored');
select is(private.streak((select id from cases where name = 'weekdays'), date '2026-10-31'), 1,
  'logged Fri, nothing yet Sat -> streak from Fri still counts (1)');

-- The trigger always sets the Zürich date, overriding any value given, also on update.
insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc, local_date_zurich)
values ((select id from cases where name = 'none'), 't_act', 10, 1, '2026-10-27 23:30Z', date '2000-01-01');
select is((select local_date_zurich from public.action_logs where user_id = (select id from cases where name = 'none')),
  date '2026-10-28', 'insert: a given local date is replaced by the Zürich date (00:30 CET on 28 Oct)');
update public.action_logs set logged_at_utc = '2026-10-29 10:00Z' where user_id = (select id from cases where name = 'none');
select is((select local_date_zurich from public.action_logs where user_id = (select id from cases where name = 'none')),
  date '2026-10-29', 'update: the Zürich date follows the new timestamp');

-- Weeks run Monday to Sunday.
select is(private.week_start(d::date), date '2026-10-26', 'week_start of ' || to_char(d, 'Dy DD Mon YYYY') || ' is Mon 26 Oct 2026')
from generate_series(date '2026-10-26', date '2026-11-01', interval '1 day') as d;
select is(private.week_start(date '2026-11-02'), date '2026-11-02', 'Mon 2 Nov 2026 starts a new week');
select is(private.week_start(date '2026-12-01'), date '2026-11-30', 'across a month end: Tue 1 Dec 2026 -> Mon 30 Nov');
select is(private.week_start(date '2027-01-01'), date '2026-12-28', 'across a year end: Fri 1 Jan 2027 -> Mon 28 Dec 2026');
select is(private.week_start(date '2028-03-01'), date '2028-02-28', 'across a leap day: Wed 1 Mar 2028 -> Mon 28 Feb 2028');

select is(private.zurich_today(), (now() at time zone 'Europe/Zurich')::date, 'zurich_today is today''s date in Zürich');

select * from finish();
rollback;
