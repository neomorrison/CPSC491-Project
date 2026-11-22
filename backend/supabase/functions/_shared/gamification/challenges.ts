// Challenges (UC-13 in our proposal) are short goals that last a day or a week.
// The user joins the ones they want with join_challenge() in the database, and that
// saves an enrollment with a start and end date. Only workouts inside that window count.
// Harder challenges have a min_level, which join_challenge() checks.

import type { WorkoutRecord } from "./types.ts";

export interface ChallengeDef {
  id: string;
  name: string;
  period: "daily" | "weekly";
  metric: "workouts" | "minutes" | "exercise_reps";
  exercise?: string | null; // only for exercise_reps, e.g. "squat" (also matches "Squats")
  target: number;
  xpReward: number;
  minLevel?: number;
}

// a challenge the user joined and hasn't finished yet (status 'active' in user_challenges)
export interface Enrollment {
  challengeId: string;
  periodStart: string;
  startDate: string; // the day they joined
  endDate: string;
}

export interface ChallengeState {
  challengeId: string;
  periodStart: string;
  progress: number;
  completed: boolean;
  justCompleted: boolean; // true on the workout that finished it, so XP is only given once
}

export const MAX_ACTIVE_CHALLENGES = 3;

// "Squats", "squat" and "SQUATS" should all match
function sameExercise(name: string, exercise: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
  return clean(name) === clean(exercise);
}

export function challengeProgress(def: ChallengeDef, workoutsInWindow: WorkoutRecord[]): number {
  if (def.metric === "workouts") {
    return workoutsInWindow.length;
  }

  let total = 0;
  for (const w of workoutsInWindow) {
    if (def.metric === "minutes") {
      total += w.minutes;
    } else if (def.metric === "exercise_reps" && def.exercise) {
      for (const e of w.exercises || []) {
        if (sameExercise(e.name, def.exercise)) {
          total += (e.sets || 1) * (e.reps || 0);
        }
      }
    }
  }
  return total;
}

// works out the progress for every challenge the user is in.
// allWorkouts should already include the new (or edited) workout.
// enrollments are only the active ones, so a challenge that's already completed is never
// paid twice. Completed challenges also stay completed if a workout gets deleted later.
export function evaluateChallenges(
  defs: ChallengeDef[],
  enrollments: Enrollment[],
  allWorkouts: WorkoutRecord[],
): ChallengeState[] {
  const states: ChallengeState[] = [];

  for (const enrollment of enrollments) {
    let def: ChallengeDef | undefined;
    for (const d of defs) {
      if (d.id === enrollment.challengeId) def = d;
    }
    if (!def) continue; // challenge was turned off

    const inWindow: WorkoutRecord[] = [];
    for (const w of allWorkouts) {
      if (w.date >= enrollment.startDate && w.date <= enrollment.endDate) inWindow.push(w);
    }

    const progress = Math.min(challengeProgress(def, inWindow), def.target);
    const done = progress >= def.target;
    states.push({
      challengeId: def.id,
      periodStart: enrollment.periodStart,
      progress: progress,
      completed: done,
      justCompleted: done,
    });
  }
  return states;
}
