-- First migration: all the tables for the fitness app.
--
-- Security notes:
-- - Row Level Security (RLS) is on for every table, so users can only see their own rows.
-- - Users can't write XP, streaks, achievements or challenge progress themselves.
--   Only our edge functions can, using the server-only functions at the bottom of this file.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null default '' check (char_length(display_name) <= 60),
  goal                text check (goal in ('build_muscle', 'lose_weight', 'be_active', 'train_event')),
  planned_days        text[] not null default '{}'
                      check (planned_days <@ array['mon','tue','wed','thu','fri','sat','sun']),
  preferred_time      text check (preferred_time in ('morning', 'midday', 'evening')),
  session_minutes     int check (session_minutes between 5 and 240),
  experience          text check (experience in ('beginner', 'some', 'experienced')),
  time_zone           text not null default 'America/Los_Angeles',
  theme               text not null default 'default',
  ai_can_read         boolean not null default false,
  ai_can_create_plans boolean not null default false,
  onboarded_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Workouts
-- ---------------------------------------------------------------------------

create table public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         text not null check (type in ('strength', 'cardio', 'yoga', 'sports', 'other')),
  workout_date date not null,
  started_at   time,
  minutes      int not null check (minutes between 1 and 600),
  effort       text check (effort in ('easy', 'just_right', 'tough')),
  notes        text check (char_length(notes) <= 1000),
  earned_xp    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index workouts_user_date_idx on public.workouts (user_id, workout_date);

create table public.workout_exercises (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  position   int not null default 0,
  name       text not null check (char_length(name) between 1 and 80),
  sets       int check (sets between 1 and 50),
  reps       int check (reps between 1 and 1000),
  seconds    int check (seconds between 1 and 7200),
  weight_lb  numeric(6,1) check (weight_lb >= 0)
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);

-- ---------------------------------------------------------------------------
-- XP events
-- We never store a "total XP" number. Total XP = sum of this table (event sourcing).
-- If a workout gets deleted, its XP rows get deleted with it so the XP goes away too.
-- ---------------------------------------------------------------------------

create table public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete cascade,
  amount     int not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id);

-- ---------------------------------------------------------------------------
-- Streaks
-- ---------------------------------------------------------------------------

create table public.streaks (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  current_streak int not null default 0,
  best_streak    int not null default 0,
  freezes_left   int not null default 1,
  at_risk        boolean not null default false,
  last_checked   date
);

-- ---------------------------------------------------------------------------
-- Achievements and challenges
-- ---------------------------------------------------------------------------

create table public.achievements (
  id          text primary key,
  name        text not null,
  description text not null default '',
  rule        jsonb not null,
  xp_reward   int not null default 25
);

create table public.user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.challenges (
  id        text primary key,
  name      text not null,
  period    text not null check (period in ('daily', 'weekly')),
  metric    text not null check (metric in ('workouts', 'minutes', 'exercise_reps')),
  exercise  text,
  target    int not null check (target > 0),
  xp_reward int not null default 40,
  active    boolean not null default true
);

create table public.user_challenges (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null references public.challenges (id) on delete cascade,
  period_start date not null,
  progress     int not null default 0,
  completed    boolean not null default false,
  completed_at timestamptz,
  primary key (user_id, challenge_id, period_start)
);

-- ---------------------------------------------------------------------------
-- Home screen widgets
-- ---------------------------------------------------------------------------

create table public.home_widgets (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  widget   text not null check (widget in (
             'level', 'streak', 'weekly_goal', 'daily_challenge',
             'recent_workouts', 'progress_chart', 'streak_calendar')),
  position int not null default 0,
  visible  boolean not null default true,
  primary key (user_id, widget)
);

-- ---------------------------------------------------------------------------
-- Workout plans (made by the user or suggested by the AI assistant)
-- ---------------------------------------------------------------------------

create table public.workout_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  created_by text not null default 'user' check (created_by in ('user', 'assistant')),
  status     text not null default 'active' check (status in ('suggested', 'active', 'archived', 'dismissed')),
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_plans_user_idx on public.workout_plans (user_id, week_start);

create table public.plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.workout_plans (id) on delete cascade,
  day          text not null check (day in ('mon','tue','wed','thu','fri','sat','sun')),
  workout_type text not null check (workout_type in ('strength', 'cardio', 'yoga', 'sports', 'other')),
  minutes      int not null check (minutes between 10 and 120),
  details      text check (char_length(details) <= 300),
  unique (plan_id, day)
);

-- ---------------------------------------------------------------------------
-- user_progress view: total XP and level for each user
-- Level formula is the same as levels.ts: reaching level L takes 50 * L * (L - 1) XP.
-- Solving for L gives L = floor((1 + sqrt(1 + 0.08 * xp)) / 2)
-- ---------------------------------------------------------------------------

create view public.user_progress with (security_invoker = true) as
select
  p.id as user_id,
  coalesce(sum(x.amount), 0)::int as total_xp,
  floor((1 + sqrt(1 + 0.08 * greatest(coalesce(sum(x.amount), 0), 0))) / 2)::int as level
from public.profiles p
left join public.xp_events x on x.user_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.xp_events         enable row level security;
alter table public.streaks           enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;
alter table public.challenges        enable row level security;
alter table public.user_challenges   enable row level security;
alter table public.home_widgets      enable row level security;
alter table public.workout_plans     enable row level security;
alter table public.plan_items        enable row level security;

-- profiles: you can read and edit your own
create policy "read own profile"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- workouts: read only. Adding goes through log-workout and deleting goes
-- through delete_workout() (so the XP gets taken back too)
create policy "read own workouts" on public.workouts for select to authenticated using (user_id = auth.uid());
create policy "read own exercises" on public.workout_exercises for select to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- rewards are read only
create policy "read own xp"           on public.xp_events         for select to authenticated using (user_id = auth.uid());
create policy "read own streak"       on public.streaks           for select to authenticated using (user_id = auth.uid());
create policy "read own achievements" on public.user_achievements for select to authenticated using (user_id = auth.uid());
create policy "read own challenges"   on public.user_challenges   for select to authenticated using (user_id = auth.uid());

-- anyone signed in can see the list of achievements and challenges
create policy "read achievement list" on public.achievements for select to authenticated using (true);
create policy "read challenge list"   on public.challenges   for select to authenticated using (true);

-- home screen widgets: you can do anything with your own
create policy "manage own widgets" on public.home_widgets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- plans: read/create/edit/delete your own. you can't create one as 'assistant' though
create policy "read own plans"   on public.workout_plans for select to authenticated using (user_id = auth.uid());
create policy "create own plans" on public.workout_plans for insert to authenticated
  with check (user_id = auth.uid() and created_by = 'user');
create policy "update own plans" on public.workout_plans for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own plans" on public.workout_plans for delete to authenticated using (user_id = auth.uid());

create policy "manage own plan items" on public.plan_items for all to authenticated
  using (exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()));

-- users can change a plan's status, note and week but not created_by
revoke update on public.workout_plans from authenticated;
grant update (status, note, week_start, updated_at) on public.workout_plans to authenticated;

-- users can change these profile columns but not id or created_at
revoke update on public.profiles from authenticated;
grant update (display_name, goal, planned_days, preferred_time, session_minutes, experience,
              time_zone, theme, ai_can_read, ai_can_create_plans, onboarded_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- when someone signs up, make their profile, streak row and default home screen
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  insert into public.streaks (user_id) values (new.id);

  insert into public.home_widgets (user_id, widget, position) values
    (new.id, 'level', 0), (new.id, 'streak', 1), (new.id, 'weekly_goal', 2),
    (new.id, 'daily_challenge', 3), (new.id, 'recent_workouts', 4);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- finishing onboarding gives 25 XP (only once, even if onboarded_at gets reset)
create function public.handle_onboarding_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.onboarded_at is not null and old.onboarded_at is null
     and not exists (select 1 from public.xp_events where user_id = new.id and reason = 'onboarding') then
    insert into public.xp_events (user_id, amount, reason) values (new.id, 25, 'onboarding');
  end if;
  return new;
end;
$$;

create trigger on_profile_onboarded
  after update of onboarded_at on public.profiles
  for each row execute function public.handle_onboarding_xp();

-- ---------------------------------------------------------------------------
-- Server only functions
-- The edge functions call these with the service role key. Doing the writes inside one
-- function means they happen in one transaction (all of it saves or none of it does).
-- ---------------------------------------------------------------------------

-- saves a workout and everything it earned (called by log-workout)
create function public.record_workout(
  p_user         uuid,
  p_workout      jsonb,
  p_exercises    jsonb,
  p_xp_events    jsonb,
  p_streak       jsonb,
  p_challenges   jsonb,
  p_achievements jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_workout_id uuid;
begin
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
  returning id into v_workout_id;

  insert into public.workout_exercises (workout_id, position, name, sets, reps, seconds, weight_lb)
  select v_workout_id, (e.ord - 1)::int, e.value ->> 'name',
         (e.value ->> 'sets')::int, (e.value ->> 'reps')::int,
         (e.value ->> 'seconds')::int, (e.value ->> 'weightLb')::numeric
  from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as e(value, ord);

  insert into public.xp_events (user_id, workout_id, amount, reason)
  select p_user, v_workout_id, (x ->> 'amount')::int, x ->> 'reason'
  from jsonb_array_elements(coalesce(p_xp_events, '[]'::jsonb)) as x;

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

  insert into public.user_challenges (user_id, challenge_id, period_start, progress, completed, completed_at)
  select p_user, c ->> 'challengeId', (c ->> 'periodStart')::date, (c ->> 'progress')::int,
         (c ->> 'completed')::boolean,
         case when (c ->> 'justCompleted')::boolean then now() end
  from jsonb_array_elements(coalesce(p_challenges, '[]'::jsonb)) as c
  on conflict (user_id, challenge_id, period_start) do update set
    progress     = excluded.progress,
    completed    = public.user_challenges.completed or excluded.completed,
    completed_at = coalesce(public.user_challenges.completed_at, excluded.completed_at);

  insert into public.user_achievements (user_id, achievement_id)
  select p_user, a #>> '{}'
  from jsonb_array_elements(coalesce(p_achievements, '[]'::jsonb)) as a
  on conflict do nothing;

  return v_workout_id;
end;
$$;

-- saves or replaces a plan from the AI assistant (called by save-plan)
create function public.save_assistant_plan(
  p_user       uuid,
  p_plan_id    uuid,
  p_week_start date,
  p_note       text,
  p_items      jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan_id uuid := p_plan_id;
begin
  if v_plan_id is null then
    insert into public.workout_plans (user_id, week_start, created_by, status, note)
    values (p_user, p_week_start, 'assistant', 'suggested', p_note)
    returning id into v_plan_id;
  else
    update public.workout_plans
       set week_start = p_week_start, note = p_note, updated_at = now()
     where id = v_plan_id and user_id = p_user and created_by = 'assistant' and status = 'suggested';
    if not found then
      raise exception 'plan not found or no longer a suggestion' using errcode = 'P0002';
    end if;
    delete from public.plan_items where plan_id = v_plan_id;
  end if;

  insert into public.plan_items (plan_id, day, workout_type, minutes, details)
  select v_plan_id, i ->> 'day', i ->> 'workoutType', (i ->> 'minutes')::int, i ->> 'details'
  from jsonb_array_elements(p_items) as i;

  return v_plan_id;
end;
$$;

-- saves the result of the daily streak check (called by daily-streaks)
create function public.set_streak(p_user uuid, p_streak jsonb) returns void
language sql security definer set search_path = '' as $$
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
$$;

-- only the server (service_role) can call the three functions above
revoke execute on function public.record_workout(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.save_assistant_plan(uuid, uuid, date, text, jsonb) from public, anon, authenticated;
revoke execute on function public.set_streak(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_workout(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.save_assistant_plan(uuid, uuid, date, text, jsonb) to service_role;
grant execute on function public.set_streak(uuid, jsonb) to service_role;

-- the app calls this to delete a workout. the xp_events for that workout get deleted too
-- because of on delete cascade. the streak gets fixed on the next daily check.
create function public.delete_workout(p_workout_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.workouts where id = p_workout_id and user_id = auth.uid();
  if not found then
    raise exception 'workout not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.delete_workout(uuid) from public, anon;
grant execute on function public.delete_workout(uuid) to authenticated;
