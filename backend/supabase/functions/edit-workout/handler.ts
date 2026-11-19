// The logic for edit-workout, kept apart from the Deno setup in index.ts so the
// tests can run it with fake database calls.
//
// Edits or deletes a workout the user already logged (UC-08 in our proposal), then redoes
// the XP, streak, challenge and goal progress so everything stays consistent.
// The XP the workout earned before is taken back with a negative XP row (we never delete XP rows),
// and on delete the user never drops below the start of their current level.
// Achievements and challenges that were already finished are kept.
//
// Edit body:   { workoutId, type, date, minutes, startedAt?, effort?, notes?, exercises? }
// Delete body: { workoutId, delete: true }
//
// What it answers:
//   200 { workoutId, deleted, xpChange, totalXp, level, streak, challenges, goals, newAchievements, note }
//   401 not signed in
//   404 the workout doesn't exist or isn't theirs
//   422 { error, details }   bad workoutId, or the edited workout failed the checks

import { todayIn } from "../_shared/gamification/dates.ts";
import { processDelete, processWorkout, type WorkoutResult } from "../_shared/gamification/engine.ts";
import { levelProgress } from "../_shared/gamification/levels.ts";
import type { WorkoutInput } from "../_shared/gamification/types.ts";
import { validateWorkout } from "../_shared/gamification/xp.ts";
import { bearerToken, errorResponse, json, preflight, readJson } from "../_shared/http.ts";
import { cleanWorkout, contextFor, keepBestStreak, type UserData } from "../_shared/user-data.ts";

export type SaveChangeResult = { ok: true } | { ok: false; notFound: boolean; message: string };

// The database calls the handler needs. index.ts passes in the real ones.
export interface EditWorkoutDeps {
  getUserId(authHeader: string): Promise<string | null>;
  // the workout's current date, or null if it doesn't exist or isn't this user's
  getWorkoutDate(authHeader: string, userId: string, workoutId: string): Promise<string | null>;
  // the user's data with this workout left out of the history and its XP taken off the total
  loadUserData(authHeader: string, userId: string, leaveOut: string): Promise<UserData | null>;
  // the user's total XP as it is saved right now
  getTotalXp(authHeader: string, userId: string): Promise<number>;
  // calls save_workout_result in "edit" or "delete" mode
  saveChange(
    userId: string,
    workoutId: string,
    workout: WorkoutInput | null,
    result: WorkoutResult,
    today: string,
  ): Promise<SaveChangeResult>;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleEditWorkout(req: Request, deps: EditWorkoutDeps): Promise<Response> {
  const stop = preflight(req);
  if (stop) return stop;

  const authHeader = bearerToken(req);
  if (!authHeader) {
    return errorResponse(401, "not signed in");
  }
  const userId = await deps.getUserId(authHeader);
  if (!userId) {
    return errorResponse(401, "not signed in");
  }

  // deno-lint-ignore no-explicit-any
  const body = (await readJson(req)) as any;
  if (!body || typeof body.workoutId !== "string" || !UUID.test(body.workoutId)) {
    return errorResponse(422, "workout failed the checks", ["workoutId must be a workout id"]);
  }
  const workoutId: string = body.workoutId;
  const isDelete = body.delete === true;

  const originalDate = await deps.getWorkoutDate(authHeader, userId, workoutId);
  if (originalDate === null) {
    return errorResponse(404, "workout not found");
  }

  const user = await deps.loadUserData(authHeader, userId, workoutId);
  if (!user) {
    return errorResponse(500, "could not load your data");
  }
  const now = deps.now ? deps.now() : new Date();
  const today = todayIn(user.timeZone, now);

  let workout: WorkoutInput | null = null;
  if (!isDelete) {
    // an edit may keep its old date, but can't move a workout to an old date
    const problems = validateWorkout(body, today, originalDate);
    if (problems.length > 0) {
      return errorResponse(422, "workout failed the checks", problems);
    }
    workout = cleanWorkout(body as WorkoutInput);
  }

  // remember these so we can tell the user what changed
  const xpBefore = await deps.getTotalXp(authHeader, userId);
  const streakBefore = user.currentStreak;

  const ctx = contextFor(user, today);
  const result = workout ? processWorkout(workout, ctx) : processDelete(ctx);
  keepBestStreak(result, user);

  const saved = await deps.saveChange(userId, workoutId, workout, result, today);
  if (!saved.ok) {
    if (saved.notFound) return errorResponse(404, "workout not found");
    console.error("edit-workout failed: " + saved.message);
    return errorResponse(500, "could not update the workout");
  }

  // read the total back, because the database may have added a level_floor row on delete
  const xpAfter = await deps.getTotalXp(authHeader, userId);
  const xpChange = xpAfter - xpBefore;

  return json(200, {
    workoutId: workoutId,
    deleted: isDelete,
    xpChange: xpChange,
    totalXp: xpAfter,
    level: levelProgress(xpAfter),
    streak: result.streak,
    challenges: result.challenges,
    goals: result.goals,
    newAchievements: result.newAchievements,
    note: changeNote(xpChange, streakBefore, result.streak.current),
  });
}

// the short message the app shows after an edit or delete (UC-08 step 7)
export function changeNote(xpChange: number, streakBefore: number, streakAfter: number): string {
  const parts: string[] = [];
  if (xpChange > 0) parts.push("You gained " + xpChange + " XP.");
  if (xpChange < 0) parts.push("You lost " + -xpChange + " XP.");
  if (streakAfter !== streakBefore) {
    parts.push("Your streak went from " + streakBefore + " to " + streakAfter + " days.");
  }
  if (parts.length === 0) return "Saved. Your XP and streak didn't change.";
  return parts.join(" ");
}
