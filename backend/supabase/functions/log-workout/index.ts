// log-workout: saves a workout and gives out everything it earns (XP, streak,
// challenges, achievements). The app calls it with the user's login token:
//   supabase.functions.invoke("log-workout", { body: { type, date, minutes, ... } })
// The checks and responses are in handler.ts. This file only connects it to the database.

import { adminClient, userClient } from "../_shared/supabase.ts";
import type { AchievementDef } from "../_shared/gamification/achievements.ts";
import type { ChallengeDef } from "../_shared/gamification/challenges.ts";
import type { WorkoutRecord } from "../_shared/gamification/types.ts";
import { handleLogWorkout, type LogWorkoutDeps } from "./handler.ts";

const deps: LogWorkoutDeps = {
  async getUserId(authHeader) {
    const { data, error } = await userClient(authHeader).auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  },

  // Everything here is read with the user's own token, so the database
  // security rules make sure we only get their rows.
  async loadUserData(authHeader, userId) {
    const db = userClient(authHeader);

    const [profile, workouts, progress, streak, achievements, unlocked, challenges, completed] = await Promise.all([
      db.from("profiles").select("time_zone, planned_days").eq("id", userId).maybeSingle(),
      // Supabase returns at most 1000 rows by default. That is about 3 years of
      // daily workouts, which is plenty for now.
      db.from("workouts")
        .select("workout_date, minutes, started_at, earned_xp, workout_exercises (name, sets, reps, seconds, weight_lb)")
        .eq("user_id", userId)
        .order("workout_date", { ascending: false })
        .limit(1000),
      db.from("user_progress").select("total_xp").eq("user_id", userId).maybeSingle(),
      db.from("streaks").select("best_streak").eq("user_id", userId).maybeSingle(),
      db.from("achievements").select("id, name, rule, xp_reward"),
      db.from("user_achievements").select("achievement_id").eq("user_id", userId),
      db.from("challenges").select("id, name, period, metric, exercise, target, xp_reward").eq("active", true),
      db.from("user_challenges").select("challenge_id, period_start").eq("user_id", userId).eq("completed", true),
    ]);

    for (const r of [profile, workouts, progress, streak, achievements, unlocked, challenges, completed]) {
      if (r.error) {
        console.error("log-workout could not load data: " + r.error.message);
        return null;
      }
    }
    if (!profile.data) return null;

    // deno-lint-ignore no-explicit-any
    const history: WorkoutRecord[] = (workouts.data ?? []).map((w: any) => ({
      date: w.workout_date,
      minutes: w.minutes,
      startedAt: w.started_at ? String(w.started_at).slice(0, 5) : null,
      earnedXp: w.earned_xp,
      // deno-lint-ignore no-explicit-any
      exercises: (w.workout_exercises ?? []).map((e: any) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        seconds: e.seconds,
        weightLb: e.weight_lb,
      })),
    }));

    // deno-lint-ignore no-explicit-any
    const achievementDefs: AchievementDef[] = (achievements.data ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      rule: a.rule,
      xpReward: a.xp_reward,
    }));

    // deno-lint-ignore no-explicit-any
    const challengeDefs: ChallengeDef[] = (challenges.data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      period: c.period,
      metric: c.metric,
      exercise: c.exercise,
      target: c.target,
      xpReward: c.xp_reward,
    }));

    return {
      timeZone: profile.data.time_zone,
      plannedDays: profile.data.planned_days ?? [],
      history: history,
      totalXp: progress.data?.total_xp ?? 0,
      bestStreak: streak.data?.best_streak ?? 0,
      achievementDefs: achievementDefs,
      // deno-lint-ignore no-explicit-any
      unlockedAchievements: (unlocked.data ?? []).map((u: any) => u.achievement_id),
      challengeDefs: challengeDefs,
      // deno-lint-ignore no-explicit-any
      completedChallenges: (completed.data ?? []).map((c: any) => c.challenge_id + "|" + c.period_start),
    };
  },

  async saveWorkout(userId, workout, result, today) {
    // record_workout is server-only, so this one call uses the service role key.
    // We pass the user id we got from their token, never one from the request body.
    const { data, error } = await adminClient().rpc("record_workout", {
      p_user: userId,
      p_workout: {
        type: workout.type,
        date: workout.date,
        startedAt: workout.startedAt ?? "",
        minutes: workout.minutes,
        effort: workout.effort ?? null,
        notes: workout.notes ?? null,
        earnedXp: result.earnedXp,
      },
      p_exercises: workout.exercises ?? [],
      p_xp_events: result.xpEvents,
      p_streak: {
        current: result.streak.current,
        best: result.streak.best,
        freezesLeft: result.streak.freezesLeft,
        atRisk: result.streak.atRisk,
        checkedOn: today,
      },
      p_challenges: result.challenges,
      p_achievements: result.newAchievements,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, workoutId: data as string };
  },
};

Deno.serve((req) => handleLogWorkout(req, deps));
