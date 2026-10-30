/*
 * Badge tests (US-15): loading badges.json (private.sync_badges), the longest streak ever, which badges
 * a student has earned (get_my_badges, the profile), and the badges a log has just earned (log_action's
 * new_badges). Uses a test badge list, so the real badges.json doesn't matter. Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select private.sync_actions('[{"key": "t_act", "label": "Test", "points": 10, "daily_limit": 100, "co2_g": 1}]');
select private.sync_badges($$[
  {"key": "t_first", "label": "First action", "rule": "logs", "threshold": 1},
  {"key": "t_points", "label": "30 points", "rule": "points", "threshold": 30},
  {"key": "t_streak", "label": "3-day streak", "rule": "streak", "threshold": 3}
]$$);

/* Creates a student and returns the id. */
create function pg_temp.student(p_nickname text)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v_id, p_nickname || '@badges.test',
    jsonb_build_object('nickname', p_nickname, 'first_name', 'T', 'last_name', 'T',
                       'date_of_birth', '2000-01-01', 'university', 'Test'));
  return v_id;
end $$;

/* Acts as the given student in the API functions (null = logged out). */
create function pg_temp.act_as(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true)
$$;

/* Inserts a log at noon Zürich time on a date. */
create function pg_temp.log_on(p_user uuid, p_day date)
returns void language sql as $$
  insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc)
  values (p_user, 't_act', 10, 1, (p_day + time '12:00') at time zone 'Europe/Zurich')
$$;

create temporary table ids (name text primary key, id uuid);
insert into ids values ('anna', pg_temp.student('pgtap_b_anna')), ('ben', pg_temp.student('pgtap_b_ben'));

-- Loading badges.json (US-15 AC1).
select results_eq(
  $$ select key, label, rule, threshold, position, active from public.badges where key like 't\_%' order by position $$,
  $$ values ('t_first', 'First action', 'logs', 1, 1, true), ('t_points', '30 points', 'points', 30, 2, true),
            ('t_streak', '3-day streak', 'streak', 3, 3, true) $$,
  'sync_badges loads every badge in file order');
select throws_ok($$ select private.sync_badges('[{"key": "x", "label": "X", "rule": "visits", "threshold": 1}]') $$,
  'P0001', 'badges.json entry 1 ("x"): "rule" must be "logs", "points" or "streak".', 'unknown rule is refused');
select throws_ok($$ select private.sync_badges('[{"key": "x", "label": "X", "rule": "logs", "threshold": 0}]') $$,
  'P0001', 'badges.json entry 1 ("x"): "threshold" must be a whole number of at least 1.', 'threshold 0 is refused');
select throws_ok($$ select private.sync_badges('[{"key": "x", "label": "X", "rule": "logs"}]') $$,
  'P0001', 'badges.json entry 1 ("x") is missing the field "threshold".', 'a missing field is refused');
select throws_ok($$ select private.sync_badges('[{"key": "x", "label": "X", "rule": "logs", "threshold": 1, "icon": "a"}]') $$,
  'P0001', 'badges.json entry 1 ("x") has an unknown field "icon".', 'an unknown field is refused');
select throws_ok($$ select private.sync_badges('[{"key": "x", "label": "X", "rule": "logs", "threshold": 1}, {"key": "x", "label": "Y", "rule": "logs", "threshold": 2}]') $$,
  'P0001', 'badges.json entry 2 ("x"): the key "x" is used more than once.', 'a duplicate key is refused');
select throws_ok($$ select private.sync_badges('[{"key": "x", "label": "", "rule": "logs", "threshold": 1}]') $$,
  'P0001', 'badges.json entry 1 ("x"): "label" must be text of 1 to 100 characters.', 'an empty label is refused');
select throws_ok($$ select private.sync_badges('[]') $$, 'P0001', 'badges.json must contain at least one badge.', 'an empty list is refused');
select is((select count(*)::integer from public.badges where active and key like 't\_%'), 3, 'a refused file changes nothing');

-- Longest streak ever (the streak rule, US-15 AC2).
select pg_temp.log_on((select id from ids where name = 'ben'), date '2026-10-01');
select pg_temp.log_on((select id from ids where name = 'ben'), date '2026-10-02');
select pg_temp.log_on((select id from ids where name = 'ben'), date '2026-10-02');
select pg_temp.log_on((select id from ids where name = 'ben'), date '2026-10-03');
select pg_temp.log_on((select id from ids where name = 'ben'), date '2026-10-10');
select pg_temp.log_on((select id from ids where name = 'ben'), date '2026-10-11');
select is(private.longest_streak((select id from ids where name = 'ben')), 3, 'longest streak: 1 to 3 Oct (two logs on the 2nd count once)');
select is(private.longest_streak((select id from ids where name = 'anna')), 0, 'no logs: longest streak 0');

-- My badges (US-15 AC3): all badges in order, none earned for a new student.
select pg_temp.act_as(null);
select throws_ok($$ select * from public.get_my_badges() $$, 'P0001', 'not_authenticated', 'badges need a login');
select pg_temp.act_as((select id from ids where name = 'anna'));
select results_eq(
  $$ select key, label, rule, threshold, earned from public.get_my_badges() where key like 't\_%' $$,
  $$ values ('t_first', 'First action', 'logs', 1, false), ('t_points', '30 points', 'points', 30, false),
            ('t_streak', '3-day streak', 'streak', 3, false) $$,
  'a new student has earned no badge ("0 of N earned")');

-- A log that earns a badge says so once (US-15 AC4).
select is((select new_badges from public.log_action('t_act')), '[{"key": "t_first", "label": "First action"}]'::jsonb,
  'the first log earns "First action"');
select is((select new_badges from public.log_action('t_act')), '[]'::jsonb, 'the second log earns nothing new');
select is((select new_badges from public.log_action('t_act')), '[{"key": "t_points", "label": "30 points"}]'::jsonb,
  'reaching 30 points earns "30 points"');
select results_eq(
  $$ select key, earned from public.get_my_badges() where key like 't\_%' $$,
  $$ values ('t_first', true), ('t_points', true), ('t_streak', false) $$,
  'get_my_badges shows the earned ones');

-- The streak badge uses the longest streak ever, so it stays earned after the streak ends (AC2).
select pg_temp.act_as((select id from ids where name = 'ben'));
select is(private.streak((select id from ids where name = 'ben'), private.zurich_today()), 0, 'Ben''s current streak is 0');
select results_eq(
  $$ select key, earned from public.get_my_badges() where key like 't\_%' $$,
  $$ values ('t_first', true), ('t_points', true), ('t_streak', true) $$,
  'Ben keeps the 3-day streak badge although his current streak is 0');

-- A student's profile shows the badges they earned, and nothing else about them (US-15 AC5).
select is(
  (select badges from public.get_student_profile((select id from ids where name = 'anna'))),
  '[{"key": "t_first", "label": "First action"}, {"key": "t_points", "label": "30 points"}]'::jsonb,
  'Anna''s profile shows her two earned badges, in badges.json order');

-- Badges never change points, streaks or rankings (AC6): Home values still equal the logs.
select pg_temp.act_as((select id from ids where name = 'anna'));
select results_eq($$ select total_points, streak from public.get_my_status() $$, $$ values (30, 1) $$,
  'points and streak are the sums of the logs only');

-- A badge removed from badges.json disappears; it can't be earned or shown any more.
select private.sync_badges('[{"key": "t_first", "label": "First action", "rule": "logs", "threshold": 1}]');
select results_eq($$ select key from public.get_my_badges() where key like 't\_%' $$, $$ values ('t_first') $$,
  'removed badges are no longer listed');

select * from finish();
rollback;
