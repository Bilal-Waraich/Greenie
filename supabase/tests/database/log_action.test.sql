/*
 * Home and logging tests (US-01 AC7, US-02, US-03 AC2 and AC4, US-08): get_my_status, get_log_actions,
 * log_action and nickname_available, called as a logged-in student (the JWT subject is set the way the
 * API sets it). Uses a test action list, so the real actions.json doesn't matter. Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select private.sync_actions($$[
  {"key": "t_ten", "label": "Ten points", "points": 10, "daily_limit": 2, "co2_g": 40},
  {"key": "t_five", "label": "Five points", "points": 5, "daily_limit": 1, "co2_g": 1500}
]$$);

/* Creates a student and returns the id. */
create function pg_temp.student(p_nickname text)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v_id, p_nickname || '@log.test',
    jsonb_build_object('nickname', p_nickname, 'first_name', 'T', 'last_name', 'T',
                       'date_of_birth', '2000-01-01', 'university', 'Test'));
  return v_id;
end $$;

/* Acts as the given student in the API functions (null = logged out). */
create function pg_temp.act_as(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true)
$$;

/* Noon in Zürich on the given Zürich date, as a timestamp. */
create function pg_temp.zurich_noon(p_day date)
returns timestamptz language sql as $$
  select (p_day + time '12:00') at time zone 'Europe/Zurich'
$$;

create temporary table ids (name text primary key, id uuid);
insert into ids values ('anna', pg_temp.student('pgtap_anna')), ('ben', pg_temp.student('pgtap_ben'));

-- Logged out: every student function refuses.
select pg_temp.act_as(null);
select throws_ok($$ select * from public.get_my_status() $$, 'P0001', 'not_authenticated', 'get_my_status needs a login');
select throws_ok($$ select * from public.get_log_actions() $$, 'P0001', 'not_authenticated', 'get_log_actions needs a login');
select throws_ok($$ select * from public.log_action('t_ten') $$, 'P0001', 'not_authenticated', 'log_action needs a login');

-- A new student starts at 0 points and streak 0 (US-01 AC7).
select pg_temp.act_as((select id from ids where name = 'anna'));
select results_eq(
  $$ select nickname, total_points, today_points, week_points, streak, co2_saved_g from public.get_my_status() $$,
  $$ values ('pgtap_anna', 0, 0, 0, 0, 0::bigint) $$,
  'new student: 0 points, streak 0');

-- The Log list is the active actions in file order (US-03 AC1).
select results_eq(
  $$ select key, label, points, daily_limit, co2_g, used_today from public.get_log_actions() $$,
  $$ values ('t_ten', 'Ten points', 10, 2, 40, 0), ('t_five', 'Five points', 5, 1, 1500, 0) $$,
  'get_log_actions lists active actions in order with zero use today');

-- A tap adds exactly the action's points (US-03 AC2) and raises the streak on the first log of the day.
select results_eq(
  $$ select points_added, total_points, today_points, streak, streak_increased, used_today, daily_limit, co2_g from public.log_action('t_ten') $$,
  $$ values (10, 10, 10, 1, true, 1, 2, 40) $$,
  'first log: +10, total 10, streak 1 (increased)');
select results_eq(
  $$ select points_added, total_points, today_points, streak, streak_increased, used_today from public.log_action('t_ten') $$,
  $$ values (10, 20, 20, 1, false, 2) $$,
  'second log: +10, total 20, streak stays 1');

-- Beyond the daily limit: error, nothing added (US-03 AC4).
select throws_ok($$ select * from public.log_action('t_ten') $$, 'P0001', 'daily_limit_reached', 'third log of a limit-2 action is refused');
select is((select count(*)::integer from public.action_logs where user_id = (select id from ids where name = 'anna')), 2,
  'refused log inserts nothing');

select results_eq($$ select total_points from public.log_action('t_five') $$, $$ values (25) $$, 'another action adds its own points');
select results_eq(
  $$ select total_points, today_points, week_points, streak, co2_saved_g from public.get_my_status() $$,
  $$ values (25, 25, 25, 1, 1580::bigint) $$,
  'Home values equal the sum of the stored logs (US-02 AC2)');
select results_eq(
  $$ select key, used_today from public.get_log_actions() $$,
  $$ values ('t_ten', 2), ('t_five', 1) $$,
  'get_log_actions shows today''s use per action');

-- Students only see their own data.
select pg_temp.act_as((select id from ids where name = 'ben'));
select results_eq($$ select total_points from public.get_my_status() $$, $$ values (0) $$, 'another student does not see Anna''s points');

-- The limit counts per Zürich day: yesterday's log doesn't count today; it does continue the streak.
insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc)
values ((select id from ids where name = 'ben'), 't_five', 5, 1500, pg_temp.zurich_noon(private.zurich_today() - 1));
select results_eq(
  $$ select points_added, streak, streak_increased, used_today from public.log_action('t_five') $$,
  $$ values (5, 2, true, 1) $$,
  'yesterday''s log does not count toward today''s limit; streak becomes 2');

-- Points this week exclude last week's logs; the total includes them.
insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc)
values ((select id from ids where name = 'ben'), 't_ten', 10, 40, pg_temp.zurich_noon(private.week_start(private.zurich_today()) - 1));
select results_eq(
  $$ select total_points, week_points >= 5 and week_points <= 10, week_points < total_points from public.get_my_status() $$,
  $$ values (20, true, true) $$,
  'last Sunday''s log counts in the total, not in this week');

-- Changing an action's points affects new logs only (US-08).
select private.sync_actions($$[
  {"key": "t_ten", "label": "Ten points", "points": 12, "daily_limit": 3, "co2_g": 40},
  {"key": "t_five", "label": "Five points", "points": 5, "daily_limit": 1, "co2_g": 1500}
]$$);
select results_eq($$ select points_added from public.log_action('t_ten') $$, $$ values (12) $$, 'new points apply to new logs');
select pg_temp.act_as((select id from ids where name = 'anna'));
select results_eq($$ select total_points from public.get_my_status() $$, $$ values (25) $$, 'old logs keep their points');
select results_eq($$ select used_today from public.log_action('t_ten') $$, $$ values (3) $$, 'a raised limit applies at once');

-- Unknown and removed actions are refused.
select throws_ok($$ select * from public.log_action('no_such_action') $$, 'P0001', 'unknown_action', 'unknown key is refused');
select private.sync_actions($$[{"key": "t_ten", "label": "Ten points", "points": 12, "daily_limit": 3, "co2_g": 40}]$$);
select throws_ok($$ select * from public.log_action('t_five') $$, 'P0001', 'unknown_action', 'removed (inactive) action is refused');
select results_eq($$ select key from public.get_log_actions() $$, $$ values ('t_ten') $$, 'removed action disappears from the Log list');
select results_eq($$ select total_points from public.get_my_status() $$, $$ values (37) $$, 'logs of a removed action still count (10 + 10 + 5 + 12)');

-- Nickname check: case-insensitive, trimmed; usable by visitors.
select pg_temp.act_as(null);
select is(public.nickname_available('PGTAP_ANNA'), false, 'nickname_available: taken in another case');
select is(public.nickname_available('  pgtap_anna '), false, 'nickname_available: trimmed');
select is(public.nickname_available('pgtap_nobody'), true, 'nickname_available: free nickname');

select * from finish();
rollback;
