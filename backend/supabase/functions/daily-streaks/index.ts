// POST /functions/v1/daily-streaks
// A scheduled job calls this every hour (see backend/README.md). It recalculates everyone's
// streak so missed days and freezes show up even for people who didn't log anything today.
// There's no user login here, so it checks the x-cron-secret header instead.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { computeStreak, todayIn, XP, type Weekday } from "../_shared/gamification/index.ts";
import { adminClient, json, preflight } from "../_shared/http.ts";

const PAGE_SIZE = 500; // how many profiles to load at a time

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;

  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json(401, { error: "not allowed" });
  }

  const db = adminClient();
  let checked = 0;
  let failed = 0;
  let from = 0;

  while (true) {
    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, time_zone, planned_days")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return json(500, { error: error.message, checked: checked });
    if (!profiles || profiles.length === 0) break;

    for (const p of profiles) {
      // if one user fails we still want to do everyone else
      try {
        await updateStreak(db, p.id, p.time_zone, p.planned_days);
        checked++;
      } catch (err) {
        failed++;
        console.error("daily-streaks failed for user", p.id, err);
      }
    }

    if (profiles.length < PAGE_SIZE) break; // that was the last page
    from += PAGE_SIZE;
  }

  return json(200, { checked: checked, failed: failed });
});

async function updateStreak(
  db: ReturnType<typeof adminClient>,
  userId: string,
  timeZone: string,
  plannedDays: Weekday[],
) {
  // same rule as log-workout: only workouts long enough to earn XP count
  const { data: workouts, error } = await db
    .from("workouts")
    .select("workout_date")
    .eq("user_id", userId)
    .gte("minutes", XP.minMinutesForXp);
  if (error) throw new Error(error.message);

  const dates: string[] = [];
  for (const w of workouts || []) {
    dates.push(w.workout_date);
  }

  const today = todayIn(timeZone);
  const streak = computeStreak({ workoutDates: dates, plannedDays: plannedDays, today: today });

  const result = await db.rpc("set_streak", { p_user: userId, p_streak: { ...streak, checkedOn: today } });
  if (result.error) throw new Error(result.error.message);
}
