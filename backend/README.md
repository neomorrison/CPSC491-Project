# Backend

This is the Supabase side of the app: the database, logins, and the server functions. It also has the gamification code (XP, levels, streaks, achievements, challenges).

```
backend/
  package.json               scripts for tests + typecheck
  tests/                     unit tests for the gamification code (vitest)
  supabase/
    config.toml              Supabase CLI settings
    seed.sql                 starter achievements and challenges
    migrations/              tables, security rules, and server-only SQL functions
    functions/
      _shared/gamification/  all the game rules (plain TypeScript, no database code)
      _shared/data.ts        loads data from the database for the game rules
      _shared/http.ts        CORS, JSON responses, Supabase clients
      log-workout/           saves a workout and gives out XP/streak/challenge/achievement rewards
      save-plan/             saves a workout plan from the AI assistant as a suggestion
      daily-streaks/         scheduled job that updates everyone's streak
      delete-account/        deletes the user and all their data
```

Diagrams: [architecture](../docs/diagrams/1-architecture.png), [tables](../docs/diagrams/3-er-diagram.png), [logging a workout](../docs/diagrams/4-log-workout-sequence.png), [assistant makes a plan](../docs/diagrams/5-assistant-plan-sequence.png). The rules are explained in the "Gamification engine design" section of our proposal.

## Running the tests

You need Node 20+.

```bash
cd backend
npm install
npm test
npm run typecheck
```

The tests cover GT-1 to GT-5 from the proposal (grace day, daily XP cap, level up, freeze, short workouts) plus challenges, achievements and the plan checks.

## Setting up the shared Supabase project (only once)

1. Make a project on [supabase.com](https://supabase.com) and copy the project ref (the `xxxx` part of `xxxx.supabase.co`).
2. From the `backend/` folder run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
npx supabase secrets set CRON_SECRET=pick-a-long-random-string
npx supabase functions deploy
```

3. Turn on the streak check. In the Supabase dashboard enable the `pg_cron` and `pg_net` extensions, then run this in the SQL editor (put in your project ref and the same CRON_SECRET). It runs every hour since users are in different time zones. Running it extra times doesn't hurt anything.

```sql
select cron.schedule('daily-streaks', '15 * * * *', $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-streaks',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := '{}'::jsonb
  );
$$);
```

The app only needs the project URL and the **anon** key (Project Settings > API). Don't ever put the service role key in the app.

## Running it locally (optional)

Needs Docker Desktop running.

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve --env-file supabase/functions/.env
```

`db reset` rebuilds your local database from the migrations and seed. Copy `.env.example` to `supabase/functions/.env` first.

## Changing the database

Don't change tables by hand in the dashboard. Make a new migration and push it:

```bash
npx supabase migration new describe_the_change
npx supabase db push
```

## API

All the functions take a POST with a JSON body and the user's login token (`Authorization: Bearer <access token>`). The Supabase client adds the token for you:

```ts
const { data, error } = await supabase.functions.invoke("log-workout", { body: { ... } });
```

### log-workout

```json
{
  "type": "strength",
  "date": "2026-11-02",
  "minutes": 35,
  "startedAt": "07:30",
  "effort": "just_right",
  "exercises": [{ "name": "Squats", "sets": 3, "reps": 10, "weightLb": 95 }]
}
```

`type` can be `strength`, `cardio`, `yoga`, `sports`, or `other`. `date` is the user's local date and can be up to 2 days ago. It returns everything the "Workout saved" and "Level up" screens need:

```json
{
  "workoutId": "…",
  "earnedXp": true,
  "xpGained": 80,
  "xpEvents": [{ "amount": 50, "reason": "workout" }, { "amount": 30, "reason": "streak_bonus" }],
  "totalXp": 2820,
  "level": { "level": 8, "rank": "Regular", "xpIntoLevel": 20, "xpForNextLevel": 800 },
  "leveledUp": true,
  "unlocks": ["theme:ember"],
  "streak": { "current": 6, "best": 12, "freezesLeft": 1, "atRisk": false, "pendingMissedDay": null },
  "challenges": [{ "challengeId": "squats_50", "periodStart": "2026-11-02", "progress": 30, "completed": false, "justCompleted": false }],
  "newAchievements": []
}
```

Errors: `400` with a `details` list of what's wrong with the workout, `401` if not signed in.

### save-plan (the MCP server uses this one)

```json
{
  "planId": null,
  "weekStart": "2026-11-09",
  "note": "You hit your goal 3 weeks in a row, so this week has 4 days.",
  "items": [
    { "day": "mon", "workoutType": "strength", "minutes": 35, "details": "Lower body" },
    { "day": "wed", "workoutType": "sports", "minutes": 45, "details": "Pickup basketball" }
  ]
}
```

The plan gets saved as `suggested`. Send a `planId` to replace a plan the assistant already suggested. Errors: `403` if the user hasn't turned on "Suggest workout plans", `422` with `details` if the plan fails the checks (10 to 120 minutes per session, at least one rest day, no medical advice), `404` if the plan was already accepted or dismissed.

### delete-account

No body. Deletes the user and everything that belongs to them.

### daily-streaks

Only called by the scheduled job above (with the `x-cron-secret` header), not by the app.

## What the app reads directly

For reading, the app just queries the tables with the Supabase client. RLS makes sure each user only gets their own rows.

| To show | Read from |
|---|---|
| Level and total XP | `user_progress` view |
| Streak, freezes, "at risk" | `streaks` |
| Workout history | `workouts` with `workout_exercises` |
| Badges | `achievements` and `user_achievements` |
| Today's and this week's challenge | `challenges` and `user_challenges` |
| Home screen layout | `home_widgets` (the app can edit this) |
| Plans | `workout_plans` with `plan_items` (the app can accept, dismiss, edit, or make its own) |

Settings like name, planned days, and the AI permissions are columns in `profiles`, and the app can update those. Setting `onboarded_at` when onboarding is done gives the 25 XP onboarding bonus. To delete a workout call `supabase.rpc("delete_workout", { p_workout_id })`, which also takes back the XP from it.

Users can't write XP, streaks, achievements, challenge progress or workouts directly. Those only change through the functions above, so nobody can fake rewards.
