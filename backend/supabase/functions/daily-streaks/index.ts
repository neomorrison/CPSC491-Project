// daily-streaks: rebuilds every user's streak once a day and expires finished challenges
// (see handler.ts). Called by a scheduled job with the x-cron-secret header, not by a
// signed-in user, which is why verify_jwt is off for it in config.toml and why it uses
// the service role key.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { XP } from "../_shared/gamification/xp.ts";
import { adminClient } from "../_shared/supabase.ts";
import { type DailyStreaksDeps, handleDailyStreaks, type StreakUser } from "./handler.ts";

const PAGE_SIZE = 500; // how many profiles to load at a time

const deps: DailyStreaksDeps = {
  cronSecret: Deno.env.get("CRON_SECRET") ?? "",

  async listUsers() {
    // Supabase returns at most 1000 rows per query, so load the profiles in pages
    const users: StreakUser[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await adminClient()
        .from("profiles")
        .select("id, time_zone, planned_days, streaks (best_streak, last_checked)")
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);

      // deno-lint-ignore no-explicit-any
      for (const p of (data ?? []) as any[]) {
        // streaks has one row per user, but the query can give it back as a list
        const s = Array.isArray(p.streaks) ? p.streaks[0] : p.streaks;
        users.push({
          userId: p.id,
          timeZone: p.time_zone,
          plannedDays: p.planned_days ?? [],
          bestStreak: s?.best_streak ?? 0,
          lastChecked: s?.last_checked ?? null,
        });
      }
      if (!data || data.length < PAGE_SIZE) break; // that was the last page
    }
    return users;
  },

  async getWorkoutDates(userId) {
    // only workouts long enough to earn XP count for the streak
    const { data, error } = await adminClient()
      .from("workouts")
      .select("workout_date")
      .eq("user_id", userId)
      .gte("minutes", XP.minMinutesForXp)
      .order("workout_date", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    // deno-lint-ignore no-explicit-any
    return (data ?? []).map((w: any) => w.workout_date);
  },

  async saveStreak(userId, streak, checkedOn) {
    const { error } = await adminClient().rpc("set_streak", {
      p_user: userId,
      p_streak: {
        current: streak.current,
        best: streak.best,
        freezesLeft: streak.freezesLeft,
        atRisk: streak.atRisk,
        checkedOn: checkedOn,
      },
    });
    if (error) {
      console.error("daily-streaks could not save for user " + userId + ": " + error.message);
      return false;
    }
    return true;
  },

  async expireChallenges() {
    const { data, error } = await adminClient().rpc("expire_challenges");
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },
};

Deno.serve((req) => handleDailyStreaks(req, deps));
