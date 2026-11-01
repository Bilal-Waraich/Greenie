/*
 * Weekly leaderboards (US-06; milestone 2).
 *
 * Points this week are the sum of a student's log points with a Zürich date from this week's Monday
 * to Sunday (brief section 10), so a new week starts at 0 (AC2) and a new log counts at once (AC6).
 * Equal points are ordered alphabetically by nickname, ignoring letter case, with consecutive ranks
 * and no shared ranks (AC5). Only nicknames and points leave the database.
 */

/*
 * One leaderboard for the caller. p_tab is 'everyone' or 'following'.
 *
 * - everyone (AC3, AC4): the top 20 students with points this week. Everyone is ranked, including
 *   students with 0 points (after all students with points). If the caller isn't in that list, their
 *   own row is added with is_pinned = true and their real rank, so it can be shown below the list.
 *   When nobody has points yet this week, the list is empty (Figma S5 "empty list").
 * - following (AC3, AC7): the caller and every student they follow, ranked within that group, also
 *   with 0 points. Empty when the caller follows nobody, so the app shows the "not following" state.
 *
 * Returns rank, user id (to open the profile, AC8), nickname, points this week, is_me and is_pinned.
 */
create function public.get_leaderboard(p_tab text)
returns table (rank integer, user_id uuid, nickname text, week_points integer, is_me boolean, is_pinned boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_week_start date := private.week_start(private.zurich_today());
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_tab = 'everyone' then
    return query
    with week as (
      select u.id, u.nickname, coalesce(sum(l.points), 0)::integer as points
      from public.users u
      left join public.action_logs l
        on l.user_id = u.id and l.local_date_zurich between v_week_start and v_week_start + 6
      group by u.id, u.nickname
    ),
    ranked as (
      select w.id, w.nickname, w.points,
        row_number() over (order by w.points desc, lower(w.nickname) collate "C")::integer as place
      from week w
    ),
    listed as (
      select r.id from ranked r where r.points > 0 and r.place <= 20
    )
    select r.place, r.id, r.nickname, r.points, r.id = v_user, r.id not in (select x.id from listed x)
    from ranked r
    where r.id in (select x.id from listed x)
      or (r.id = v_user and exists (select 1 from listed))
    order by r.place;

  elsif p_tab = 'following' then
    if not exists (select 1 from public.follows f where f.follower_id = v_user) then
      return;
    end if;
    return query
    with members as (
      select v_user as id
      union
      select f.followed_id from public.follows f where f.follower_id = v_user
    ),
    week as (
      select u.id, u.nickname, coalesce(sum(l.points), 0)::integer as points
      from members m
      join public.users u on u.id = m.id
      left join public.action_logs l
        on l.user_id = u.id and l.local_date_zurich between v_week_start and v_week_start + 6
      group by u.id, u.nickname
    )
    select
      (row_number() over (order by w.points desc, lower(w.nickname) collate "C"))::integer,
      w.id,
      w.nickname,
      w.points,
      w.id = v_user,
      false
    from week w
    order by 1;

  else
    raise exception 'invalid_input: tab';
  end if;
end;
$$;

revoke all on function public.get_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_leaderboard(text) to authenticated;
