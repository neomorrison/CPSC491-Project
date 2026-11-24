-- Workouts get an optional title, like "Morning run" or "Leg day" (the "Workout name"
-- field on the Log Workout screen). save_workout_result is the same as in the previous
-- migration, except that it now saves the title on create and edit.

alter table public.workouts
  add column title text check (char_length(title) <= 60);

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
    insert into public.workouts (user_id, type, title, workout_date, started_at, minutes, effort, notes, earned_xp)
    values (
      p_user,
      p_workout ->> 'type',
      nullif(p_workout ->> 'title', ''),
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
      title        = nullif(p_workout ->> 'title', ''),
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
