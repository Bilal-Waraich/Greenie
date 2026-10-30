/*
 * Find students, student profiles, follow and unfollow (US-11, US-12; milestone 2).
 *
 * Same rules as the milestone 1 API: every function runs as its owner (security definer) with an
 * empty search path, needs a logged-in student, and returns only what other students may see:
 * nickname, university, points, streak and earned badges. Never email, first name, last name or date
 * of birth (US-01 AC8, US-11 AC4). Errors use fixed messages that frontend/src/lib/errors.js turns into
 * text: not_authenticated, not_found, cannot_follow_self.
 */

/*
 * Find students (US-11 AC1, AC2): nicknames containing the search text, ignoring letter case, after
 * trimming. Up to 20 results with nickname and university, in alphabetical order. An empty search
 * returns nothing. strpos is used instead of LIKE, so "%" and "_" in the search are plain characters.
 * The caller can find themself too (their profile has no Follow button).
 */
create function public.search_students(p_query text)
returns table (id uuid, nickname text, university text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_query text := lower(private.trim_edges(coalesce(p_query, '')));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if v_query = '' then
    return;
  end if;
  return query
  select u.id, u.nickname, u.university
  from public.users u
  where strpos(lower(u.nickname), v_query) > 0
  order by lower(u.nickname) collate "C"
  limit 20;
end;
$$;

/*
 * A student's profile (US-11 AC3, AC4; US-12 AC1; US-15 AC5): nickname, university, total points,
 * points this week (Monday to Sunday, Zürich), current streak, earned badges, whether the caller follows
 * them, and whether it is the caller's own profile. Raises not_found for an unknown id.
 */
create function public.get_student_profile(p_id uuid)
returns table (
  id uuid,
  nickname text,
  university text,
  total_points integer,
  week_points integer,
  streak integer,
  is_following boolean,
  is_me boolean,
  badges jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_today date := private.zurich_today();
  v_week_start date := private.week_start(private.zurich_today());
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  return query
  select
    u.id,
    u.nickname,
    u.university,
    coalesce((select sum(l.points) from public.action_logs l where l.user_id = u.id), 0)::integer,
    coalesce((select sum(l.points) from public.action_logs l
              where l.user_id = u.id and l.local_date_zurich between v_week_start and v_week_start + 6), 0)::integer,
    private.streak(u.id, v_today),
    exists (select 1 from public.follows f where f.follower_id = v_user and f.followed_id = u.id),
    u.id = v_user,
    private.earned_badges(u.id)
  from public.users u
  where u.id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

/*
 * Follows a student (US-12): one-way, no approval and no notification (AC2). Following yourself raises
 * cannot_follow_self; following someone twice changes nothing (AC3). Returns true (now following).
 */
create function public.follow_student(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_id = v_user then
    raise exception 'cannot_follow_self';
  end if;
  if not exists (select 1 from public.users u where u.id = v_user)
    or not exists (select 1 from public.users u where u.id = p_id) then
    raise exception 'not_found';
  end if;
  insert into public.follows (follower_id, followed_id)
  values (v_user, p_id)
  on conflict (follower_id, followed_id) do nothing;
  return true;
end;
$$;

/* Stops following a student (US-12 AC1). Unfollowing someone not followed changes nothing. Returns false. */
create function public.unfollow_student(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.follows f where f.follower_id = v_user and f.followed_id = p_id;
  return false;
end;
$$;

revoke all on function public.search_students(text) from public, anon, authenticated;
revoke all on function public.get_student_profile(uuid) from public, anon, authenticated;
revoke all on function public.follow_student(uuid) from public, anon, authenticated;
revoke all on function public.unfollow_student(uuid) from public, anon, authenticated;

grant execute on function public.search_students(text) to authenticated;
grant execute on function public.get_student_profile(uuid) to authenticated;
grant execute on function public.follow_student(uuid) to authenticated;
grant execute on function public.unfollow_student(uuid) to authenticated;
