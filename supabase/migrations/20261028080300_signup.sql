/*
 * Sign-up (US-01): creates the student profile when Supabase Auth creates an account.
 *
 * The browser sends the profile fields as sign-up metadata. This trigger trims and validates them with
 * the same rules as the form (frontend/src/lib/validation.js) and inserts public.users. Any invalid
 * field raises an error, which makes Supabase Auth cancel the sign-up: no account is created
 * (US-01 AC2 to AC4). The metadata is read only here, never again (users can change their own metadata).
 */

/* Trigger function: validates the sign-up fields and inserts the profile row. */
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nickname text := private.trim_edges(coalesce(v_meta ->> 'nickname', ''));
  v_first_name text := private.trim_edges(coalesce(v_meta ->> 'first_name', ''));
  v_last_name text := private.trim_edges(coalesce(v_meta ->> 'last_name', ''));
  v_birth_text text := private.trim_edges(coalesce(v_meta ->> 'date_of_birth', ''));
  v_university text := private.trim_edges(coalesce(v_meta ->> 'university', ''));
  v_today date := private.zurich_today();
  v_birth date;
begin
  if new.email is not null and exists (
    select 1 from auth.users a where lower(a.email) = lower(new.email) and a.id <> new.id
  ) then
    raise exception 'email_taken';
  end if;

  if v_nickname !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_input: nickname';
  end if;
  if exists (select 1 from public.users u where lower(u.nickname) = lower(v_nickname)) then
    raise exception 'nickname_taken';
  end if;

  if char_length(v_first_name) not between 1 and 50 then
    raise exception 'invalid_input: first_name';
  end if;
  if char_length(v_last_name) not between 1 and 50 then
    raise exception 'invalid_input: last_name';
  end if;

  /* Date of birth: an ISO date (YYYY-MM-DD) that exists, from 1 Jan 1900, not in the future. */
  if v_birth_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'invalid_input: date_of_birth';
  end if;
  begin
    v_birth := v_birth_text::date;
  exception when others then
    raise exception 'invalid_input: date_of_birth';
  end;
  if v_birth < date '1900-01-01' or v_birth > v_today then
    raise exception 'invalid_input: date_of_birth';
  end if;
  /* At least 16 on today's Zürich date. 29 February + 16 years is 29 February again (or 28th). */
  if (v_birth + interval '16 years')::date > v_today then
    raise exception 'too_young';
  end if;

  if char_length(v_university) not between 2 and 60 then
    raise exception 'invalid_input: university';
  end if;

  insert into public.users (id, nickname, first_name, last_name, date_of_birth, university)
  values (new.id, v_nickname, v_first_name, v_last_name, v_birth, v_university);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on function private.handle_new_user() from public, anon, authenticated;
