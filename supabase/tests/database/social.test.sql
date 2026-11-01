/*
 * Find students, profiles, follow and unfollow tests (US-11, US-12): search_students,
 * get_student_profile, follow_student and unfollow_student, called as logged-in students.
 * Checks the search rules, the profile values, the follow rules and that no result contains a
 * student's email, names or date of birth. Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select private.sync_actions('[{"key": "t_act", "label": "Test", "points": 10, "daily_limit": 50, "co2_g": 1}]');

/* Creates a student with distinctive private fields and returns the id. */
create function pg_temp.student(p_nickname text, p_university text default 'Test University')
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v_id, p_nickname || '@social.test',
    jsonb_build_object('nickname', p_nickname, 'first_name', 'Privatefirst', 'last_name', 'Privatelast',
                       'date_of_birth', '1999-07-07', 'university', p_university));
  return v_id;
end $$;

/* Acts as the given student in the API functions (null = logged out). */
create function pg_temp.act_as(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true)
$$;

/* Inserts a log for a student, a number of days before today, at noon Zürich time. */
create function pg_temp.log_days_ago(p_user uuid, p_days integer)
returns void language sql as $$
  insert into public.action_logs (user_id, action_key, points, co2_g, logged_at_utc)
  values (p_user, 't_act', 10, 1, ((private.zurich_today() - p_days) + time '12:00') at time zone 'Europe/Zurich')
$$;

create temporary table ids (name text primary key, id uuid);
insert into ids values
  ('me', pg_temp.student('pgtap_SocialMe', 'ETH Zurich')),
  ('eco_a', pg_temp.student('pgtap_zqx_alex', 'ETH Zurich')),
  ('eco_b', pg_temp.student('pgtap_ZQX_mia', 'University of Zurich')),
  ('neco', pg_temp.student('pgtap_nzqx', 'ZHAW')),
  ('pct', pg_temp.student('pgtap_100pct'));

-- Logged out: every function refuses.
select pg_temp.act_as(null);
select throws_ok($$ select * from public.search_students('zqx') $$, 'P0001', 'not_authenticated', 'search needs a login');
select throws_ok(format($$ select * from public.get_student_profile(%L) $$, (select id from ids where name = 'eco_a')),
  'P0001', 'not_authenticated', 'profile needs a login');
select throws_ok(format($$ select public.follow_student(%L) $$, (select id from ids where name = 'eco_a')),
  'P0001', 'not_authenticated', 'follow needs a login');
select throws_ok(format($$ select public.unfollow_student(%L) $$, (select id from ids where name = 'eco_a')),
  'P0001', 'not_authenticated', 'unfollow needs a login');

select pg_temp.act_as((select id from ids where name = 'me'));

-- Search (US-11 AC1, AC2): partial, case-insensitive, trimmed, alphabetical, nickname and university.
select results_eq(
  $$ select nickname, university from public.search_students('ZQX_') $$,
  $$ values ('pgtap_zqx_alex', 'ETH Zurich'), ('pgtap_ZQX_mia', 'University of Zurich') $$,
  'search matches part of the nickname, ignoring case, in alphabetical order');
select results_eq(
  $$ select nickname from public.search_students('  pgtap_nzqx  ') $$,
  $$ values ('pgtap_nzqx') $$,
  'the search text is trimmed');
select results_eq(
  $$ select nickname from public.search_students('zqx') $$,
  $$ values ('pgtap_nzqx'), ('pgtap_zqx_alex'), ('pgtap_ZQX_mia') $$,
  'a match anywhere in the nickname counts (nzqx), still in alphabetical order');
select is_empty($$ select * from public.search_students('pgtap_nobody_here') $$, 'no match returns nothing (the app shows "No student found")');
select is_empty($$ select * from public.search_students('   ') $$, 'an empty search returns nothing');
select is_empty($$ select * from public.search_students(null) $$, 'a null search returns nothing');
select results_eq($$ select nickname from public.search_students('pgtap_1') $$, $$ values ('pgtap_100pct') $$,
  'pgtap_1 finds pgtap_100pct');
select is_empty($$ select * from public.search_students('pgtap_1%') $$, '"%" is an ordinary character, not a wildcard');
select is_empty($$ select * from public.search_students('pgtap_z_x') $$, '"_" is an ordinary character, not a wildcard');
select results_eq($$ select nickname from public.search_students('socialme') $$, $$ values ('pgtap_SocialMe') $$,
  'the search can find the student who searches');

-- Up to 20 results.
insert into ids select 'many_' || n, pg_temp.student(format('pgtap_many_%s', lpad(n::text, 2, '0'))) from generate_series(1, 25) as n;
select is((select count(*)::integer from public.search_students('pgtap_many_')), 20, 'search returns at most 20 results');
select results_eq(
  $$ select nickname from public.search_students('pgtap_many_') limit 2 $$,
  $$ values ('pgtap_many_01'), ('pgtap_many_02') $$,
  'the first 20 in alphabetical order');

-- Profile (US-11 AC3): nickname, university, total, this week, streak, follow state, own profile, badges.
select pg_temp.log_days_ago((select id from ids where name = 'eco_a'), 0);
select pg_temp.log_days_ago((select id from ids where name = 'eco_a'), 1);
select pg_temp.log_days_ago((select id from ids where name = 'eco_a'), 30);
select results_eq(
  format($$ select nickname, university, total_points, streak, is_following, is_me from public.get_student_profile(%L) $$,
         (select id from ids where name = 'eco_a')),
  $$ values ('pgtap_zqx_alex', 'ETH Zurich', 30, 2, false, false) $$,
  'profile shows nickname, university, total points, streak; not following; not me');
select is(
  (select week_points from public.get_student_profile((select id from ids where name = 'eco_a'))),
  case when extract(isodow from private.zurich_today()) = 1 then 10 else 20 end,
  'points this week count only this week''s logs (yesterday''s only if today isn''t Monday)');
select results_eq(
  format($$ select is_me, is_following from public.get_student_profile(%L) $$, (select id from ids where name = 'me')),
  $$ values (true, false) $$,
  'own profile is marked is_me');
select throws_ok(format($$ select * from public.get_student_profile(%L) $$, gen_random_uuid()),
  'P0001', 'not_found', 'unknown student: not_found');

-- Follow and unfollow (US-12 AC1, AC3).
select is(public.follow_student((select id from ids where name = 'eco_a')), true, 'follow returns true');
select is((select is_following from public.get_student_profile((select id from ids where name = 'eco_a'))), true,
  'profile shows following after a follow (state is stored, so it survives a refresh)');
select is(public.follow_student((select id from ids where name = 'eco_a')), true, 'following twice is accepted');
select is((select count(*)::integer from public.follows where follower_id = (select id from ids where name = 'me')), 1,
  'following twice stores one follow (no duplicates)');
select throws_ok(format($$ select public.follow_student(%L) $$, (select id from ids where name = 'me')),
  'P0001', 'cannot_follow_self', 'you cannot follow yourself');
select throws_ok(format($$ select public.follow_student(%L) $$, gen_random_uuid()),
  'P0001', 'not_found', 'following an unknown student: not_found');

-- One-way (US-12 AC2): the followed student doesn't follow back and has nothing to approve.
select pg_temp.act_as((select id from ids where name = 'eco_a'));
select is((select is_following from public.get_student_profile((select id from ids where name = 'me'))), false,
  'following is one-way');
select pg_temp.act_as((select id from ids where name = 'me'));

select is(public.unfollow_student((select id from ids where name = 'eco_a')), false, 'unfollow returns false');
select is((select is_following from public.get_student_profile((select id from ids where name = 'eco_a'))), false,
  'profile shows not following after an unfollow');
select is(public.unfollow_student((select id from ids where name = 'eco_a')), false, 'unfollowing again changes nothing');

-- Privacy (US-01 AC8, US-11 AC4): no result contains another student's email, names or date of birth.
select public.follow_student((select id from ids where name = 'eco_b'));
select is_empty(
  $$ select 'search' from public.search_students('pgtap') s
     where row_to_json(s)::text ~* 'privatefirst|privatelast|1999-07-07|@social\.test'
     union all
     select 'profile' from ids, lateral public.get_student_profile(ids.id) p
     where row_to_json(p)::text ~* 'privatefirst|privatelast|1999-07-07|@social\.test' $$,
  'search and profile results never contain email, first name, last name or date of birth');

select * from finish();
rollback;
