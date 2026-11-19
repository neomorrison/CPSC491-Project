// edit-workout: edits or deletes a workout the user already logged (see handler.ts).
// The app calls it with the user's login token:
//   supabase.functions.invoke("edit-workout", { body: { workoutId, ...workout } })
//   supabase.functions.invoke("edit-workout", { body: { workoutId, delete: true } })
// The checks and responses are in handler.ts. This file only connects it to the database.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { loadTotalXp, loadWorkout } from "../_shared/data.ts";
import { loadUserData } from "../_shared/load-user.ts";
import { adminClient, userClient, userIdFromToken } from "../_shared/supabase.ts";
import { type EditWorkoutDeps, handleEditWorkout } from "./handler.ts";

const deps: EditWorkoutDeps = {
  getUserId: userIdFromToken,

  async getWorkoutDate(authHeader, userId, workoutId) {
    const workout = await loadWorkout(userClient(authHeader), userId, workoutId);
    return workout ? workout.workout_date : null;
  },

  loadUserData(authHeader, userId, leaveOut) {
    return loadUserData(userClient(authHeader), userId, leaveOut);
  },

  getTotalXp(authHeader, userId) {
    return loadTotalXp(userClient(authHeader), userId);
  },

  async saveChange(userId, workoutId, workout, result, today) {
    // save_workout_result is server-only, so this one call uses the service role key.
    // It checks the workout belongs to p_user and raises P0002 if it doesn't.
    const { error } = await adminClient().rpc("save_workout_result", {
      p_user: userId,
      p_mode: workout ? "edit" : "delete",
      p_workout_id: workoutId,
      p_workout: workout ? { ...workout, earnedXp: result.earnedXp } : null,
      p_exercises: workout ? workout.exercises ?? [] : [],
      p_xp_events: result.xpEvents,
      p_streak: { ...result.streak, checkedOn: today },
      p_challenges: result.challenges,
      p_goals: result.goals,
      p_achievements: result.newAchievements,
    });
    if (error) {
      return { ok: false, notFound: error.code === "P0002", message: error.message };
    }
    return { ok: true };
  },
};

Deno.serve((req) => handleEditWorkout(req, deps));
