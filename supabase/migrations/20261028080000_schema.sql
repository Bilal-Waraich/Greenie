/*
 * Greenie schema (brief section 10): student profiles, the action list, action logs and follows.
 *
 * - Email and the password hash live in Supabase Auth (auth.users, bcrypt); public.users references
 *   that account and holds the profile fields.
 * - Internal helpers live in the `private` schema, which the API does not expose.
 * - Row-level security is on for every table with NO policies, and all table privileges are revoked
 *   from the API roles. The browser can only call the functions in the *_api.sql migration.
 */

create schema if not exists private;
comment on schema private is 'Greenie internal helpers. Not exposed through the API.';
revoke all on schema private from public, anon, authenticated;

/*
 * Removes spaces, tabs and line breaks at both ends of a text. The browser uses the same character
 * set (frontend/src/lib/validation.js), so a value that passes the form also passes the database.
 */
create function private.trim_edges(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(p_text, '^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$', '', 'g')
$$;

/* Student profiles: one row per account, created by the sign-up trigger (private.handle_new_user). */
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z0-9_]{3,20}$'),
  first_name text not null
    check (char_length(first_name) between 1 and 50 and first_name = private.trim_edges(first_name)),
  last_name text not null
    check (char_length(last_name) between 1 and 50 and last_name = private.trim_edges(last_name)),
  date_of_birth date not null check (date_of_birth >= date '1900-01-01'),
  university text not null
    check (char_length(university) between 2 and 60 and university = private.trim_edges(university)),
  created_at timestamptz not null default now()
);
comment on table public.users is 'Student profiles. Nickname and university are public; names and date of birth never leave the database.';

/* Nicknames are unique regardless of letter case (US-01 AC3). */
create unique index users_nickname_lower_key on public.users (lower(nickname));

/* The action list, loaded from actions.json by private.sync_actions (US-08). */
create table public.actions (
  key text primary key check (key ~ '^[a-z0-9_]{1,50}$'),
  label text not null check (char_length(label) between 1 and 200),
  points integer not null check (points > 0),
  daily_limit integer not null check (daily_limit > 0),
  co2_g integer not null check (co2_g >= 0),
  position integer not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.actions is 'Loaded from actions.json. Inactive rows are actions removed from the file; old logs keep them.';
comment on column public.actions.position is 'Order in actions.json; the Log screen uses it.';

/*
 * One row per logged action. Points and CO2 grams are copied from the action at logging time, so
 * later changes to actions.json don't rewrite history (US-14 AC5).
 * local_date_zurich is always set by a trigger (private.set_local_date) from logged_at_utc.
 */
create table public.action_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  action_key text not null references public.actions (key),
  points integer not null check (points > 0),
  co2_g integer not null check (co2_g >= 0),
  logged_at_utc timestamptz not null default now(),
  local_date_zurich date not null
);
create index action_logs_user_day_idx on public.action_logs (user_id, local_date_zurich);
create index action_logs_day_user_idx on public.action_logs (local_date_zurich, user_id);
create index action_logs_user_time_idx on public.action_logs (user_id, logged_at_utc desc);
create index action_logs_action_key_idx on public.action_logs (action_key);

/* Who follows whom (milestone 2 uses it). Each pair at most once; nobody follows themselves. */
create table public.follows (
  follower_id uuid not null references public.users (id) on delete cascade,
  followed_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index follows_followed_idx on public.follows (followed_id);

/* Lock the tables twice: RLS without policies, and no privileges for the API roles. */
alter table public.users enable row level security;
alter table public.actions enable row level security;
alter table public.action_logs enable row level security;
alter table public.follows enable row level security;

revoke all on table public.users, public.actions, public.action_logs, public.follows
  from public, anon, authenticated;
revoke all on sequence public.action_logs_id_seq from public, anon, authenticated;
revoke all on function private.trim_edges(text) from public, anon, authenticated;
