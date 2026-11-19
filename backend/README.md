# Backend

Everything that runs on the server: the database tables, the game rules (XP, levels, streaks,
achievements, challenges), and the functions the app and the MCP server call.

We use Supabase, so there is no server of our own to run. The database is Postgres, and the
functions are Supabase Edge Functions (TypeScript, run by Deno).

## What's in here

```
supabase/migrations/      the database tables, security rules, and server-only database functions
supabase/seed.sql         starter achievements and challenges
supabase/functions/
  _shared/gamification/   the game rules. No database code, so it's easy to unit test.
  _shared/http.ts         JSON and error responses used by every function
  _shared/supabase.ts     the two database clients (as the signed-in user, and server-only)
  log-workout/            saves a workout and everything it earns
  save-plan/              saves a workout plan suggested by an AI assistant (limits.ts has the extra safety rules)
  daily-streaks/          rebuilds every user's streak once a day
tests/                    unit tests (vitest)
scripts/smoke-test.mjs    calls the three functions against a running local Supabase
```

Each function folder has two files. `handler.ts` has the logic and takes its database calls as
a parameter, so the tests can pass in fake ones. `index.ts` passes in the real ones.

## Setup

You need Node 18 or newer. For the local database you also need Docker Desktop running.

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

These don't need Docker or a database.

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

It signs up a throwaway user and checks every response listed below.

## The functions

All three answer errors as `{ "error": "...", "details": ["..."] }`. `details` is only there
when there is a list of reasons.

### log-workout

Called by the app with the user's login token.

```
supabase.functions.invoke("log-workout", {
  body: { type, date, minutes, startedAt?, effort?, notes?, exercises? }
})
```

| Status | Meaning |
|---|---|
| 200 | Saved. Returns `workoutId`, `earnedXp`, `xpGained`, `totalXp`, `levelBefore`, `levelAfter`, `leveledUp`, `unlocks`, `streak`, `challenges`, `newAchievements` |
| 401 | Not signed in |
| 422 | The workout failed the checks. `details` says why |

The workout, its XP, the streak, challenge progress, and new achievements are saved in one
database call (`record_workout`), so either all of it saves or none of it does.

### save-plan

Called by the MCP server with the user's login token. Send `planId` to change a plan the
assistant suggested before.

```
supabase.functions.invoke("save-plan", {
  body: { weekStart, note?, items: [{ day, workoutType, minutes, details? }], planId? }
})
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

### daily-streaks

Called by a scheduled job, not by a user. It needs the `x-cron-secret` header to match the
`CRON_SECRET` setting. For each user whose streak hasn't been checked yet today (in their own
time zone), it rebuilds the streak from their workouts. This is what uses a freeze or resets
a streak when someone misses a planned day, even if they never open the app.

| Status | Meaning |
|---|---|
| 200 | Returns `{ checked, skipped, failed }` |
| 401 | The secret is missing or wrong |

It is safe to call more than once a day. Users already checked today are skipped.

## Security notes

- The functions read data with the user's own token, so the database security rules (RLS) apply.
- The service role key is only used for the three server-only database functions
  (`record_workout`, `save_assistant_plan`, `set_streak`), and only after we know who the user is.
- The user id always comes from the login token, never from the request body.
- Never commit `supabase/functions/.env` or any real key.
