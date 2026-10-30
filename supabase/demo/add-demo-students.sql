/*
 * OPTIONAL demo data for testing the live leaderboard (US-06 AC3, AC4).
 *
 * Adds 24 fake demo students (demo01 to demo24, emails ending in @demo.invalid) with points this week,
 * so the "Everyone" leaderboard has more than 20 students and a new student's own row appears below
 * the list with their rank. The demo students have no password and can't log in. They also appear in
 * "Find students". Remove them after testing with remove-demo-students.sql.
 *
 * How to run: Supabase dashboard → SQL Editor → paste this file → Run. Running it twice adds nothing
 * new (existing demo students are skipped). The points are dated today, so they count for the current
 * week only; next Monday the demo students are back at 0. If a real student already has one of the
 * nicknames demo01 to demo24, the script stops with "nickname_taken" and adds nothing.
 */
with demo as (
  select
    n,
    'demo' || lpad(n::text, 2, '0') as nickname,
    'demo' || lpad(n::text, 2, '0') || '@demo.invalid' as email,
    (array['ETH Zurich', 'University of Zurich', 'ZHAW', 'ZHdK', 'PHZH'])[1 + n % 5] as university
  from generate_series(1, 24) as n
),
new_students as (
  insert into auth.users (id, email, raw_user_meta_data)
  select gen_random_uuid(), d.email,
    jsonb_build_object('nickname', d.nickname, 'first_name', 'Demo', 'last_name', 'Student',
                       'date_of_birth', '2000-01-01', 'university', d.university)
  from demo d
  where not exists (select 1 from auth.users a where a.email = d.email)
  returning id, email
)
insert into public.action_logs (user_id, action_key, points, co2_g)
select s.id, a.key, a.points, a.co2_g
from new_students s
join demo d on d.email = s.email
cross join lateral (
  -- Each demo student logs a different number of their first actions, so the points differ.
  select x.key, x.points, x.co2_g from public.actions x where x.active order by x.position limit 1 + d.n % 8
) a;
