// Achievements are one time badges (the app calls them medals).
// Each one has a "rule" saved as JSON in the achievements table, for example
//   { "kind": "total_workouts", "count": 10 }
//
// We used the Strategy pattern here: every kind of rule has its own check function in
// RULE_CHECKS, and they all take the same arguments. To add a new kind of achievement,
// add it to AchievementRule and add one function to RULE_CHECKS. Nothing else changes.

import { addDays, daysBetween, weekStart, type Weekday } from "./dates.ts";
import type { WorkoutRecord } from "./types.ts";

export type AchievementRule =
  | { kind: "total_workouts"; count: number }
  | { kind: "streak"; days: number }
  | { kind: "early_bird"; count: number; beforeHour: number }
  | { kind: "workout_type"; types: string[]; count: number } // e.g. 1 yoga or pilates workout
  | { kind: "outdoor"; count: number } // e.g. 12 outdoor workouts
  | { kind: "type_days"; types: string[]; days: number } // e.g. walked on 30 different days
  | { kind: "type_days_in_a_row"; types: string[]; days: number } // e.g. cardio 7 days in a row
  | { kind: "planned_weeks"; weeks: number }; // met the weekly schedule N weeks in a row

export interface AchievementDef {
  id: string;
  name: string;
  rule: AchievementRule;
  xpReward: number;
}

export interface AchievementStats {
  workouts: WorkoutRecord[];
  currentStreak: number;
  bestStreak: number;
  plannedDays?: Weekday[]; // the days the user plans to work out, from their profile
}

// A hike is always outside. Any other workout counts if the user turned on "Outdoors".
export function isOutdoor(workout: WorkoutRecord): boolean {
  return workout.outdoor === true || workout.type === "hiking";
}

// the different dates that have at least one workout of one of these types
function datesWithType(workouts: WorkoutRecord[], types: string[]): string[] {
  const dates: string[] = [];
  for (const w of workouts) {
    if (w.type && types.includes(w.type) && !dates.includes(w.date)) {
      dates.push(w.date);
    }
  }
  return dates;
}

// the longest run of back to back days in a list of dates
function longestRunOfDays(dates: string[]): number {
  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && daysBetween(sorted[i - 1], sorted[i]) === 1) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }
  return longest;
}

// deno-lint-ignore no-explicit-any
type RuleCheck = (rule: any, stats: AchievementStats) => boolean;

const RULE_CHECKS: Record<string, RuleCheck> = {
  total_workouts: function (rule, stats) {
    return stats.workouts.length >= rule.count;
  },

  streak: function (rule, stats) {
    return Math.max(stats.currentStreak, stats.bestStreak) >= rule.days;
  },

  early_bird: function (rule, stats) {
    let earlyWorkouts = 0;
    for (const w of stats.workouts) {
      if (w.startedAt) {
        const hour = Number(w.startedAt.slice(0, 2));
        if (hour < rule.beforeHour) earlyWorkouts++;
      }
    }
    return earlyWorkouts >= rule.count;
  },

  workout_type: function (rule, stats) {
    let matching = 0;
    for (const w of stats.workouts) {
      if (w.type && rule.types.includes(w.type)) matching++;
    }
    return matching >= rule.count;
  },

  outdoor: function (rule, stats) {
    let outdoorWorkouts = 0;
    for (const w of stats.workouts) {
      if (isOutdoor(w)) outdoorWorkouts++;
    }
    return outdoorWorkouts >= rule.count;
  },

  type_days: function (rule, stats) {
    return datesWithType(stats.workouts, rule.types).length >= rule.days;
  },

  type_days_in_a_row: function (rule, stats) {
    const dates = datesWithType(stats.workouts, rule.types);
    return longestRunOfDays(dates) >= rule.days;
  },

  // A week (Monday to Sunday) is "met" when the user worked out on at least as many
  // different days as they planned. For example, planned Mon/Wed/Fri means 3 workout days.
  planned_weeks: function (rule, stats) {
    const daysPerWeek = stats.plannedDays?.length ?? 0;
    if (daysPerWeek === 0 || stats.workouts.length === 0) return false;

    // count the different workout days in each week
    const daysInWeek: Record<string, string[]> = {};
    for (const w of stats.workouts) {
      const monday = weekStart(w.date);
      if (!daysInWeek[monday]) daysInWeek[monday] = [];
      if (!daysInWeek[monday].includes(w.date)) daysInWeek[monday].push(w.date);
    }

    // go through every week from the first workout to the last one
    const mondays = Object.keys(daysInWeek).sort();
    const lastMonday = mondays[mondays.length - 1];
    let weeksInARow = 0;
    for (let monday = mondays[0]; monday <= lastMonday; monday = addDays(monday, 7)) {
      const workoutDays = daysInWeek[monday]?.length ?? 0;
      if (workoutDays >= daysPerWeek) {
        weeksInARow++;
        if (weeksInARow >= rule.weeks) return true;
      } else {
        weeksInARow = 0;
      }
    }
    return false;
  },
};

export function isUnlocked(def: AchievementDef, stats: AchievementStats): boolean {
  const check = RULE_CHECKS[def.rule.kind];
  // unknown kind (maybe added to the database before the code), just don't unlock it
  if (!check) return false;
  return check(def.rule, stats);
}

// achievements the user just earned, not counting ones they already have
export function newAchievements(
  defs: AchievementDef[],
  stats: AchievementStats,
  alreadyUnlocked: Set<string>,
): AchievementDef[] {
  const result: AchievementDef[] = [];
  for (const def of defs) {
    if (alreadyUnlocked.has(def.id)) continue;
    if (isUnlocked(def, stats)) result.push(def);
  }
  return result;
}
