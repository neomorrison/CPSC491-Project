// log-workout: saves a workout and gives out everything it earns (XP, streak,
// challenges, goals, achievements). The app calls it with the user's login token:
//   supabase.functions.invoke("log-workout", { body: { type, date, minutes, ... } })
// The checks and responses are in handler.ts. This file only connects it to the database.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { loadUserData } from "../_shared/load-user.ts";
import { adminClient, userClient, userIdFromToken } from "../_shared/supabase.ts";
import { handleLogWorkout, type LogWorkoutDeps } from "./handler.ts";

const deps: LogWorkoutDeps = {
  getUserId: userIdFromToken,

  loadUserData(authHeader, userId) {
    return loadUserData(userClient(authHeader), userId);
  },

  async saveWorkout(userId, workout, result, today) {
    // save_workout_result is server-only, so this one call uses the service role key.
    // We pass the user id we got from their token, never one from the request body.
    const { data, error } = await adminClient().rpc("save_workout_result", {
      p_user: userId,
      p_mode: "create",
      p_workout_id: null,
      p_workout: { ...workout, earnedXp: result.earnedXp },
      p_exercises: workout.exercises ?? [],
      p_xp_events: result.xpEvents,
      p_streak: { ...result.streak, checkedOn: today },
      p_challenges: result.challenges,
      p_goals: result.goals,
      p_achievements: result.newAchievements,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, workoutId: data as string };
  },
};

Deno.serve((req) => handleLogWorkout(req, deps));
