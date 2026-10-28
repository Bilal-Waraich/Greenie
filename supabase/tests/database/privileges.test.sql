/*
 * Access and privacy tests (US-01 AC8, NFR security).
 *
 * Checks that the API roles (anon = visitors, authenticated = logged-in students) can't read or write
 * any table directly, can call only the intended functions, can't reach the private schema, and that no
 * API function returns email, first name, last name or date of birth.
 * Run with `supabase test db` in the repository root.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

-- The API exposes exactly these functions in public; anything else would be an accidental endpoint.
select functions_are(
  'public',
  array['nickname_available', 'get_my_status', 'get_log_actions', 'log_action'],
  'public schema has only the intended API functions'
);

-- Visitors can only check a nickname; logged-in students can call all four.
select ok(has_function_privilege('anon', 'public.nickname_available(text)', 'execute'), 'anon can call nickname_available');
select ok(not has_function_privilege('anon', 'public.get_my_status()', 'execute'), 'anon cannot call get_my_status');
select ok(not has_function_privilege('anon', 'public.get_log_actions()', 'execute'), 'anon cannot call get_log_actions');
select ok(not has_function_privilege('anon', 'public.log_action(text)', 'execute'), 'anon cannot call log_action');
select ok(has_function_privilege('authenticated', 'public.nickname_available(text)', 'execute'), 'authenticated can call nickname_available');
select ok(has_function_privilege('authenticated', 'public.get_my_status()', 'execute'), 'authenticated can call get_my_status');
select ok(has_function_privilege('authenticated', 'public.get_log_actions()', 'execute'), 'authenticated can call get_log_actions');
select ok(has_function_privilege('authenticated', 'public.log_action(text)', 'execute'), 'authenticated can call log_action');
select ok(not has_function_privilege('public', 'public.log_action(text)', 'execute'), 'PUBLIC has no execute on log_action');

-- Nothing in the private schema is reachable from the API.
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon has no usage on schema private');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated has no usage on schema private');
select is_empty(
  $$ select p.proname, r.role
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join (values ('anon'), ('authenticated')) as r(role)
     where n.nspname = 'private' and has_function_privilege(r.role, p.oid, 'execute') $$,
  'no private function is executable by anon or authenticated'
);

-- No table or sequence privileges for the API roles, and RLS on with no policies.
select is_empty(
  $$ select c.relname, r.role
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     cross join (values ('anon'), ('authenticated')) as r(role)
     where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'S')
       and (
         (c.relkind = 'S' and has_sequence_privilege(r.role, c.oid, 'usage,select,update'))
         or (c.relkind <> 'S' and has_table_privilege(r.role, c.oid, 'select,insert,update,delete,truncate,references,trigger'))
       ) $$,
  'anon and authenticated have no privileges on any public table, view or sequence'
);
select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('users', 'actions', 'action_logs', 'follows') and c.relrowsecurity),
  4,
  'row-level security is enabled on all four tables'
);
select is_empty($$ select * from pg_policies where schemaname = 'public' $$, 'no RLS policies exist (direct access is denied)');

-- Every API function runs as its owner with an empty search path.
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (not p.prosecdef or not coalesce(p.proconfig, '{}') @> array['search_path=""']) $$,
  'every public function is security definer with search_path set to empty'
);

-- Privacy: no API function has a parameter or result column with a private field's name, and none
-- returns a whole profile row.
select is_empty(
  $$ select p.proname, a.name
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join lateral unnest(coalesce(p.proargnames, '{}')) as a(name)
     where n.nspname = 'public' and a.name in ('email', 'first_name', 'last_name', 'date_of_birth') $$,
  'no public function returns email, first_name, last_name or date_of_birth'
);
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype in ('public.users'::regtype, 'auth.users'::regtype, 'record'::regtype)
       and p.proargmodes is null $$,
  'no public function returns a whole profile or an untyped record'
);

select * from finish();
rollback;
