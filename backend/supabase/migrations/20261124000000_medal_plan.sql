-- Gala's medal plan (Nov 24).
--
-- 1. More workout types: walking, pilates, mobility, hiking, swimming and climbing.
-- 2. An "outdoor" yes/no on each workout. Hiking always counts as outdoor (see isOutdoor
--    in functions/_shared/gamification/achievements.ts).
-- 3. A category on achievements, so the app can show "medals" and "challenge medals"
--    in separate sections. Gala's challenges unlock by themselves, like medals, so they
--    live in the achievements table. The joinable daily and weekly challenges don't change.
-- 4. The new medal list. Regular (50 workouts), On a Roll (7 day streak) and Unstoppable
--    (30 day streak) aren't in Gala's plan, so they're removed. Anyone who earned them keeps
--    the XP (it's in xp_events), the badge just goes away.
-- 5. save_workout_result is the same as in the previous migration, except that it now
--    saves outdoor on create and edit.

-- 1. workout types (the plan screen uses the same list)
alter table public.workouts drop constraint if exists workouts_type_check;
alter table public.workouts add constraint workouts_type_check check (type in (
  'strength', 'cardio', 'walking', 'yoga', 'pilates', 'mobility',
  'hiking', 'swimming', 'climbing', 'sports', 'other'
));

alter table public.plan_items drop constraint if exists plan_items_workout_type_check;
alter table public.plan_items add constraint plan_items_workout_type_check check (workout_type in (
  'strength', 'cardio', 'walking', 'yoga', 'pilates', 'mobility',
  'hiking', 'swimming', 'climbing', 'sports', 'other'
));

-- 2. outdoor
alter table public.workouts
  add column outdoor boolean not null default false;

-- 3. medal or challenge medal
alter table public.achievements
  add column category text not null default 'medal' check (category in ('medal', 'challenge'));

-- 4. the medal list (seed.sql has the same list for local databases)
delete from public.achievements where id in ('workouts_50', 'streak_7', 'streak_30');

insert into public.achievements (id, name, description, category, rule, xp_reward) values
  -- medals
  ('first_workout',   'First Step',      'Log your first workout',                          'medal',     '{"kind":"total_workouts","count":1}', 25),
  ('workouts_10',     'First 10',        'Log 10 workouts',                                 'medal',     '{"kind":"total_workouts","count":10}', 50),
  ('workouts_100',    'Century Club',    'Log 100 workouts',                                'medal',     '{"kind":"total_workouts","count":100}', 150),
  ('streak_12',       'On Fire',         'Reach a 12 day streak',                           'medal',     '{"kind":"streak","days":12}', 75),
  ('early_bird',      'Early Bird',      'Log a workout that starts before 8am',            'medal',     '{"kind":"early_bird","count":1,"beforeHour":8}', 25),
  ('fresh_air',       'Fresh Air',       'Log your first outdoor workout',                  'medal',     '{"kind":"outdoor","count":1}', 25),
  ('finding_balance', 'Finding Balance', 'Log your first yoga or pilates workout',          'medal',     '{"kind":"workout_type","types":["yoga","pilates"],"count":1}', 25),
  -- challenge medals
  ('firestarter',     'Firestarter',     'Meet your planned schedule 3 weeks in a row',     'challenge', '{"kind":"planned_weeks","weeks":3}', 150),
  ('expeditionist',   'Expeditionist',   'Log 12 outdoor workouts',                         'challenge', '{"kind":"outdoor","count":12}', 150),
  ('harmonious',      'Harmonious',      'Do yoga, pilates or mobility 14 days in a row',   'challenge', '{"kind":"type_days_in_a_row","types":["yoga","pilates","mobility"],"days":14}', 200),
  ('breezy',          'Breezy',          'Go for a walk on 30 different days',              'challenge', '{"kind":"type_days","types":["walking"],"days":30}', 200),
  ('go_getter',       'Go-Getter',       'Do cardio 7 days in a row',                       'challenge', '{"kind":"type_days_in_a_row","types":["cardio"],"days":7}', 100)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, category = excluded.category,
  rule = excluded.rule, xp_reward = excluded.xp_reward;

-- 5. save outdoor
create or replace function public.save_workout_result(
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
    insert into public.workouts (user_id, type, title, workout_date, started_at, minutes, outdoor, effort, notes, earned_xp)
    values (
      p_user,
      p_workout ->> 'type',
      nullif(p_workout ->> 'title', ''),
      (p_workout ->> 'date')::date,
      nullif(p_workout ->> 'startedAt', '')::time,
      (p_workout ->> 'minutes')::int,
      coalesce((p_workout ->> 'outdoor')::boolean, false),
      p_workout ->> 'effort',
      p_workout ->> 'notes',
      coalesce((p_workout ->> 'earnedXp')::boolean, false)
    )
    returning id into v_id;
  elsif p_mode = 'edit' then
    update public.workouts set
      type         = p_workout ->> 'type',
      title        = nullif(p_workout ->> 'title', ''),
      workout_date = (p_workout ->> 'date')::date,
      started_at   = nullif(p_workout ->> 'startedAt', '')::time,
      minutes      = (p_workout ->> 'minutes')::int,
      outdoor      = coalesce((p_workout ->> 'outdoor')::boolean, false),
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
