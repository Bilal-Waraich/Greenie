/*
 * Weekly leaderboard tests (US-06, US-12 AC4): get_leaderboard('everyone') and ('following').
 *
 * All accounts are removed at the start, inside this test's transaction (rolled back at the end), so
 * demo or browser-test data in the local database can't change the rankings. Points are given with
 * logs dated this week, last week and on the week's edges in Zürich time. Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

delete from auth.users;
select private.sync_actions('[{"key": "t_act", "label": "Test", "points": 1, "daily_limit": 1000, "co2_g": 1}]');

/* Creates a student and returns the id. */
create function pg_temp.student(p_nickname text)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v_id, p_nickname || '@board.test',
    jsonb_build_object('nickname', p_nickname, 'first_name', 'T', 'last_name', 'T',
                       'date_of_birth', '2000-01-01', 'university', 'Test'));
  return v_id;
end $$;

/* Acts as the given student in the API functions (null = logged out). */
create function pg_temp.act_as(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true)
$$;

/* Gives a student points with one log at a Zürich date and time. */
create function pg_temp.points_at(p_user uuid, p_points integer, p_day date, p_time time default '12:00')
returns void language sql as $$
  insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc)
  values (p_user, 't_act', p_points, 1, (p_day + p_time) at time zone 'Europe/Zurich')
$$;

/* Gives a student points today. */
create function pg_temp.points_today(p_user uuid, p_points integer)
returns void language sql as $$
  select pg_temp.points_at(p_user, p_points, private.zurich_today(), '00:00:01')
$$;

/* The id of a student by nickname. */
create function pg_temp.id_of(p_nickname text)
returns uuid language sql as $$
  select u.id from public.users u where u.nickname = p_nickname
$$;

select pg_temp.student('myself');
select pg_temp.act_as(pg_temp.id_of('myself'));

-- Logged out and wrong tab.
select pg_temp.act_as(null);
select throws_ok($$ select * from public.get_leaderboard('everyone') $$, 'P0001', 'not_authenticated', 'leaderboard needs a login');
select pg_temp.act_as(pg_temp.id_of('myself'));
select throws_ok($$ select * from public.get_leaderboard('friends') $$, 'P0001', 'invalid_input: tab', 'unknown tab is refused');

-- Nobody has points this week: "Everyone" is empty (Figma S5 "empty list"); a new week starts at 0 (AC2).
select pg_temp.student('alice');
select pg_temp.points_at(pg_temp.id_of('alice'), 50, private.week_start(private.zurich_today()) - 1, '23:59');
select is_empty($$ select * from public.get_leaderboard('everyone') $$,
  'last week''s points (Sunday 23:59) don''t count: the list is empty');

-- Monday 00:00 starts the week (AC2).
select pg_temp.points_at(pg_temp.id_of('alice'), 7, private.week_start(private.zurich_today()), '00:00:30');
select results_eq(
  $$ select rank, nickname, week_points, is_me, is_pinned from public.get_leaderboard('everyone') $$,
  $$ values (1, 'alice', 7, false, false), (2, 'myself', 0, true, true) $$,
  'Monday 00:00:30 counts; my own row (0 points) is shown below the list with my rank');

-- Equal points: alphabetical by nickname ignoring case, consecutive ranks (AC5).
select pg_temp.student('Bob');
select pg_temp.student('carl');
select pg_temp.points_today(pg_temp.id_of('Bob'), 7);
select pg_temp.points_today(pg_temp.id_of('carl'), 9);
select pg_temp.points_today(pg_temp.id_of('myself'), 7);
select results_eq(
  $$ select rank, nickname, week_points, is_me, is_pinned from public.get_leaderboard('everyone') $$,
  $$ values (1, 'carl', 9, false, false), (2, 'alice', 7, false, false), (3, 'Bob', 7, false, false), (4, 'myself', 7, true, false) $$,
  'ties are ordered alphabetically (alice, Bob, myself) with consecutive ranks; my row is in the list, not pinned');

-- A new log shows at once (AC6): log_action adds a point, and the next call ranks it.
select public.log_action('t_act');
select results_eq(
  $$ select rank, week_points from public.get_leaderboard('everyone') where is_me $$,
  $$ values (2, 8) $$,
  'my new log counts at once: 8 points, rank 2');

-- Top 20 (AC3) and my row below the list when I'm outside it (AC4).
select pg_temp.student(format('top_%s', lpad(n::text, 2, '0'))) from generate_series(1, 22) as n;
select pg_temp.points_today(pg_temp.id_of(format('top_%s', lpad(n::text, 2, '0'))), 100 + n) from generate_series(1, 22) as n;
select is((select count(*)::integer from public.get_leaderboard('everyone') where not is_pinned), 20,
  'Everyone shows the top 20');
select results_eq(
  $$ select rank, nickname from public.get_leaderboard('everyone') where not is_pinned order by rank limit 2 $$,
  $$ values (1, 'top_22'), (2, 'top_21') $$,
  'ranked by points this week, highest first');
select results_eq(
  $$ select rank, nickname, week_points, is_me, is_pinned from public.get_leaderboard('everyone') where is_pinned $$,
  $$ values (24, 'myself', 8, true, true) $$,
  'outside the top 20, my row and real rank (24: 22 above, carl with 9, then myself) come as a pinned row');
select is((select count(*)::integer from public.get_leaderboard('everyone')), 21, 'top 20 plus my pinned row');

-- Following (AC3, AC7; US-12 AC4).
select is_empty($$ select * from public.get_leaderboard('following') $$,
  'following nobody: the list is empty (the app shows "You are not following anyone yet")');
select public.follow_student(pg_temp.id_of('alice'));
select public.follow_student(pg_temp.id_of('Bob'));
select pg_temp.student('dora');
select public.follow_student(pg_temp.id_of('dora'));
select results_eq(
  $$ select rank, nickname, week_points, is_me, is_pinned from public.get_leaderboard('following') $$,
  $$ values (1, 'myself', 8, true, false), (2, 'alice', 7, false, false), (3, 'Bob', 7, false, false), (4, 'dora', 0, false, false) $$,
  'Following: me and everyone I follow, ranked within the group, including 0 points; a new follow shows at once');
select public.unfollow_student(pg_temp.id_of('dora'));
select is((select count(*)::integer from public.get_leaderboard('following') where nickname = 'dora'), 0,
  'an unfollowed student leaves the Following list');

-- Following is the caller's own list: alice follows nobody.
select pg_temp.act_as(pg_temp.id_of('alice'));
select is_empty($$ select * from public.get_leaderboard('following') $$, 'another student''s follows are their own');

select * from finish();
rollback;
