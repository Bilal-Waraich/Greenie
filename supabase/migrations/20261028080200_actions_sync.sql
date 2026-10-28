/*
 * Loads actions.json into public.actions (US-08, US-14 AC1).
 *
 * scripts/actions-to-sql.mjs prints `select private.sync_actions(<file content>::jsonb);`, which the
 * deploy workflow and `npm run db:reset` pipe into psql. The rules match scripts/lib/actions-rules.mjs.
 * Any invalid entry raises an error naming the entry, and the whole load is cancelled.
 */

/* True when p_value is a JSON number with a whole value between p_min and the integer maximum. */
create function private.is_whole_number(p_value jsonb, p_min integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'number' then
      (p_value::text)::numeric = trunc((p_value::text)::numeric)
      and (p_value::text)::numeric between p_min and 2147483647
    else false
  end
$$;

/*
 * Validates the whole list, then adds or updates every action (label, points, daily limit, CO2 grams,
 * order) and marks actions that are no longer in the file as inactive. Past logs are never changed.
 */
create function private.sync_actions(p_actions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields constant text[] := array['key', 'label', 'points', 'daily_limit', 'co2_g'];
  v_entry jsonb;
  v_index integer;
  v_name text;
  v_keys text[] := '{}';
  v_problem text;
begin
  if p_actions is null or jsonb_typeof(p_actions) <> 'array' then
    raise exception 'actions.json must be a list (a JSON array) of actions.';
  end if;
  if jsonb_array_length(p_actions) = 0 then
    raise exception 'actions.json must contain at least one action.';
  end if;

  for v_entry, v_index in
    select e.value, e.ordinality::integer from jsonb_array_elements(p_actions) with ordinality as e
  loop
    v_name := format('actions.json entry %s', v_index);
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception '% must be an object with the fields %.', v_name, array_to_string(v_fields, ', ');
    end if;
    if jsonb_typeof(v_entry -> 'key') = 'string' then
      v_name := format('%s ("%s")', v_name, v_entry ->> 'key');
    end if;

    select string_agg(format('"%s"', f), ', ') into v_problem
    from unnest(v_fields) as f where not v_entry ? f;
    if v_problem is not null then
      raise exception '% is missing the field %.', v_name, v_problem;
    end if;

    select string_agg(format('"%s"', k), ', ') into v_problem
    from jsonb_object_keys(v_entry) as k where k <> all (v_fields);
    if v_problem is not null then
      raise exception '% has an unknown field %.', v_name, v_problem;
    end if;

    if jsonb_typeof(v_entry -> 'key') <> 'string' or (v_entry ->> 'key') !~ '^[a-z0-9_]{1,50}$' then
      raise exception '%: "key" must be 1 to 50 characters: lowercase letters, digits or underscore.', v_name;
    end if;
    if (v_entry ->> 'key') = any (v_keys) then
      raise exception '%: the key "%" is used more than once.', v_name, v_entry ->> 'key';
    end if;
    v_keys := v_keys || (v_entry ->> 'key');

    if jsonb_typeof(v_entry -> 'label') <> 'string'
      or char_length(private.trim_edges(v_entry ->> 'label')) not between 1 and 200 then
      raise exception '%: "label" must be text of 1 to 200 characters.', v_name;
    end if;
    if not private.is_whole_number(v_entry -> 'points', 1) then
      raise exception '%: "points" must be a whole number of at least 1.', v_name;
    end if;
    if not private.is_whole_number(v_entry -> 'daily_limit', 1) then
      raise exception '%: "daily_limit" must be a whole number of at least 1.', v_name;
    end if;
    if not private.is_whole_number(v_entry -> 'co2_g', 0) then
      raise exception '%: "co2_g" must be a whole number of grams, 0 or more.', v_name;
    end if;
  end loop;

  insert into public.actions as a (key, label, points, daily_limit, co2_g, position, active, updated_at)
  select
    e.value ->> 'key',
    private.trim_edges(e.value ->> 'label'),
    (e.value ->> 'points')::integer,
    (e.value ->> 'daily_limit')::integer,
    (e.value ->> 'co2_g')::integer,
    e.ordinality::integer,
    true,
    now()
  from jsonb_array_elements(p_actions) with ordinality as e
  on conflict (key) do update set
    label = excluded.label,
    points = excluded.points,
    daily_limit = excluded.daily_limit,
    co2_g = excluded.co2_g,
    position = excluded.position,
    active = true,
    updated_at = now();

  update public.actions a
  set active = false, updated_at = now()
  where a.active and a.key <> all (v_keys);
end;
$$;

revoke all on function private.is_whole_number(jsonb, integer) from public, anon, authenticated;
revoke all on function private.sync_actions(jsonb) from public, anon, authenticated;
