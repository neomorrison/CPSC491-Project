-- Second migration: goals, joining challenges, and editing or deleting workouts.
-- These are UC-06 (goals), UC-13 (join a challenge) and UC-08 (workout history) in our proposal.
--
-- What changes:
-- - New goals and goal_completions tables, plus a goal_progress view the app can read.
-- - Challenges don't rotate anymore. The user joins the ones they want (max 3 at once),
--   and harder ones unlock at higher levels (min_level).
-- - Editing or deleting a workout adds a negative XP row instead of deleting XP rows,
--   so the XP history is never lost (offsetting entries).
-- - record_workout and delete_workout are replaced by save_workout_result, which the
--   log-workout and edit-workout functions call.

-- ---------------------------------------------------------------------------
-- XP ledger: keep XP rows when a workout is deleted
-- ---------------------------------------------------------------------------

alter table public.xp_events drop constraint xp_events_workout_id_fkey;
alter table public.xp_events add constraint xp_events_workout_id_fkey
  foreign key (workout_id) references public.workouts (id) on delete set null;
create index xp_events_workout_idx on public.xp_events (workout_id);

-- same formula as levels.ts and the user_progress view
create function public.level_for_xp(p_xp int) returns int
language sql immutable as $$
  select floor((1 + sqrt(1 + 0.08 * greatest(p_xp, 0))) / 2)::int;
$$;

-- ---------------------------------------------------------------------------
-- Goals
-- Weekly goals (workouts, minutes or active days per week) can be hit every week.
-- Milestone goals (a streak or a number of workouts) are done once and then marked completed.
-- ---------------------------------------------------------------------------

create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         text not null check (type in (
                 'workouts_per_week', 'minutes_per_week', 'active_days_per_week',
                 'streak', 'total_workouts')),
  target       int not null,
  name         text check (char_length(name) <= 60),
  status       text not null default 'active' check (status in ('active', 'completed', 'archived')),
  start_date   date not null default current_date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  -- allowed range for each type (same numbers as GOAL_LIMITS in goals.ts)
  constraint goal_target_range check (
    (type = 'workouts_per_week'    and target between 1 and 14) or
    (type = 'minutes_per_week'     and target between 10 and 1500) or
    (type = 'active_days_per_week' and target between 1 and 7) or
    (type = 'streak'               and target between 2 and 365) or
    (type = 'total_workouts'       and target between 1 and 1000))
);
create index goals_user_idx on public.goals (user_id);

-- only one active goal of each type per user
create unique index goals_one_active_per_type on public.goals (user_id, type) where status = 'active';

-- Goal XP can only be earned once per goal type per week. The key is the type and not the
-- goal id, so deleting a finished goal and making it again doesn't pay out twice.
create table public.goal_completions (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  goal_type    text not null,
  week_start   date not null,
  goal_id      uuid references public.goals (id) on delete set null,
  completed_at timestamptz not null default now(),
  primary key (user_id, goal_type, week_start)
);

-- rules for goals the app creates or edits:
-- new goals start today (in the user's time zone) as active, max 5 active goals,
-- and only the server can mark a goal completed
create function public.check_goal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_time_zone text;
  v_active    int;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'active' then
      raise exception 'new goals have to start as active' using errcode = '22023';
    end if;
    select time_zone into v_time_zone from public.profiles where id = new.user_id;
    new.start_date := (now() at time zone coalesce(v_time_zone, 'UTC'))::date;
    new.completed_at := null;
  else
    if new.status = 'completed' and old.status <> 'completed' and auth.role() <> 'service_role' then
      raise exception 'goals get completed by logging workouts' using errcode = '42501';
    end if;
    if old.status = 'completed' and new.status = 'active' then
      raise exception 'a completed goal can''t be made active again' using errcode = '22023';
    end if;
  end if;

  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    select count(*) into v_active from public.goals where user_id = new.user_id and status = 'active';
    if v_active >= 5 then
      raise exception 'you can have at most 5 active goals' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger goals_check
  before insert or update on public.goals
  for each row execute function public.check_goal();

alter table public.goals            enable row level security;
alter table public.goal_completions enable row level security;

create policy "read own goals"   on public.goals for select to authenticated using (user_id = auth.uid());
create policy "create own goals" on public.goals for insert to authenticated with check (user_id = auth.uid());
create policy "update own goals" on public.goals for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own goals" on public.goals for delete to authenticated using (user_id = auth.uid());
create policy "read own goal completions" on public.goal_completions for select to authenticated
  using (user_id = auth.uid());

-- the app can rename a goal, change the target, or archive/unarchive it
revoke update on public.goals from authenticated;
grant update (name, target, status) on public.goals to authenticated;

-- live progress for every goal, worked out the same way as goals.ts:
-- only workouts of 10+ minutes count, and only ones on or after the goal's start date.
-- weekly goals only count this week (Monday to Sunday in the user's time zone).
create view public.goal_progress with (security_invoker = true) as
with g as (
  select
    goal.*,
    date_trunc('week', (now() at time zone p.time_zone)::date)::date as this_week
  from public.goals goal
  join public.profiles p on p.id = goal.user_id
)
select
  g.id as goal_id,
  g.user_id,
  g.type,
  g.target,
  g.name,
  g.status,
  g.start_date,
  g.this_week as week_start,
  coalesce(case g.type
    when 'streak' then
      (select s.current_streak from public.streaks s where s.user_id = g.user_id)
    when 'total_workouts' then
      (select count(*) from public.workouts w
        where w.user_id = g.user_id and w.minutes >= 10 and w.workout_date >= g.start_date)
    when 'workouts_per_week' then
      (select count(*) from public.workouts w
        where w.user_id = g.user_id and w.minutes >= 10
          and w.workout_date >= greatest(g.start_date, g.this_week) and w.workout_date < g.this_week + 7)
    when 'minutes_per_week' then
      (select sum(w.minutes) from public.workouts w
        where w.user_id = g.user_id and w.minutes >= 10
          and w.workout_date >= greatest(g.start_date, g.this_week) and w.workout_date < g.this_week + 7)
    when 'active_days_per_week' then
      (select count(distinct w.workout_date) from public.workouts w
        where w.user_id = g.user_id and w.minutes >= 10
          and w.workout_date >= greatest(g.start_date, g.this_week) and w.workout_date < g.this_week + 7)
  end, 0)::int as progress,
  exists (select 1 from public.goal_completions c
           where c.user_id = g.user_id and c.goal_type = g.type and c.week_start = g.this_week) as done_this_week
from g;

-- ---------------------------------------------------------------------------
-- Challenges: join instead of rotate
-- ---------------------------------------------------------------------------

alter table public.challenges
  add column description text not null default '',
  add column difficulty  text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  add column min_level   int  not null default 1 check (min_level >= 1);

-- user_challenges is now an enrollment: status replaces the old completed column,
-- and start_date/end_date are the window where workouts count
alter table public.user_challenges
  add column status    text not null default 'active'
                       check (status in ('active', 'completed', 'abandoned', 'expired')),
  add column start_date date,
  add column end_date   date,
  add column joined_at  timestamptz not null default now();

-- old rows from before this migration (there shouldn't be any)
update public.user_challenges
   set status = case when completed then 'completed' else 'expired' end,
       start_date = period_start,
       end_date = period_start;

alter table public.user_challenges
  drop column completed,
  alter column start_date set not null,
  alter column end_date set not null;

create index user_challenges_active_idx on public.user_challenges (user_id) where status = 'active';

-- the app calls this when the user taps "Join"
create function public.join_challenge(p_challenge_id text) returns public.user_challenges
language plpgsql security definer set search_path = '' as $$
declare
  v_user      uuid := auth.uid();
  v_challenge public.challenges;
  v_today     date;
  v_level     int;
  v_period    date;
  v_end       date;
  v_active    int;
  v_row       public.user_challenges;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select * into v_challenge from public.challenges where id = p_challenge_id and active;
  if not found then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;

  select (now() at time zone time_zone)::date into v_today from public.profiles where id = v_user;
  select level into v_level from public.user_progress where user_id = v_user;
  if coalesce(v_level, 1) < v_challenge.min_level then
    raise exception 'reach level % to unlock this challenge', v_challenge.min_level using errcode = 'P0001';
  end if;

  -- daily challenges last until the end of today, weekly ones until Sunday
  if v_challenge.period = 'daily' then
    v_period := v_today;
    v_end := v_today;
  else
    v_period := date_trunc('week', v_today)::date;
    v_end := v_period + 6;
  end if;

  select * into v_row from public.user_challenges
   where user_id = v_user and challenge_id = p_challenge_id and period_start = v_period;
  if found and v_row.status in ('active', 'completed') then
    raise exception 'already joined this challenge' using errcode = '23505';
  end if;

  select count(*) into v_active from public.user_challenges
   where user_id = v_user and status = 'active' and end_date >= v_today;
  if v_active >= 3 then
    raise exception 'you can be in at most 3 challenges at once' using errcode = 'P0001';
  end if;

  -- if they left this challenge earlier in the same period, they can join again
  insert into public.user_challenges (user_id, challenge_id, period_start, progress, status, start_date, end_date, joined_at)
  values (v_user, p_challenge_id, v_period, 0, 'active', v_today, v_end, now())
  on conflict (user_id, challenge_id, period_start) do update set
    progress = 0, status = 'active', start_date = excluded.start_date, joined_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- the app calls this when the user leaves a challenge. no penalty
create function public.leave_challenge(p_challenge_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.user_challenges
     set status = 'abandoned'
   where user_id = auth.uid() and challenge_id = p_challenge_id and status = 'active';
  if not found then
    raise exception 'you are not in that challenge' using errcode = 'P0002';
  end if;
end;
$$;

-- the daily-streaks job calls this to mark challenges whose window ended as expired
create function public.expire_challenges() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.user_challenges uc
     set status = 'expired'
    from public.profiles p
   where p.id = uc.user_id
     and uc.status = 'active'
     and uc.end_date < (now() at time zone p.time_zone)::date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saving workouts (create, edit, delete)
-- ---------------------------------------------------------------------------

drop function public.record_workout(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function public.delete_workout(uuid);

-- Saves everything a workout change earned in one transaction.
-- p_mode is 'create' (log-workout), 'edit' or 'delete' (edit-workout).
-- On edit/delete, the XP the workout earned before gets taken back with one negative row.
-- On delete, XP never drops below the start of the user's current level (UC-08).
create function public.save_workout_result(
  p_user         uuid,
  p_mode         text,
  p_workout_id   uuid,
  p_workout      jsonb,
  p_exercises    jsonb,
  p_xp_events    jsonb,
  p_streak       jsonb,
  p_challenges   jsonb,
  p_goals        jsonb,
  p_achievements jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id     uuid := p_workout_id;
  v_old_xp int := 0;
  v_total  int;
  v_level  int;
  v_floor  int;
begin
  if p_mode not in ('create', 'edit', 'delete') then
    raise exception 'unknown mode %', p_mode using errcode = '22023';
  end if;

  if p_mode in ('edit', 'delete') then
    perform 1 from public.workouts where id = v_id and user_id = p_user for update;
    if not found then
      raise exception 'workout not found' using errcode = 'P0002';
    end if;

    select coalesce(sum(amount), 0) into v_old_xp from public.xp_events where workout_id = v_id;
    if v_old_xp <> 0 then
      insert into public.xp_events (user_id, workout_id, amount, reason)
      values (p_user, v_id, -v_old_xp, case when p_mode = 'edit' then 'workout_edited' else 'workout_deleted' end);
    end if;
  end if;

  if p_mode = 'delete' then
    select coalesce(sum(amount), 0) into v_total from public.xp_events where user_id = p_user;
    v_level := public.level_for_xp(v_total + v_old_xp); -- the level they were before
    v_floor := 50 * v_level * (v_level - 1);
    if v_total < v_floor then
      insert into public.xp_events (user_id, amount, reason) values (p_user, v_floor - v_total, 'level_floor');
    end if;
    delete from public.workouts where id = v_id;
  end if;

  if p_mode = 'create' then
    insert into public.workouts (user_id, type, workout_date, started_at, minutes, effort, notes, earned_xp)
    values (
      p_user,
      p_workout ->> 'type',
      (p_workout ->> 'date')::date,
      nullif(p_workout ->> 'startedAt', '')::time,
      (p_workout ->> 'minutes')::int,
      p_workout ->> 'effort',
      p_workout ->> 'notes',
      coalesce((p_workout ->> 'earnedXp')::boolean, false)
    )
    returning id into v_id;
  elsif p_mode = 'edit' then
    update public.workouts set
      type         = p_workout ->> 'type',
      workout_date = (p_workout ->> 'date')::date,
      started_at   = nullif(p_workout ->> 'startedAt', '')::time,
      minutes      = (p_workout ->> 'minutes')::int,
      effort       = p_workout ->> 'effort',
      notes        = p_workout ->> 'notes',
      earned_xp    = coalesce((p_workout ->> 'earnedXp')::boolean, false)
    where id = v_id;
    delete from public.workout_exercises where workout_id = v_id;
  end if;

  if p_mode in ('create', 'edit') then
    insert into public.workout_exercises (workout_id, position, name, sets, reps, seconds, weight_lb)
    select v_id, (e.ord - 1)::int, e.value ->> 'name',
           (e.value ->> 'sets')::int, (e.value ->> 'reps')::int,
           (e.value ->> 'seconds')::int, (e.value ->> 'weightLb')::numeric
    from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as e(value, ord);
  end if;

  -- only the workout's own XP (base + streak bonus) is tied to the workout. XP from
  -- challenges, goals and achievements stays even if the workout is deleted later
  insert into public.xp_events (user_id, workout_id, amount, reason)
  select p_user,
         case when x ->> 'reason' in ('workout', 'streak_bonus') and p_mode <> 'delete' then v_id end,
         (x ->> 'amount')::int,
         x ->> 'reason'
  from jsonb_array_elements(coalesce(p_xp_events, '[]'::jsonb)) as x;

  if p_streak is not null then
    insert into public.streaks (user_id, current_streak, best_streak, freezes_left, at_risk, last_checked)
    values (p_user, (p_streak ->> 'current')::int, (p_streak ->> 'best')::int,
            (p_streak ->> 'freezesLeft')::int, coalesce((p_streak ->> 'atRisk')::boolean, false),
            (p_streak ->> 'checkedOn')::date)
    on conflict (user_id) do update set
      current_streak = excluded.current_streak,
      best_streak    = excluded.best_streak,
      freezes_left   = excluded.freezes_left,
      at_risk        = excluded.at_risk,
      last_checked   = excluded.last_checked;
  end if;

  -- progress for the challenges the user joined. completed ones stay completed
  update public.user_challenges uc set
    progress     = (c ->> 'progress')::int,
    status       = case when (c ->> 'completed')::boolean then 'completed' else uc.status end,
    completed_at = case when (c ->> 'justCompleted')::boolean then now() else uc.completed_at end
  from jsonb_array_elements(coalesce(p_challenges, '[]'::jsonb)) as c
  where uc.user_id = p_user
    and uc.challenge_id = c ->> 'challengeId'
    and uc.period_start = (c ->> 'periodStart')::date
    and uc.status = 'active';

  -- goals that were just reached
  insert into public.goal_completions (user_id, goal_type, week_start, goal_id)
  select p_user, g ->> 'type', (g ->> 'weekStart')::date, (g ->> 'goalId')::uuid
  from jsonb_array_elements(coalesce(p_goals, '[]'::jsonb)) as g
  where (g ->> 'justCompleted')::boolean
  on conflict do nothing;

  -- milestone goals are finished for good once they're reached
  update public.goals set status = 'completed', completed_at = now()
  where user_id = p_user
    and status = 'active'
    and type in ('streak', 'total_workouts')
    and id in (select (g ->> 'goalId')::uuid
                 from jsonb_array_elements(coalesce(p_goals, '[]'::jsonb)) as g
                where (g ->> 'completed')::boolean);

  insert into public.user_achievements (user_id, achievement_id)
  select p_user, a #>> '{}'
  from jsonb_array_elements(coalesce(p_achievements, '[]'::jsonb)) as a
  on conflict do nothing;

  return v_id;
end;
$$;

-- who can call what
revoke execute on function public.save_workout_result(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.expire_challenges() from public, anon, authenticated;
grant execute on function public.save_workout_result(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.expire_challenges() to service_role;

revoke execute on function public.join_challenge(text) from public, anon;
revoke execute on function public.leave_challenge(text) from public, anon;
grant execute on function public.join_challenge(text) to authenticated;
grant execute on function public.leave_challenge(text) to authenticated;
