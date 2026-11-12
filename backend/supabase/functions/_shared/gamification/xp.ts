// XP rules (from the "Experience points" part of our proposal)
// XP is for showing up, not for how hard you went. A 20 min walk gets the same
// base XP as an hour of lifting.

import { daysBetween, isDate } from "./dates.ts";
import { EFFORTS, WORKOUT_TYPES } from "./types.ts";

export const XP = {
  workout: 50,
  onboarding: 25,
  minMinutesForXp: 10, // shorter workouts still get saved, they just don't earn XP
  xpWorkoutsPerDay: 2, // only the first 2 workouts each day earn XP
  maxBackdateDays: 2, // you can log a workout up to 2 days late
};

// checks a workout sent by the app. returns a list of problems, empty means it's ok
// deno-lint-ignore no-explicit-any
export function validateWorkout(input: any, today: string): string[] {
  if (typeof input !== "object" || input === null) {
    return ["workout must be an object"];
  }
  const errors: string[] = [];

  if (!WORKOUT_TYPES.includes(input.type)) {
    errors.push("type must be one of " + WORKOUT_TYPES.join(", "));
  }

  if (!isDate(input.date)) {
    errors.push("date must be YYYY-MM-DD");
  } else {
    const daysAgo = daysBetween(input.date, today);
    if (daysAgo < 0) {
      errors.push("date can't be in the future");
    } else if (daysAgo > XP.maxBackdateDays) {
      errors.push("workouts can only be logged up to " + XP.maxBackdateDays + " days late");
    }
  }

  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 600) {
    errors.push("minutes must be a whole number from 1 to 600");
  }

  if (input.startedAt != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startedAt)) {
    errors.push("startedAt must be HH:MM");
  }

  if (input.effort != null && !EFFORTS.includes(input.effort)) {
    errors.push("effort must be one of " + EFFORTS.join(", "));
  }

  if (input.notes != null && (typeof input.notes !== "string" || input.notes.length > 1000)) {
    errors.push("notes must be under 1000 characters");
  }

  if (input.exercises != null) {
    if (!Array.isArray(input.exercises) || input.exercises.length > 30) {
      errors.push("exercises must be a list of at most 30");
    } else {
      for (let i = 0; i < input.exercises.length; i++) {
        checkExercise(input.exercises[i], i + 1, errors);
      }
    }
  }

  return errors;
}

// deno-lint-ignore no-explicit-any
function checkExercise(e: any, num: number, errors: string[]) {
  if (!e || typeof e.name !== "string" || e.name.trim() === "" || e.name.length > 80) {
    errors.push("exercise " + num + " needs a name under 80 characters");
  }
  if (!e) return;

  if (!isWholeNumberInRange(e.sets, 50)) errors.push("exercise " + num + " sets must be 1 to 50");
  if (!isWholeNumberInRange(e.reps, 1000)) errors.push("exercise " + num + " reps must be 1 to 1000");
  if (!isWholeNumberInRange(e.seconds, 7200)) errors.push("exercise " + num + " seconds must be 1 to 7200");

  if (e.weightLb != null && (typeof e.weightLb !== "number" || e.weightLb < 0 || e.weightLb > 2000)) {
    errors.push("exercise " + num + " weightLb must be 0 to 2000");
  }
}

// these fields are optional, so null/undefined is fine
function isWholeNumberInRange(value: unknown, max: number): boolean {
  if (value == null) return true;
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
}

// does a new workout earn XP? needs to be long enough and under the daily limit
export function earnsXp(minutes: number, xpWorkoutsAlreadyThatDay: number): boolean {
  if (minutes < XP.minMinutesForXp) return false;
  if (xpWorkoutsAlreadyThatDay >= XP.xpWorkoutsPerDay) return false;
  return true;
}
