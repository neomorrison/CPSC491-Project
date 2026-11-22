// Goals (UC-06 in our proposal). The user picks a goal type and a target, and the
// progress gets worked out from their workouts.
//
// Weekly goals (workouts, minutes or active days per week) can be hit again every week.
// Milestone goals (a streak, or a number of workouts) are done once.
// Goal XP is only given once per goal type per week, so you can't farm it by deleting a
// finished goal and making it again. The goal_progress view in the second migration
// does the same math in SQL so the app can show progress without calling a function.

import { addDays, weekStart } from "./dates.ts";
import type { WorkoutRecord } from "./types.ts";
import { XP } from "./xp.ts";

export type GoalType =
  | "workouts_per_week"
  | "minutes_per_week"
  | "active_days_per_week"
  | "streak"
  | "total_workouts";

// allowed targets for each type (same numbers as the check constraint in the migration)
export const GOAL_LIMITS = {
  workouts_per_week: { min: 1, max: 14 },
  minutes_per_week: { min: 10, max: 1500 },
  active_days_per_week: { min: 1, max: 7 },
  streak: { min: 2, max: 365 },
  total_workouts: { min: 1, max: 1000 },
};

export const GOAL_XP = {
  weekly: 30, // every week you hit a weekly goal
  milestone: 50, // once, when a milestone goal is done
};

export const MAX_ACTIVE_GOALS = 5;

// suggested starter goals for each experience level (the app shows these in UC-06 step 2)
export const STARTER_GOALS = {
  beginner: [
    { type: "workouts_per_week", target: 2 },
    { type: "minutes_per_week", target: 60 },
  ],
  some: [
    { type: "workouts_per_week", target: 3 },
    { type: "minutes_per_week", target: 120 },
  ],
  experienced: [
    { type: "workouts_per_week", target: 4 },
    { type: "minutes_per_week", target: 180 },
  ],
};

export interface GoalDef {
  id: string;
  type: GoalType;
  target: number;
  startDate: string; // workouts before this date don't count
}

export interface GoalState {
  goalId: string;
  type: GoalType;
  weekStart: string;
  progress: number;
  completed: boolean;
  justCompleted: boolean; // only true the first time this type is reached this week
}

export function isWeeklyGoal(type: GoalType): boolean {
  return type === "workouts_per_week" || type === "minutes_per_week" || type === "active_days_per_week";
}

// progress toward one goal, for the week that `date` is in
export function goalProgress(goal: GoalDef, workouts: WorkoutRecord[], date: string, currentStreak: number): number {
  if (goal.type === "streak") return currentStreak;

  // same rule as streaks: only workouts long enough to earn XP count
  let from = goal.startDate;
  let to = "9999-12-31";
  if (isWeeklyGoal(goal.type)) {
    const monday = weekStart(date);
    if (monday > from) from = monday;
    to = addDays(monday, 6);
  }

  const counted: WorkoutRecord[] = [];
  for (const w of workouts) {
    if (w.minutes >= XP.minMinutesForXp && w.date >= from && w.date <= to) {
      counted.push(w);
    }
  }

  if (goal.type === "minutes_per_week") {
    let minutes = 0;
    for (const w of counted) minutes += w.minutes;
    return minutes;
  }
  if (goal.type === "active_days_per_week") {
    const days: string[] = [];
    for (const w of counted) {
      if (!days.includes(w.date)) days.push(w.date);
    }
    return days.length;
  }
  // workouts_per_week and total_workouts
  return counted.length;
}

// checks every active goal after a workout change
// alreadyDone has keys like "workouts_per_week|2026-11-16" for goal types already paid this week
export function evaluateGoals(
  goals: GoalDef[],
  date: string,
  allWorkouts: WorkoutRecord[],
  currentStreak: number,
  alreadyDone: Set<string>,
): GoalState[] {
  const states: GoalState[] = [];
  const monday = weekStart(date);

  for (const goal of goals) {
    const progress = goalProgress(goal, allWorkouts, date, currentStreak);
    const done = progress >= goal.target;
    states.push({
      goalId: goal.id,
      type: goal.type,
      weekStart: monday,
      progress: Math.min(progress, goal.target),
      completed: done,
      justCompleted: done && !alreadyDone.has(goal.type + "|" + monday),
    });
  }
  return states;
}

export function goalXp(type: GoalType): number {
  if (isWeeklyGoal(type)) return GOAL_XP.weekly;
  return GOAL_XP.milestone;
}
