-- Starter achievements and challenges. Uses "on conflict" so running it twice is fine.
-- The rule JSON format is explained in functions/_shared/gamification/achievements.ts

insert into public.achievements (id, name, description, rule, xp_reward) values
  ('first_workout', 'First Step',     'Log your first workout',              '{"kind":"total_workouts","count":1}',          25),
  ('workouts_10',   'Getting Going',  'Log 10 workouts',                     '{"kind":"total_workouts","count":10}',         25),
  ('workouts_50',   'Regular',        'Log 50 workouts',                     '{"kind":"total_workouts","count":50}',         50),
  ('workouts_100',  'Centurion',      'Log 100 workouts',                    '{"kind":"total_workouts","count":100}',       100),
  ('streak_7',      'On a Roll',      'Reach a 7 day streak',                '{"kind":"streak","days":7}',                   50),
  ('streak_30',     'Unstoppable',    'Reach a 30 day streak',               '{"kind":"streak","days":30}',                 100),
  ('early_bird',    'Early Bird',     'Log 5 workouts that start before 8am','{"kind":"early_bird","count":5,"beforeHour":8}', 50)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rule = excluded.rule, xp_reward = excluded.xp_reward;

insert into public.challenges (id, name, period, metric, exercise, target, xp_reward) values
  ('squats_50',      '50 squat day',          'daily',  'exercise_reps', 'squat',   50,  40),
  ('pushups_40',     '40 push-up day',        'daily',  'exercise_reps', 'push-up', 40,  40),
  ('move_20',        'Move for 20 minutes',   'daily',  'minutes',       null,      20,  40),
  ('workouts_4',     'Work out 4 times',      'weekly', 'workouts',      null,       4, 150),
  ('minutes_120',    '120 active minutes',    'weekly', 'minutes',       null,     120, 150)
on conflict (id) do update set
  name = excluded.name, period = excluded.period, metric = excluded.metric, exercise = excluded.exercise,
  target = excluded.target, xp_reward = excluded.xp_reward;
