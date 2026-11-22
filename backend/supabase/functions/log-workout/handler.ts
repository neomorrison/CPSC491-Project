// The logic for log-workout, kept apart from the Deno setup in index.ts so the
// tests can run it with fake database calls.
//
// What it answers:
//   200 { workoutId, earnedXp, xpGained, xpEvents, totalXp, level, levelBefore, levelAfter,
//         leveledUp, unlocks, streak, challenges, goals, newAchievements }
//   401 not signed in
//   422 { error, details }   the workout failed the checks. details says why.

import { todayIn } from "../_shared/gamification/dates.ts";
import { processWorkout, type WorkoutResult } from "../_shared/gamification/engine.ts";
import { levelProgress } from "../_shared/gamification/levels.ts";
import type { WorkoutInput } from "../_shared/gamification/types.ts";
import { validateWorkout } from "../_shared/gamification/xp.ts";
import { bearerToken, errorResponse, json, preflight, readJson } from "../_shared/http.ts";
import { cleanWorkout, contextFor, keepBestStreak, type UserData } from "../_shared/user-data.ts";

export type { UserData } from "../_shared/user-data.ts";

export type SaveWorkoutResult = { ok: true; workoutId: string } | { ok: false; message: string };

// The database calls the handler needs. index.ts passes in the real ones.
export interface LogWorkoutDeps {
  // the signed-in user's id, or null if the token is missing or bad
  getUserId(authHeader: string): Promise<string | null>;
  // reads the user's own data with their token, or null if they have no profile
  loadUserData(authHeader: string, userId: string): Promise<UserData | null>;
  // calls save_workout_result, which saves the workout and everything it earned in one go
  saveWorkout(userId: string, workout: WorkoutInput, result: WorkoutResult, today: string): Promise<SaveWorkoutResult>;
  now?: () => Date;
}

export async function handleLogWorkout(req: Request, deps: LogWorkoutDeps): Promise<Response> {
  const stop = preflight(req);
  if (stop) return stop;

  // who is asking
  const authHeader = bearerToken(req);
  if (!authHeader) {
    return errorResponse(401, "not signed in");
  }
  const userId = await deps.getUserId(authHeader);
  if (!userId) {
    return errorResponse(401, "not signed in");
  }

  const user = await deps.loadUserData(authHeader, userId);
  if (!user) {
    return errorResponse(500, "could not load your data");
  }

  // check the workout. "today" is the user's today, not the server's.
  const now = deps.now ? deps.now() : new Date();
  const today = todayIn(user.timeZone, now);
  const body = await readJson(req);
  const problems = validateWorkout(body, today);
  if (problems.length > 0) {
    return errorResponse(422, "workout failed the checks", problems);
  }
  const workout = cleanWorkout(body as WorkoutInput);

  // work out what it earns
  const result = processWorkout(workout, contextFor(user, today));
  keepBestStreak(result, user);

  const saved = await deps.saveWorkout(userId, workout, result, today);
  if (!saved.ok) {
    console.error("log-workout failed: " + saved.message);
    return errorResponse(500, "could not save the workout");
  }

  // this is what the "Workout saved" and "Level up" screens show
  return json(200, {
    workoutId: saved.workoutId,
    earnedXp: result.earnedXp,
    xpGained: result.xpGained,
    xpEvents: result.xpEvents,
    totalXp: result.totalXp,
    level: levelProgress(result.totalXp),
    levelBefore: result.levelBefore,
    levelAfter: result.levelAfter,
    leveledUp: result.leveledUp,
    unlocks: result.unlocks,
    streak: result.streak,
    challenges: result.challenges,
    goals: result.goals,
    newAchievements: result.newAchievements,
  });
}
