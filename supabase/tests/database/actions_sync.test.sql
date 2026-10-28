/*
 * actions.json loader tests (US-08, US-14 AC1): private.sync_actions adds, updates and hides actions,
 * and refuses an invalid list as a whole, leaving the table unchanged. Run with `supabase test db`.
 */
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

-- Start from a known list (this also hides whatever actions.json loaded earlier).
select lives_ok($$ select private.sync_actions('[
  {"key": "a", "label": "Action A", "points": 10, "daily_limit": 5, "co2_g": 40},
  {"key": "b", "label": "  Action B  ", "points": 5, "daily_limit": 3, "co2_g": 0}
]') $$, 'a valid list loads');
select results_eq(
  $$ select key, label, points, daily_limit, co2_g, position from public.actions where active order by position $$,
  $$ values ('a', 'Action A', 10, 5, 40, 1), ('b', 'Action B', 5, 3, 0, 2) $$,
  'actions are stored in file order, labels trimmed');

-- Edit, reorder and remove.
select lives_ok($$ select private.sync_actions('[
  {"key": "b", "label": "Action B renamed", "points": 7, "daily_limit": 1, "co2_g": 20},
  {"key": "c", "label": "Action C", "points": 15, "daily_limit": 2, "co2_g": 1500}
]') $$, 'an edited list loads');
select results_eq(
  $$ select key, label, points, daily_limit, co2_g, position from public.actions where active order by position $$,
  $$ values ('b', 'Action B renamed', 7, 1, 20, 1), ('c', 'Action C', 15, 2, 1500, 2) $$,
  'label, points, limit, CO2 and order follow the file');
select is((select active from public.actions where key = 'a'), false, 'an action removed from the file becomes inactive');

-- Adding it back makes it active again.
select private.sync_actions('[{"key": "a", "label": "Action A", "points": 10, "daily_limit": 5, "co2_g": 40}]');
select is((select active from public.actions where key = 'a'), true, 'an action added back is active again');
select is((select count(*)::integer from public.actions where active), 1, 'only the actions in the file are active');

-- Invalid lists are refused with a message naming the entry, and nothing changes.
create temporary table snapshot as select * from public.actions;

select throws_ok($$ select private.sync_actions('{}') $$, 'P0001', 'actions.json must be a list (a JSON array) of actions.', 'not an array');
select throws_ok($$ select private.sync_actions('[]') $$, 'P0001', 'actions.json must contain at least one action.', 'empty list');
select throws_ok($$ select private.sync_actions('["x"]') $$, 'P0001',
  'actions.json entry 1 must be an object with the fields key, label, points, daily_limit, co2_g.', 'entry not an object');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": 1, "daily_limit": 1}]') $$, 'P0001',
  'actions.json entry 1 ("a") is missing the field "co2_g".', 'missing co2_g');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": 1, "daily_limit": 1, "co2_g": 1, "icon": "x"}]') $$, 'P0001',
  'actions.json entry 1 ("a") has an unknown field "icon".', 'unknown field');
select throws_ok($$ select private.sync_actions('[{"key": "Bad Key", "label": "A", "points": 1, "daily_limit": 1, "co2_g": 1}]') $$, 'P0001',
  'actions.json entry 1 ("Bad Key"): "key" must be 1 to 50 characters: lowercase letters, digits or underscore.', 'invalid key');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": 1, "daily_limit": 1, "co2_g": 1},
                                               {"key": "a", "label": "B", "points": 1, "daily_limit": 1, "co2_g": 1}]') $$, 'P0001',
  'actions.json entry 2 ("a"): the key "a" is used more than once.', 'duplicate key');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "   ", "points": 1, "daily_limit": 1, "co2_g": 1}]') $$, 'P0001',
  'actions.json entry 1 ("a"): "label" must be text of 1 to 200 characters.', 'blank label');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": 1, "daily_limit": 1, "co2_g": 1},
                                               {"key": "b", "label": "B", "points": 0, "daily_limit": 1, "co2_g": 1}]') $$, 'P0001',
  'actions.json entry 2 ("b"): "points" must be a whole number of at least 1.', '0 points (second entry)');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": 1.5, "daily_limit": 1, "co2_g": 1}]') $$, 'P0001',
  'actions.json entry 1 ("a"): "points" must be a whole number of at least 1.', 'fractional points');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": "10", "daily_limit": 1, "co2_g": 1}]') $$, 'P0001',
  'actions.json entry 1 ("a"): "points" must be a whole number of at least 1.', 'points as text');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": 1, "daily_limit": 0, "co2_g": 1}]') $$, 'P0001',
  'actions.json entry 1 ("a"): "daily_limit" must be a whole number of at least 1.', 'daily limit 0');
select throws_ok($$ select private.sync_actions('[{"key": "a", "label": "A", "points": 1, "daily_limit": 1, "co2_g": -1}]') $$, 'P0001',
  'actions.json entry 1 ("a"): "co2_g" must be a whole number of grams, 0 or more.', 'negative CO2');

select set_eq($$ select * from public.actions $$, $$ select * from snapshot $$, 'refused lists leave the table unchanged');

select * from finish();
rollback;
