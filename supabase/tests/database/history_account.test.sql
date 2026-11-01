/*
 * My history and delete my account tests (US-05, US-09): get_my_history and delete_my_account.
 * Checks the last 20 entries newest first, and that deleting an account removes the login, the
 * profile, the logs and the follows in both directions, so the student disappears from search and
 * leaderboards. Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select private.sync_actions($$[
  {"key": "t_first", "label": "First action", "points": 10, "daily_limit": 100, "co2_g": 40},
  {"key": "t_second", "label": "Second action", "points": 5, "daily_limit": 100, "co2_g": 1500}
]$$);

/* Creates a student and returns the id. */
create function pg_temp.student(p_nickname text)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v_id, p_nickname || '@history.test',
    jsonb_build_object('nickname', p_nickname, 'first_name', 'T', 'last_name', 'T',
                       'date_of_birth', '2000-01-01', 'university', 'Test'));
  return v_id;
end $$;

/* Acts as the given student in the API functions (null = logged out). */
create function pg_temp.act_as(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true)
$$;

/* Inserts a log at a UTC instant. */
create function pg_temp.log_at(p_user uuid, p_key text, p_utc timestamptz)
returns void language sql as $$
  insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc)
  select p_user, a.key, a.points, a.co2_g, p_utc from public.actions a where a.key = p_key
$$;

create temporary table ids (name text primary key, id uuid);
insert into ids values
  ('anna', pg_temp.student('pgtap_h_anna')),
  ('ben', pg_temp.student('pgtap_h_ben')),
  ('cleo', pg_temp.student('pgtap_h_cleo'));

select pg_temp.act_as(null);
select throws_ok($$ select * from public.get_my_history() $$, 'P0001', 'not_authenticated', 'history needs a login');
select throws_ok($$ select public.delete_my_account() $$, 'P0001', 'not_authenticated', 'deleting needs a login');

-- History (US-05 AC1, AC2).
select pg_temp.act_as((select id from ids where name = 'anna'));
select is_empty($$ select * from public.get_my_history() $$, 'a new student has an empty history ("Nothing logged yet.")');

-- 25 logs an hour apart; the newest 20 come back, newest first, with label, points, CO2 and time.
select pg_temp.log_at((select id from ids where name = 'anna'), case when n % 2 = 0 then 't_first' else 't_second' end,
  timestamptz '2026-10-01 08:00Z' + make_interval(hours => n))
from generate_series(1, 25) as n;
select pg_temp.log_at((select id from ids where name = 'ben'), 't_first', timestamptz '2026-10-05 08:00Z');
select is((select count(*)::integer from public.get_my_history()), 20, 'history lists the last 20 entries');
select results_eq(
  $$ select label, points, co2_g, logged_at_utc from public.get_my_history() limit 3 $$,
  $$ values ('Second action', 5, 1500, timestamptz '2026-10-02 09:00Z'),
            ('First action', 10, 40, timestamptz '2026-10-02 08:00Z'),
            ('Second action', 5, 1500, timestamptz '2026-10-02 07:00Z') $$,
  'newest first, with the action label, points, CO2 grams and the time');
select is((select min(logged_at_utc) from public.get_my_history()), timestamptz '2026-10-01 14:00Z',
  'the oldest of the 20 is the 6th log (the 5 oldest are left out)');
select is((select count(*)::integer from public.get_my_history() where logged_at_utc = timestamptz '2026-10-05 08:00Z'), 0,
  'another student''s logs are not in my history');

-- A removed action keeps its label in the history.
select private.sync_actions('[{"key": "t_first", "label": "First action", "points": 10, "daily_limit": 100, "co2_g": 40}]');
select is((select label from public.get_my_history() limit 1), 'Second action', 'a removed action still shows its label');

-- Delete my account (US-09 AC1, AC2). Anna follows Ben, Cleo follows Anna.
select public.follow_student((select id from ids where name = 'ben'));
select pg_temp.act_as((select id from ids where name = 'cleo'));
select public.follow_student((select id from ids where name = 'anna'));
select pg_temp.log_at((select id from ids where name = 'anna'), 't_first', now());
select is((select count(*)::integer from public.get_leaderboard('following') where nickname = 'pgtap_h_anna'), 1,
  'before: Anna is on Cleo''s Following leaderboard');

select pg_temp.act_as((select id from ids where name = 'anna'));
select lives_ok($$ select public.delete_my_account() $$, 'Anna deletes her account');

select is((select count(*)::integer from auth.users where id = (select id from ids where name = 'anna')), 0,
  'the login is gone (email and password hash), so she can no longer log in');
select is((select count(*)::integer from public.users where id = (select id from ids where name = 'anna')), 0,
  'the profile is gone (nickname, names, date of birth, university)');
select is((select count(*)::integer from public.action_logs where user_id = (select id from ids where name = 'anna')), 0,
  'all her logs are gone');
select is((select count(*)::integer from public.follows
           where follower_id = (select id from ids where name = 'anna') or followed_id = (select id from ids where name = 'anna')), 0,
  'all follows to and from her are gone');
select throws_ok($$ select * from public.get_my_status() $$, 'P0001', 'not_found', 'her old session finds no profile');
select throws_ok($$ select public.delete_my_account() $$, 'P0001', 'not_found', 'deleting again: not_found');

select pg_temp.act_as((select id from ids where name = 'cleo'));
select is_empty($$ select * from public.search_students('pgtap_h_anna') $$, 'she is gone from search results');
select is((select count(*)::integer from public.get_leaderboard('everyone') where nickname = 'pgtap_h_anna'), 0,
  'she is gone from the Everyone leaderboard');
select is_empty($$ select * from public.get_leaderboard('following') $$,
  'she is gone from Cleo''s Following list (Cleo now follows nobody)');
select is((select count(*)::integer from public.users where id in (select id from ids where name in ('ben', 'cleo'))), 2,
  'other students are not affected');

select * from finish();
rollback;
