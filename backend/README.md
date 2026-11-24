# Backend

Everything that runs on the server: the database tables, the game rules (XP, levels, streaks,
goals, achievements, challenges), and the functions the app and the MCP server call.

We use Supabase, so there is no server of our own to run. The database is Postgres, and the
functions are Supabase Edge Functions (TypeScript, run by Deno).

## What's in here

```
supabase/config.toml        Supabase CLI settings
supabase/migrations/        the database tables, security rules, and server-only database functions
supabase/seed.sql           starter achievements and challenges
supabase/functions/
  _shared/gamification/     the game rules. No database code, so it's easy to unit test.
  _shared/http.ts           CORS, JSON and error responses used by every function
  _shared/supabase.ts       the two database clients (as the signed-in user, and server-only)
  _shared/data.ts           queries that load what the game rules need
  _shared/user-data.ts      the user's data in the shape the handlers use
  _shared/load-user.ts      loads that data with the user's own token
  log-workout/              saves a workout and everything it earns
  edit-workout/             edits or deletes a workout and redoes the rewards
  save-plan/                saves a workout plan suggested by an AI assistant (limits.ts has the extra safety rules)
  daily-streaks/            rebuilds every user's streak and expires finished challenges
  delete-account/           deletes the user and all their data
tests/                      unit tests (vitest)
scripts/smoke-test.mjs      calls the functions against a running local Supabase
```

Each function folder (except delete-account) has two files. `handler.ts` has the logic and takes
its database calls as a parameter, so the tests can pass in fake ones. `index.ts` passes in the
real ones.

Diagrams: [architecture](../docs/diagrams/1-architecture.png), [tables](../docs/diagrams/3-er-diagram.png), [logging a workout](../docs/diagrams/4-log-workout-sequence.png), [assistant makes a plan](../docs/diagrams/5-assistant-plan-sequence.png). The rules are explained in the "Gamification engine design" section of our proposal.

## Setup

You need Node 20 or newer. For the local database you also need Docker Desktop running.

```
cd backend
npm install
```

## Unit tests

```
npm test            # runs everything once
npm run test:watch  # reruns when a file changes
npm run typecheck   # TypeScript check, prints nothing when it passes
```

These don't need Docker or a database. They cover GT-1 to GT-5 from the proposal (grace day,
daily XP cap, level up, freeze, short workouts) plus goals, joined challenges, editing and
deleting workouts, achievements, the plan checks, and every function's handler.

## Running it locally

```
npm run db:start    # starts local Supabase in Docker. The first run downloads a lot.
npm run db:reset    # recreates the tables from migrations/ and loads seed.sql
```

`db:start` prints the local API URL and the anon key. `npx supabase status` prints them again.

Copy `.env.example` to `supabase/functions/.env` and change `CRON_SECRET` to any value.
`daily-streaks` refuses to run while it is still `change-me`.

```
npm run functions:serve   # leave this running in its own terminal
```

Then, in a second terminal:

```
node scripts/smoke-test.mjs <API_URL> <ANON_KEY> <CRON_SECRET>
```

It signs up a throwaway user and checks the responses listed below.

## The shared Supabase project

Setting it up (only once):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
npx supabase secrets set CRON_SECRET=pick-a-long-random-string
npx supabase functions deploy
```

Then turn on the hourly streak check. In the Supabase dashboard enable the `pg_cron` and
`pg_net` extensions, then run this in the SQL editor (with your project ref and the same
CRON_SECRET). It runs every hour since users are in different time zones; users already
checked today are skipped, so extra runs don't hurt.

```sql
select cron.schedule('daily-streaks', '15 * * * *', $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-streaks',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := '{}'::jsonb
  );
$$);
```

`.github/workflows/daily-streaks.yml` can call the same function from GitHub Actions. It skips
itself until the `SUPABASE_URL` and `CRON_SECRET` repo secrets are set, so it's a backup and a
"run it now" button (Actions tab > Daily streak check > Run workflow).

The app only needs the project URL and the **anon** key (Project Settings > API). Never put the
service role key in the app.

Don't change tables by hand in the dashboard. Make a new migration and push it:

```bash
npx supabase migration new describe_the_change
npx supabase db push
```

## The functions

All the functions take a POST with a JSON body and the user's login token
(`Authorization: Bearer <access token>`). The Supabase client adds the token for you:

```ts
const { data, error } = await supabase.functions.invoke("log-workout", { body: { ... } });
```

Errors always look like `{ "error": "...", "details": ["..."] }`. `details` is only there when
there is a list of reasons.

### log-workout

Called by the app with the user's login token.

```json
{
  "type": "strength",
  "title": "Leg day",
  "date": "2026-11-02",
  "minutes": 35,
  "startedAt": "07:30",
  "effort": "just_right",
  "exercises": [{ "name": "Squats", "sets": 3, "reps": 10, "weightLb": 95 }]
}
```

`type` can be `strength`, `cardio`, `yoga`, `sports`, or `other`. `title` is optional (the "Workout name" field, up to 60 characters). `date` is the user's local date
and can be up to 2 days ago.

| Status | Meaning |
|---|---|
| 200 | Saved. Returns everything the "Workout saved" and "Level up" screens need (below) |
| 401 | Not signed in |
| 422 | The workout failed the checks. `details` says why |

```json
{
  "workoutId": "...",
  "earnedXp": true,
  "xpGained": 80,
  "xpEvents": [{ "amount": 50, "reason": "workout" }, { "amount": 30, "reason": "streak_bonus" }],
  "totalXp": 2820,
  "level": { "level": 8, "rank": "Regular", "xpIntoLevel": 20, "xpForNextLevel": 800 },
  "levelBefore": 7,
  "levelAfter": 8,
  "leveledUp": true,
  "unlocks": ["theme:ember"],
  "streak": { "current": 6, "best": 12, "freezesLeft": 1, "atRisk": false, "pendingMissedDay": null },
  "challenges": [{ "challengeId": "squats_50", "periodStart": "2026-11-02", "progress": 30, "completed": false, "justCompleted": false }],
  "goals": [{ "goalId": "...", "type": "workouts_per_week", "weekStart": "2026-11-02", "progress": 2, "completed": false, "justCompleted": false }],
  "newAchievements": []
}
```

`challenges` only has the challenges the user joined. The workout, its XP, the streak, challenge
and goal progress, and new achievements are saved in one database call (`save_workout_result`),
so either all of it saves or none of it does.

### edit-workout

Edit a workout: send `workoutId` plus the same fields as log-workout. Delete one: send
`{ "workoutId": "...", "delete": true }`.

The XP the workout earned before gets taken back with a negative XP row (`workout_edited` /
`workout_deleted`), then the rules run again, so XP, streak, goal and challenge progress all stay
correct. Deleting never drops the user below the start of their current level (a `level_floor`
row makes up the difference). Achievements and challenges they already finished are kept. A
workout can keep its old date when edited, but it can only be moved to a date up to 2 days ago.

| Status | Meaning |
|---|---|
| 200 | Saved (below) |
| 401 | Not signed in |
| 404 | The workout doesn't exist or isn't theirs |
| 422 | Bad `workoutId`, or the edited workout failed the checks. `details` says why |

```json
{
  "workoutId": "...",
  "deleted": false,
  "xpChange": -55,
  "totalXp": 2765,
  "level": { "level": 7, "rank": "Regular", "xpIntoLevel": 665, "xpForNextLevel": 700 },
  "streak": { "current": 5, "best": 12, "freezesLeft": 1, "atRisk": false, "pendingMissedDay": null },
  "challenges": [],
  "goals": [],
  "newAchievements": [],
  "note": "You lost 55 XP. Your streak went from 6 to 5 days."
}
```

Show `note` to the user after they save.

### save-plan

Called by the MCP server with the user's login token. Send `planId` to change a plan the
assistant suggested before.

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

| Status | Meaning |
|---|---|
| 200 | Saved. Returns `{ planId, status: "suggested" }`. The user accepts or dismisses it in the app |
| 401 | Not signed in |
| 403 | The user hasn't turned on "Suggest workout plans" (`profiles.ai_can_create_plans`) |
| 404 | That plan was already accepted or dismissed. Create a new one instead |
| 422 | The plan failed the safety checks. `details` says why, so the assistant can fix it and try again |
| 429 | The assistant already suggested 5 new plans in the last 7 days. Updating a suggested plan still works |

The safety checks are in two places:

- `_shared/gamification/plans.ts` has the basic checks: 10 to 120 minutes per session, at
  least one rest day, a valid week, and no medical wording.
- `save-plan/limits.ts` has the checks that depend on the user:

| Experience level | Most workout days a week | Most minutes a week |
|---|---|---|
| beginner (also used when the user hasn't set a level) | 4 | 180 |
| some | 5 | 300 |
| experienced | 6 | 480 |

### delete-account

No body. Deletes the user and everything that belongs to them.

### daily-streaks

Called by the scheduled job, not by a user. It needs the `x-cron-secret` header to match the
`CRON_SECRET` setting. For each user whose streak hasn't been checked yet today (in their own
time zone), it rebuilds the streak from their workouts. This is what uses a freeze or resets a
streak when someone misses a planned day, even if they never open the app. Then it marks joined
challenges whose window ended as expired.

| Status | Meaning |
|---|---|
| 200 | Returns `{ checked, skipped, failed, expiredChallenges }` |
| 401 | The secret is missing or wrong |

## What the app reads directly

For reading, the app just queries the tables with the Supabase client. RLS makes sure each user
only gets their own rows.

| To show | Read from |
|---|---|
| Level and total XP | `user_progress` view |
| Streak, freezes, "at risk" | `streaks` |
| Workout history | `workouts` with `workout_exercises` |
| Badges | `achievements` and `user_achievements` |
| Challenges (Available / Active / Completed) | `challenges` (filter by `min_level`) and `user_challenges` (`status`) |
| Goals and their progress | `goal_progress` view |
| Home screen layout | `home_widgets` (the app can edit this) |
| Plans | `workout_plans` with `plan_items` (the app can accept, dismiss, edit, or make its own) |

Settings like name, planned days, and the AI permissions are columns in `profiles`, and the app
can update those. Setting `onboarded_at` when onboarding is done gives the 25 XP onboarding
bonus. To edit or delete a workout use the `edit-workout` function above.

Users can't write XP, streaks, achievements, challenge progress or workouts directly. Those only
change through the functions above, so nobody can fake rewards.

## Goals

The app writes goals straight to the `goals` table (RLS keeps them private):

```ts
await supabase.from("goals").insert({ user_id: user.id, type: "workouts_per_week", target: 3, name: "Gym 3x" });
await supabase.from("goals").update({ target: 4 }).eq("id", goalId);          // edit
await supabase.from("goals").update({ status: "archived" }).eq("id", goalId); // archive
await supabase.from("goals").delete().eq("id", goalId);                       // delete
```

| Type | Target range | Counts | XP when reached |
|---|---|---|---|
| `workouts_per_week` | 1 to 14 | workouts this week | 30, every week |
| `minutes_per_week` | 10 to 1500 | minutes this week | 30, every week |
| `active_days_per_week` | 1 to 7 | days with a workout this week | 30, every week |
| `streak` | 2 to 365 | current streak | 50, once |
| `total_workouts` | 1 to 1000 | workouts since the goal started | 50, once |

Rules: only workouts of 10+ minutes count, a new goal starts at zero (workouts before it was made
don't count), one active goal per type, max 5 active, and only the server can mark a goal
completed. Goal XP is paid at most once per goal type per week, so deleting a finished goal and
making it again doesn't pay twice. Errors to handle: `23505` (already have an active goal of that
type), `23514` (target out of range), `P0001` (too many active goals).

Starter goal suggestions by experience level are in `STARTER_GOALS` in
`_shared/gamification/goals.ts`. Read progress from the `goal_progress` view: `progress`,
`target`, and `done_this_week` for weekly goals.

## Challenges

Users join the challenges they want (max 3 at a time). Harder ones have a `min_level`.

```ts
await supabase.rpc("join_challenge", { p_challenge_id: "squats_50" });
await supabase.rpc("leave_challenge", { p_challenge_id: "squats_50" }); // no penalty, can rejoin
```

Joining makes a `user_challenges` row with a `start_date` and `end_date` (end of today for daily,
Sunday for weekly). Only workouts in that window count. `status` is `active`, `completed`,
`abandoned`, or `expired` (the hourly job marks it expired when the window ends). Errors: `23505`
already joined, `P0001` level too low or already in 3 challenges, `P0002` not found.

## Security notes

- The functions read data with the user's own token, so the database security rules (RLS) apply.
- The service role key is only used for the server-only database functions
  (`save_workout_result`, `save_assistant_plan`, `set_streak`, `expire_challenges`) and the admin
  API in delete-account, and only after we know who the user is.
- The user id always comes from the login token, never from the request body.
- Never commit `supabase/functions/.env` or any real key.
