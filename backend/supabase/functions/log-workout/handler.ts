// The logic for log-workout, kept apart from the Deno setup in index.ts so the
// tests can run it with fake database calls.
//
// What it answers:
//   200 { workoutId, earnedXp, xpGained, totalXp, levelBefore, levelAfter, leveledUp,
//         unlocks, streak, challenges, newAchievements }
//   401 not signed in
//   422 { error, details }   the workout failed the checks. details says why.

import { todayIn, type Weekday } from "../_shared/gamification/dates.ts";
import { processWorkout, type WorkoutContext, type WorkoutResult } from "../_shared/gamification/engine.ts";
import type { AchievementDef } from "../_shared/gamification/achievements.ts";
import type { ChallengeDef } from "../_shared/gamification/challenges.ts";
import type { WorkoutInput, WorkoutRecord } from "../_shared/gamification/types.ts";
import { validateWorkout } from "../_shared/gamification/xp.ts";
import { CORS_HEADERS, errorResponse, json, readJson } from "../_shared/http.ts";

// everything we need to know about the user before working out what the workout earns
export interface UserData {
  timeZone: string;
  plannedDays: Weekday[];
  history: WorkoutRecord[];
  totalXp: number;
  bestStreak: number; // the best streak saved so far
  achievementDefs: AchievementDef[];
  unlockedAchievements: string[];
  challengeDefs: ChallengeDef[];
  completedChallenges: string[]; // "challengeId|periodStart"
}

export type SaveWorkoutResult = { ok: true; workoutId: string } | { ok: false; message: string };

// The database calls the handler needs. index.ts passes in the real ones.
export interface LogWorkoutDeps {
  // the signed-in user's id, or null if the token is missing or bad
  getUserId(authHeader: string): Promise<string | null>;
  // reads the user's own data with their token, or null if they have no profile
  loadUserData(authHeader: string, userId: string): Promise<UserData | null>;
  // calls record_workout, which saves the workout and everything it earned in one go
  saveWorkout(userId: string, workout: WorkoutInput, result: WorkoutResult, today: string): Promise<SaveWorkoutResult>;
  now?: () => Date;
}

export async function handleLogWorkout(req: Request, deps: LogWorkoutDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "use POST");
  }

  // who is asking
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
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
  const ctx: WorkoutContext = {
    profile: { timeZone: user.timeZone, plannedDays: user.plannedDays },
    today: today,
    history: user.history,
    totalXp: user.totalXp,
    achievementDefs: user.achievementDefs,
    unlockedAchievements: new Set(user.unlockedAchievements),
    challengeDefs: user.challengeDefs,
    completedChallenges: new Set(user.completedChallenges),
  };
  const result = processWorkout(workout, ctx);

  // The streak is rebuilt from the workout history, so deleting old workouts could make
  // "best" smaller. The rule is that the best streak is never lost, so keep the bigger one.
  if (user.bestStreak > result.streak.best) {
    result.streak.best = user.bestStreak;
  }

  const saved = await deps.saveWorkout(userId, workout, result, today);
  if (!saved.ok) {
    console.error("log-workout failed: " + saved.message);
    return errorResponse(500, "could not save the workout");
  }

  return json(200, {
    workoutId: saved.workoutId,
    earnedXp: result.earnedXp,
    xpGained: result.xpGained,
    totalXp: result.totalXp,
    levelBefore: result.levelBefore,
    levelAfter: result.levelAfter,
    leveledUp: result.leveledUp,
    unlocks: result.unlocks,
    streak: result.streak,
    challenges: result.challenges,
    newAchievements: result.newAchievements,
  });
}

// only keep the fields we know about, and tidy up the text
function cleanWorkout(input: WorkoutInput): WorkoutInput {
  const exercises = [];
  for (const e of input.exercises ?? []) {
    exercises.push({
      name: e.name.trim(),
      sets: e.sets ?? null,
      reps: e.reps ?? null,
      seconds: e.seconds ?? null,
      weightLb: e.weightLb ?? null,
    });
  }
  return {
    type: input.type,
    date: input.date,
    startedAt: input.startedAt ?? null,
    minutes: input.minutes,
    effort: input.effort ?? null,
    notes: input.notes ?? null,
    exercises: exercises,
  };
}
