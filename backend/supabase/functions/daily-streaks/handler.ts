// The logic for daily-streaks, kept apart from the Deno setup in index.ts so the
// tests can run it with fake database calls.
//
// A scheduled job calls this about once an hour. For each user whose streak hasn't
// been checked yet today (their today), it rebuilds the streak from their workouts.
// That is what uses a freeze or resets the streak when someone misses a planned day,
// even if they never open the app. Then it marks joined challenges whose time ran out
// as expired.
//
// What it answers:
//   200 { checked, skipped, failed, expiredChallenges }
//   401 the x-cron-secret header is missing or wrong

import { todayIn, type Weekday } from "../_shared/gamification/dates.ts";
import { computeStreak, type StreakResult } from "../_shared/gamification/streaks.ts";
import { errorResponse, json } from "../_shared/http.ts";

export interface StreakUser {
  userId: string;
  timeZone: string;
  plannedDays: Weekday[];
  bestStreak: number;
  lastChecked: string | null; // YYYY-MM-DD
}

export interface DailyStreaksDeps {
  // the secret from the CRON_SECRET setting. empty means it was never set.
  cronSecret: string;
  listUsers(): Promise<StreakUser[]>;
  // the date of every workout long enough to count for the streak
  getWorkoutDates(userId: string): Promise<string[]>;
  saveStreak(userId: string, streak: StreakResult, checkedOn: string): Promise<boolean>;
  // calls expire_challenges and returns how many it marked expired
  expireChallenges?: () => Promise<number>;
  now?: () => Date;
}

export async function handleDailyStreaks(req: Request, deps: DailyStreaksDeps): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "use POST");
  }

  // this function has no user login, so the secret header is the only lock on it
  const sent = req.headers.get("x-cron-secret") ?? "";
  if (deps.cronSecret === "" || deps.cronSecret === "change-me" || sent !== deps.cronSecret) {
    return errorResponse(401, "wrong or missing cron secret");
  }

  const now = deps.now ? deps.now() : new Date();
  const users = await deps.listUsers();

  let checked = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const today = todayIn(user.timeZone, now);
      if (user.lastChecked === today) {
        skipped++;
        continue;
      }

      const streak = computeStreak({
        workoutDates: await deps.getWorkoutDates(user.userId),
        plannedDays: user.plannedDays,
        today: today,
      });
      // the best streak is never lost, even if old workouts were deleted
      if (user.bestStreak > streak.best) {
        streak.best = user.bestStreak;
      }

      const ok = await deps.saveStreak(user.userId, streak, today);
      if (ok) checked++;
      else failed++;
    } catch (err) {
      // one user with bad data (like an unknown time zone) shouldn't stop everyone else
      console.error("daily-streaks failed for user " + user.userId + ": " + String(err));
      failed++;
    }
  }

  const answer: Record<string, number> = { checked: checked, skipped: skipped, failed: failed };

  // runs every time, even for users skipped above, since a challenge can end any hour
  if (deps.expireChallenges) {
    try {
      answer.expiredChallenges = await deps.expireChallenges();
    } catch (err) {
      console.error("daily-streaks could not expire challenges: " + String(err));
      answer.expiredChallenges = 0;
    }
  }

  return json(200, answer);
}
