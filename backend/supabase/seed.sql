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

-- min_level: harder challenges only show up once the user reaches that level
insert into public.challenges (id, name, description, period, metric, exercise, target, xp_reward, difficulty, min_level) values
  ('squats_50',      '50 squat day',          'Do 50 squats today, across any sets',          'daily',  'exercise_reps', 'squat',   50,  40, 'easy',   1),
  ('pushups_40',     '40 push-up day',        'Do 40 push-ups today, across any sets',        'daily',  'exercise_reps', 'push-up', 40,  40, 'easy',   1),
  ('move_20',        'Move for 20 minutes',   'Get 20 active minutes in today',               'daily',  'minutes',       null,      20,  40, 'easy',   1),
  ('workouts_4',     'Work out 4 times',      'Log 4 workouts this week',                     'weekly', 'workouts',      null,       4, 150, 'medium', 1),
  ('minutes_120',    '120 active minutes',    'Get 120 active minutes this week',             'weekly', 'minutes',       null,     120, 150, 'medium', 1),
  ('squats_150',     '150 squat day',         'Do 150 squats today, across any sets',         'daily',  'exercise_reps', 'squat',  150,  40, 'hard',   5),
  ('minutes_300',    '300 active minutes',    'Get 300 active minutes this week',             'weekly', 'minutes',       null,     300, 150, 'hard',  10),
  ('workouts_6',     'Work out 6 times',      'Log 6 workouts this week',                     'weekly', 'workouts',      null,       6, 150, 'hard',  10)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, period = excluded.period, metric = excluded.metric,
  exercise = excluded.exercise, target = excluded.target, xp_reward = excluded.xp_reward,
  difficulty = excluded.difficulty, min_level = excluded.min_level;
