// Challenges are goals that reset every day or every week.
// There's one daily and one weekly challenge at a time. They take turns going through
// the list in the challenges table, so to add a new one you just add a row.

import { addDays, daysBetween, weekStart } from "./dates.ts";
import type { WorkoutRecord } from "./types.ts";

export interface ChallengeDef {
  id: string;
  name: string;
  period: "daily" | "weekly";
  metric: "workouts" | "minutes" | "exercise_reps";
  exercise?: string | null; // only for exercise_reps, e.g. "squat" (also matches "Squats")
  target: number;
  xpReward: number;
}

export interface ChallengeState {
  challengeId: string;
  periodStart: string;
  progress: number;
  completed: boolean;
  justCompleted: boolean; // only true on the workout that finished it, so XP is only given once
}

// a Monday we count days/weeks from, so the rotation is the same for everyone
const START_DATE = "2026-01-05";

export function periodStartFor(period: "daily" | "weekly", date: string): string {
  if (period === "daily") return date;
  return weekStart(date);
}

// which daily and weekly challenge are running on this date
export function activeChallenges(defs: ChallengeDef[], date: string): ChallengeDef[] {
  // sort by id so the order doesn't depend on how the database returns them
  const sorted = [...defs].sort((a, b) => a.id.localeCompare(b.id));
  const daily = sorted.filter((c) => c.period === "daily");
  const weekly = sorted.filter((c) => c.period === "weekly");

  const dayNumber = daysBetween(START_DATE, date);
  const weekNumber = Math.floor(daysBetween(START_DATE, weekStart(date)) / 7);

  const result: ChallengeDef[] = [];
  if (daily.length > 0) result.push(daily[mod(dayNumber, daily.length)]);
  if (weekly.length > 0) result.push(weekly[mod(weekNumber, weekly.length)]);
  return result;
}

// % in JS can give negative numbers for dates before START_DATE, this can't
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

// "Squats", "squat" and "SQUATS" should all match
function sameExercise(name: string, exercise: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
  return clean(name) === clean(exercise);
}

export function challengeProgress(def: ChallengeDef, workoutsInPeriod: WorkoutRecord[]): number {
  if (def.metric === "workouts") {
    return workoutsInPeriod.length;
  }

  let total = 0;
  for (const w of workoutsInPeriod) {
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

// updates the challenges that are running on the workout's date
// allWorkouts should include the new workout
// alreadyCompleted has keys like "squats_50|2026-11-02" for challenges finished before
export function evaluateChallenges(
  defs: ChallengeDef[],
  date: string,
  allWorkouts: WorkoutRecord[],
  alreadyCompleted: Set<string>,
): ChallengeState[] {
  const states: ChallengeState[] = [];

  for (const def of activeChallenges(defs, date)) {
    const start = periodStartFor(def.period, date);
    const end = def.period === "daily" ? start : addDays(start, 6);
    const inPeriod = allWorkouts.filter((w) => w.date >= start && w.date <= end);

    const progress = Math.min(challengeProgress(def, inPeriod), def.target);
    const doneNow = progress >= def.target;
    const doneBefore = alreadyCompleted.has(def.id + "|" + start);

    states.push({
      challengeId: def.id,
      periodStart: start,
      progress: progress,
      completed: doneNow || doneBefore,
      justCompleted: doneNow && !doneBefore,
    });
  }
  return states;
}
