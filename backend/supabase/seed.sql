-- Starter achievements and challenges. Uses "on conflict" so running it twice is fine.
-- The rule JSON format is explained in functions/_shared/gamification/achievements.ts

-- the same medal list as migrations/20261124000000_medal_plan.sql
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
