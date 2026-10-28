/*
 * Sign-up trigger tests (US-01 AC1 to AC4): private.handle_new_user validates every profile field and
 * cancels the account on any invalid value. Accounts are inserted into auth.users directly, as Supabase
 * Auth does. Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

/* Builds sign-up metadata with valid defaults; pass a JSON object to override fields. */
create function pg_temp.meta(p_changes jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'nickname', 'pgtap_alex', 'first_name', 'Alex', 'last_name', 'Meier',
    'date_of_birth', '2000-05-12', 'university', 'ETH Zurich'
  ) || p_changes
$$;

/* Inserts an account like Supabase Auth does; the trigger runs on insert. */
create function pg_temp.sign_up(p_email text, p_meta jsonb)
returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), p_email, p_meta)
$$;

-- A valid sign-up creates the profile, with text trimmed.
select lives_ok(
  $$ select pg_temp.sign_up('alex@uni.test', pg_temp.meta('{"nickname": " pgtap_alex ", "first_name": "\tAlex\n", "university": " ETH Zurich "}')) $$,
  'valid sign-up is accepted'
);
select results_eq(
  $$ select nickname, first_name, last_name, date_of_birth, university from public.users u
     join auth.users a on a.id = u.id where a.email = 'alex@uni.test' $$,
  $$ values ('pgtap_alex', 'Alex', 'Meier', date '2000-05-12', 'ETH Zurich') $$,
  'profile row is created with trimmed values'
);

-- Email unique regardless of case (Supabase Auth also checks; this is the second lock).
select throws_ok($$ select pg_temp.sign_up('ALEX@UNI.TEST', pg_temp.meta('{"nickname": "pgtap_other_1"}')) $$,
  'P0001', 'email_taken', 'duplicate email in another case is refused');

-- Nickname: 3 to 20 letters, digits, underscore; unique regardless of case.
select throws_ok($$ select pg_temp.sign_up('n1@uni.test', pg_temp.meta('{"nickname": "PGTAP_ALEX"}')) $$,
  'P0001', 'nickname_taken', 'duplicate nickname in another case is refused');
select throws_ok($$ select pg_temp.sign_up('n2@uni.test', pg_temp.meta('{"nickname": "ab"}')) $$,
  'P0001', 'invalid_input: nickname', '2-character nickname is refused');
select throws_ok($$ select pg_temp.sign_up('n3@uni.test', pg_temp.meta('{"nickname": "abcdefghijklmnopqrstu"}')) $$,
  'P0001', 'invalid_input: nickname', '21-character nickname is refused');
select throws_ok($$ select pg_temp.sign_up('n4@uni.test', pg_temp.meta('{"nickname": "pgtap-alex"}')) $$,
  'P0001', 'invalid_input: nickname', 'nickname with a hyphen is refused');
select throws_ok($$ select pg_temp.sign_up('n5@uni.test', pg_temp.meta('{"nickname": "pgtap_zoë"}')) $$,
  'P0001', 'invalid_input: nickname', 'nickname with an accented letter is refused (D1)');
select lives_ok($$ select pg_temp.sign_up('n6@uni.test', pg_temp.meta('{"nickname": "Pgtap_20_chars_long_"}')) $$,
  '20-character nickname is accepted');
select throws_ok($$ select pg_temp.sign_up('n7@uni.test', '{}'::jsonb) $$,
  'P0001', 'invalid_input: nickname', 'missing metadata is refused');

-- First and last name: 1 to 50 characters after trimming (characters, not bytes).
select throws_ok($$ select pg_temp.sign_up('f1@uni.test', pg_temp.meta('{"nickname": "pgtap_f1", "first_name": "   "}')) $$,
  'P0001', 'invalid_input: first_name', 'blank first name is refused');
select throws_ok($$ select pg_temp.sign_up('f2@uni.test', pg_temp.meta(jsonb_build_object('nickname', 'pgtap_f2', 'first_name', repeat('a', 51)))) $$,
  'P0001', 'invalid_input: first_name', '51-character first name is refused');
select lives_ok($$ select pg_temp.sign_up('f3@uni.test', pg_temp.meta(jsonb_build_object('nickname', 'pgtap_f3', 'first_name', repeat('é', 50)))) $$,
  '50-character first name with accents is accepted');
select throws_ok($$ select pg_temp.sign_up('l1@uni.test', pg_temp.meta('{"nickname": "pgtap_l1", "last_name": ""}')) $$,
  'P0001', 'invalid_input: last_name', 'empty last name is refused');
select throws_ok($$ select pg_temp.sign_up('l2@uni.test', pg_temp.meta(jsonb_build_object('nickname', 'pgtap_l2', 'last_name', repeat('b', 51)))) $$,
  'P0001', 'invalid_input: last_name', '51-character last name is refused');

-- Date of birth: a real date, from 1900, not in the future, at least 16 on today's Zürich date.
select throws_ok($$ select pg_temp.sign_up('d1@uni.test', pg_temp.meta('{"nickname": "pgtap_d1", "date_of_birth": "12.05.2000"}')) $$,
  'P0001', 'invalid_input: date_of_birth', 'date in a non-ISO format is refused');
select throws_ok($$ select pg_temp.sign_up('d2@uni.test', pg_temp.meta('{"nickname": "pgtap_d2", "date_of_birth": "2001-02-30"}')) $$,
  'P0001', 'invalid_input: date_of_birth', 'non-existent date is refused');
select throws_ok($$ select pg_temp.sign_up('d3@uni.test', pg_temp.meta(jsonb_build_object('nickname', 'pgtap_d3', 'date_of_birth', (private.zurich_today() + 1)::text))) $$,
  'P0001', 'invalid_input: date_of_birth', 'future date is refused');
select throws_ok($$ select pg_temp.sign_up('d4@uni.test', pg_temp.meta('{"nickname": "pgtap_d4", "date_of_birth": "1899-12-31"}')) $$,
  'P0001', 'invalid_input: date_of_birth', 'date before 1900 is refused (D9)');
select lives_ok($$ select pg_temp.sign_up('d5@uni.test', pg_temp.meta('{"nickname": "pgtap_d5", "date_of_birth": "1900-01-01"}')) $$,
  '1 January 1900 is accepted');
select lives_ok($$ select pg_temp.sign_up('d6@uni.test', pg_temp.meta(jsonb_build_object('nickname', 'pgtap_d6', 'date_of_birth', (private.zurich_today() - interval '16 years')::date::text))) $$,
  'exactly 16 today is accepted');
select throws_ok($$ select pg_temp.sign_up('d7@uni.test', pg_temp.meta(jsonb_build_object('nickname', 'pgtap_d7', 'date_of_birth', ((private.zurich_today() - interval '16 years')::date + 1)::text))) $$,
  'P0001', 'too_young', '15 years and 364 days is refused');

-- University: 2 to 60 characters after trimming.
select throws_ok($$ select pg_temp.sign_up('u1@uni.test', pg_temp.meta('{"nickname": "pgtap_u1", "university": " E "}')) $$,
  'P0001', 'invalid_input: university', '1-character university is refused');
select throws_ok($$ select pg_temp.sign_up('u2@uni.test', pg_temp.meta(jsonb_build_object('nickname', 'pgtap_u2', 'university', repeat('u', 61)))) $$,
  'P0001', 'invalid_input: university', '61-character university is refused');
select lives_ok($$ select pg_temp.sign_up('u3@uni.test', pg_temp.meta('{"nickname": "pgtap_u3", "university": "UZ"}')) $$,
  '2-character university is accepted');

-- A refused sign-up leaves no account behind (the whole insert is cancelled).
select is((select count(*)::integer from auth.users where email = 'd7@uni.test'), 0, 'refused sign-up creates no account');
select is((select count(*)::integer from public.users u join auth.users a on a.id = u.id where a.email like '%@uni.test'),
  (select count(*)::integer from auth.users where email like '%@uni.test'),
  'every account has exactly one profile');

-- Deleting the account removes the profile too (cascade).
delete from auth.users where email = 'u3@uni.test';
select is((select count(*)::integer from public.users where nickname = 'pgtap_u3'), 0, 'deleting the account deletes the profile');

select * from finish();
rollback;
