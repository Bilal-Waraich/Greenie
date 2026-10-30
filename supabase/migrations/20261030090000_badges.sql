/*
 * Badges (US-15, "Could"): the badges from badges.json and which ones a student has earned.
 *
 * badges.json is loaded into public.badges by private.sync_badges, the same way actions.json is
 * loaded (scripts/badges-to-sql.mjs, run by the deploy and by `npm run db:reset`). Earned badges are
 * not stored: they are computed from the student's log entries (brief section 10), so badges never
 * change points, streaks or rankings (US-15 AC6). The three rules only grow with new logs (number of
 * logs, total points, longest streak ever), so a badge stays earned once its rule is met (AC2).
 *
 * Also replaces public.log_action with a version that returns the badges a log has just earned
 * (US-15 AC4). Its other columns are unchanged, so the milestone 1 front end keeps working.
 */

/* Badge definitions, loaded from badges.json. Inactive rows are badges removed from the file. */
create table public.badges (
  key text primary key check (key ~ '^[a-z0-9_]{1,50}$'),
  label text not null check (char_length(label) between 1 and 100),
  rule text not null check (rule in ('logs', 'points', 'streak')),
  threshold integer not null check (threshold > 0),
  position integer not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.badges is 'Loaded from badges.json. Earned badges are computed from the logs and not stored.';
comment on column public.badges.rule is 'logs: number of logged actions; points: total points; streak: longest streak ever.';

alter table public.badges enable row level security;
revoke all on table public.badges from public, anon, authenticated;

/*
 * Validates the whole badge list, then adds or updates every badge (label, rule, threshold, order) and
 * marks badges that are no longer in the file as inactive. The rules match scripts/lib/badges-rules.mjs.
 * Any invalid entry raises an error naming the entry, and the whole load is cancelled.
 */
create function private.sync_badges(p_badges jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields constant text[] := array['key', 'label', 'rule', 'threshold'];
  v_entry jsonb;
  v_index integer;
  v_name text;
  v_keys text[] := '{}';
  v_problem text;
begin
  if p_badges is null or jsonb_typeof(p_badges) <> 'array' then
    raise exception 'badges.json must be a list (a JSON array) of badges.';
  end if;
  if jsonb_array_length(p_badges) = 0 then
    raise exception 'badges.json must contain at least one badge.';
  end if;

  for v_entry, v_index in
    select e.value, e.ordinality::integer from jsonb_array_elements(p_badges) with ordinality as e
  loop
    v_name := format('badges.json entry %s', v_index);
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
      or char_length(private.trim_edges(v_entry ->> 'label')) not between 1 and 100 then
      raise exception '%: "label" must be text of 1 to 100 characters.', v_name;
    end if;
    if jsonb_typeof(v_entry -> 'rule') <> 'string' or (v_entry ->> 'rule') not in ('logs', 'points', 'streak') then
      raise exception '%: "rule" must be "logs", "points" or "streak".', v_name;
    end if;
    if not private.is_whole_number(v_entry -> 'threshold', 1) then
      raise exception '%: "threshold" must be a whole number of at least 1.', v_name;
    end if;
  end loop;

  insert into public.badges as b (key, label, rule, threshold, position, active, updated_at)
  select
    e.value ->> 'key',
    private.trim_edges(e.value ->> 'label'),
    e.value ->> 'rule',
    (e.value ->> 'threshold')::integer,
    e.ordinality::integer,
    true,
    now()
  from jsonb_array_elements(p_badges) with ordinality as e
  on conflict (key) do update set
    label = excluded.label,
    rule = excluded.rule,
    threshold = excluded.threshold,
    position = excluded.position,
    active = true,
    updated_at = now();

  update public.badges b
  set active = false, updated_at = now()
  where b.active and b.key <> all (v_keys);
end;
$$;

/*
 * The longest run of consecutive Zürich days with at least one log, ever (the "streak" badge rule,
 * US-15 AC2). Days are numbered in order; days of one unbroken run share the same day minus number.
 */
create function private.longest_streak(p_user uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(runs.length), 0)::integer
  from (
    select count(*) as length
    from (
      select d.day - (row_number() over (order by d.day))::integer as run_id
      from (select distinct l.local_date_zurich as day from public.action_logs l where l.user_id = p_user) d
    ) numbered
    group by numbered.run_id
  ) runs
$$;

/*
 * Every active badge in badges.json order, with whether the student has earned it: the number of
 * logs, the total points or the longest streak ever has reached the badge's threshold.
 */
create function private.badge_progress(p_user uuid)
returns table (key text, label text, rule text, threshold integer, sort_order integer, earned boolean)
language sql
stable
set search_path = ''
as $$
  with stats as (
    select
      (select count(*) from public.action_logs l where l.user_id = p_user) as logs,
      (select coalesce(sum(l.points), 0) from public.action_logs l where l.user_id = p_user) as points,
      private.longest_streak(p_user) as longest
  )
  select
    b.key,
    b.label,
    b.rule,
    b.threshold,
    b.position,
    case b.rule
      when 'logs' then s.logs >= b.threshold
      when 'points' then s.points >= b.threshold
      else s.longest >= b.threshold
    end
  from public.badges b
  cross join stats s
  where b.active
  order by b.position, b.key
$$;

/* The badges a student has earned, in badges.json order, as [{"key": ..., "label": ...}]. */
create function private.earned_badges(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', p.key, 'label', p.label) order by p.sort_order, p.key), '[]'::jsonb)
  from private.badge_progress(p_user) p
  where p.earned
$$;

/* My badges screen (US-15 AC3): every badge with its rule and whether the caller has earned it. */
create function public.get_my_badges()
returns table (key text, label text, rule text, threshold integer, earned boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select p.key, p.label, p.rule, p.threshold, p.earned
  from private.badge_progress(v_user) p
  order by p.sort_order, p.key;
end;
$$;

/*
 * Logs one action for the caller (US-03 AC2, AC4; US-04; US-14 AC5; US-15 AC4). Same as the milestone 1
 * version, plus new_badges: the badges this log has just earned, as [{"key": ..., "label": ...}].
 * Locks the caller's profile row first, so two quick taps are handled one after the other and can't
 * both pass the daily limit. At the limit it raises daily_limit_reached and adds nothing.
 */
drop function public.log_action(text);

create function public.log_action(p_action_key text)
returns table (
  points_added integer,
  total_points integer,
  today_points integer,
  streak integer,
  streak_increased boolean,
  used_today integer,
  daily_limit integer,
  co2_g integer,
  new_badges jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_today date;
  v_action public.actions%rowtype;
  v_used integer;
  v_streak_before integer;
  v_streak_after integer;
  v_badges_before jsonb;
  v_badges_after jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  perform 1 from public.users u where u.id = v_user for update;
  if not found then
    raise exception 'not_found';
  end if;

  v_today := private.zurich_today();
  select * into v_action from public.actions a where a.key = p_action_key and a.active;
  if not found then
    raise exception 'unknown_action';
  end if;

  select count(*)::integer into v_used
  from public.action_logs l
  where l.user_id = v_user and l.action_key = v_action.key and l.local_date_zurich = v_today;
  if v_used >= v_action.daily_limit then
    raise exception 'daily_limit_reached';
  end if;

  v_streak_before := private.streak(v_user, v_today);
  v_badges_before := private.earned_badges(v_user);
  insert into public.action_logs (user_id, action_key, points, co2_g)
  values (v_user, v_action.key, v_action.points, v_action.co2_g);
  v_streak_after := private.streak(v_user, v_today);
  v_badges_after := private.earned_badges(v_user);

  return query
  select
    v_action.points,
    coalesce((select sum(l.points) from public.action_logs l where l.user_id = v_user), 0)::integer,
    coalesce((select sum(l.points) from public.action_logs l
              where l.user_id = v_user and l.local_date_zurich = v_today), 0)::integer,
    v_streak_after,
    v_streak_after > v_streak_before,
    v_used + 1,
    v_action.daily_limit,
    v_action.co2_g,
    coalesce((
      select jsonb_agg(after_badge.value order by after_badge.ordinality)
      from jsonb_array_elements(v_badges_after) with ordinality as after_badge
      where not exists (
        select 1 from jsonb_array_elements(v_badges_before) as before_badge
        where before_badge.value ->> 'key' = after_badge.value ->> 'key'
      )
    ), '[]'::jsonb);
end;
$$;

/* Privileges: revoke the defaults, then grant exactly what the API needs. */
revoke all on function private.sync_badges(jsonb) from public, anon, authenticated;
revoke all on function private.longest_streak(uuid) from public, anon, authenticated;
revoke all on function private.badge_progress(uuid) from public, anon, authenticated;
revoke all on function private.earned_badges(uuid) from public, anon, authenticated;
revoke all on function public.get_my_badges() from public, anon, authenticated;
revoke all on function public.log_action(text) from public, anon, authenticated;

grant execute on function public.get_my_badges() to authenticated;
grant execute on function public.log_action(text) to authenticated;
