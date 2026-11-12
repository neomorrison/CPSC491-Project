// Checks for workout plans made by the AI assistant (used by the save-plan function).
// If a plan fails we send back the list of reasons so the assistant can fix it and try again.

import { daysBetween, isDate, WEEKDAYS, type Weekday } from "./dates.ts";
import { WORKOUT_TYPES, type WorkoutType } from "./types.ts";

export const PLAN_LIMITS = {
  minMinutes: 10,
  maxMinutes: 120,
  maxDays: 6, // max 6 workout days so there's always a rest day
  maxDetails: 300,
  maxNote: 500,
  maxWeeksAhead: 4,
};

// The assistant should only give general workout advice, not medical advice.
// This isn't perfect but it catches the obvious stuff.
const MEDICAL_WORDS =
  /\b(diagnos\w*|cures?|cured|treat(s|ing|ment)?|prescri\w*|medicat\w*|rehab\w*|therap\w*|disease|disorder|injur(y|ies)\s+recovery|doctor says)\b/i;

export interface PlanItem {
  day: Weekday;
  workoutType: WorkoutType;
  minutes: number;
  details?: string | null;
}

export interface PlanInput {
  weekStart: string; // the Monday the plan starts
  note?: string | null;
  items: PlanItem[];
}

export type PlanCheck = { ok: true; plan: PlanInput } | { ok: false; errors: string[] };

// deno-lint-ignore no-explicit-any
export function validatePlan(input: any, today: string): PlanCheck {
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["plan must be an object"] };
  }
  const errors: string[] = [];

  // week start
  if (!isDate(input.weekStart)) {
    errors.push("weekStart must be YYYY-MM-DD");
  } else {
    if (new Date(input.weekStart + "T00:00:00Z").getUTCDay() !== 1) {
      errors.push("weekStart must be a Monday");
    }
    const daysAhead = daysBetween(today, input.weekStart);
    if (daysAhead < -6) {
      errors.push("weekStart can't be in a past week");
    }
    if (daysAhead > PLAN_LIMITS.maxWeeksAhead * 7) {
      errors.push("weekStart can be at most " + PLAN_LIMITS.maxWeeksAhead + " weeks ahead");
    }
  }

  // note
  if (input.note != null) {
    if (typeof input.note !== "string" || input.note.length > PLAN_LIMITS.maxNote) {
      errors.push("note must be under " + PLAN_LIMITS.maxNote + " characters");
    } else if (MEDICAL_WORDS.test(input.note)) {
      errors.push("note can't include medical advice");
    }
  }

  // items
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push("items must list at least one workout day");
  } else {
    if (input.items.length > PLAN_LIMITS.maxDays) {
      errors.push("a plan can have at most " + PLAN_LIMITS.maxDays + " workout days, so there is at least one rest day");
    }
    const daysUsed: string[] = [];
    for (let i = 0; i < input.items.length; i++) {
      checkItem(input.items[i], i + 1, daysUsed, errors);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors };
  }

  // only keep the fields we know about
  const items: PlanItem[] = [];
  for (const item of input.items) {
    items.push({
      day: item.day,
      workoutType: item.workoutType,
      minutes: item.minutes,
      details: item.details ?? null,
    });
  }
  return { ok: true, plan: { weekStart: input.weekStart, note: input.note ?? null, items: items } };
}

// deno-lint-ignore no-explicit-any
function checkItem(item: any, num: number, daysUsed: string[], errors: string[]) {
  const label = "item " + num + ": ";
  if (!item) {
    errors.push(label + "day must be one of " + WEEKDAYS.join(", "));
    return;
  }

  if (!WEEKDAYS.includes(item.day)) {
    errors.push(label + "day must be one of " + WEEKDAYS.join(", "));
  } else if (daysUsed.includes(item.day)) {
    errors.push(label + item.day + " is listed twice");
  } else {
    daysUsed.push(item.day);
  }

  if (!WORKOUT_TYPES.includes(item.workoutType)) {
    errors.push(label + "workoutType must be one of " + WORKOUT_TYPES.join(", "));
  }

  if (!Number.isInteger(item.minutes) || item.minutes < PLAN_LIMITS.minMinutes || item.minutes > PLAN_LIMITS.maxMinutes) {
    errors.push(label + "minutes must be " + PLAN_LIMITS.minMinutes + " to " + PLAN_LIMITS.maxMinutes);
  }

  if (item.details != null) {
    if (typeof item.details !== "string" || item.details.length > PLAN_LIMITS.maxDetails) {
      errors.push(label + "details must be under " + PLAN_LIMITS.maxDetails + " characters");
    } else if (MEDICAL_WORDS.test(item.details)) {
      errors.push(label + "details can't include medical advice");
    }
  }
}
