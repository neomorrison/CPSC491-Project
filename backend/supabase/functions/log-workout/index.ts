// POST /functions/v1/log-workout
// Saves a workout and figures out what it earns (XP, streak, challenges, achievements, level).
// The app only tells us what workout happened. All the rewards get calculated here on the
// server so nobody can give themselves XP by editing the app.
//
// Body: { type, date, minutes, startedAt?, effort?, notes?, exercises?: [{ name, sets?, reps?, seconds?, weightLb? }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { loadAchievements, loadChallenges, loadProfile, loadTotalXp, loadWorkouts } from "../_shared/data.ts";
import { levelProgress, processWorkout, todayIn, validateWorkout, type WorkoutInput } from "../_shared/gamification/index.ts";
import { adminClient, json, preflight, readJson, requireUser } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;

  const user = await requireUser(req);
  if (user instanceof Response) return user;

  try {
    const db = adminClient();
    const profile = await loadProfile(db, user.id);
    const today = todayIn(profile.time_zone);

    // check the workout first
    const body = await readJson(req);
    const errors = validateWorkout(body, today);
    if (errors.length > 0) {
      return json(400, { error: "invalid workout", details: errors });
    }
    const workout = body as WorkoutInput;

    // load everything the engine needs
    const history = await loadWorkouts(db, user.id);
    const totalXp = await loadTotalXp(db, user.id);
    const achievements = await loadAchievements(db, user.id);
    const challenges = await loadChallenges(db, user.id);

    const result = processWorkout(workout, {
      profile: { timeZone: profile.time_zone, plannedDays: profile.planned_days },
      today: today,
      history: history,
      totalXp: totalXp,
      achievementDefs: achievements.defs,
      unlockedAchievements: achievements.unlocked,
      challengeDefs: challenges.defs,
      completedChallenges: challenges.completed,
    });

    // save it all in one transaction (record_workout is in the migration file)
    const { data: workoutId, error } = await db.rpc("record_workout", {
      p_user: user.id,
      p_workout: { ...workout, earnedXp: result.earnedXp },
      p_exercises: workout.exercises || [],
      p_xp_events: result.xpEvents,
      p_streak: { ...result.streak, checkedOn: today },
      p_challenges: result.challenges,
      p_achievements: result.newAchievements,
    });
    if (error) throw new Error(error.message);

    // this is what the "Workout saved" and "Level up" screens show
    return json(200, {
      workoutId: workoutId,
      earnedXp: result.earnedXp,
      xpGained: result.xpGained,
      xpEvents: result.xpEvents,
      totalXp: result.totalXp,
      level: levelProgress(result.totalXp),
      leveledUp: result.leveledUp,
      unlocks: result.unlocks,
      streak: result.streak,
      challenges: result.challenges,
      newAchievements: result.newAchievements,
    });
  } catch (err) {
    console.error("log-workout failed", err);
    return json(500, { error: "couldn't save the workout, try again" });
  }
});
