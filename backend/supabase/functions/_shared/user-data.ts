// What log-workout and edit-workout need to know about the user before running the game
// rules, and how that turns into the engine's context. No Deno or database code in here,
// so the handler tests can use it from Node.

import type { AchievementDef } from "./gamification/achievements.ts";
import type { ChallengeDef, Enrollment } from "./gamification/challenges.ts";
import type { Weekday } from "./gamification/dates.ts";
import type { WorkoutContext, WorkoutResult } from "./gamification/engine.ts";
import type { GoalDef } from "./gamification/goals.ts";
import type { WorkoutInput, WorkoutRecord } from "./gamification/types.ts";

export interface UserData {
  timeZone: string;
  plannedDays: Weekday[];
  history: WorkoutRecord[]; // without the workout being edited or deleted, if there is one
  totalXp: number; // without that workout's XP, if there is one
  bestStreak: number; // the best streak saved so far
  currentStreak: number; // the streak saved so far (edit-workout uses it for the "note")
  achievementDefs: AchievementDef[];
  unlockedAchievements: string[];
  challengeDefs: ChallengeDef[];
  enrollments: Enrollment[]; // challenges the user joined that are still active
  goals: GoalDef[]; // active goals
  goalsDone: string[]; // "goalType|weekStart" for goal XP already paid
}

export function contextFor(user: UserData, today: string): WorkoutContext {
  return {
    profile: { timeZone: user.timeZone, plannedDays: user.plannedDays },
    today: today,
    history: user.history,
    totalXp: user.totalXp,
    achievementDefs: user.achievementDefs,
    unlockedAchievements: new Set(user.unlockedAchievements),
    challengeDefs: user.challengeDefs,
    enrollments: user.enrollments,
    goals: user.goals,
    goalsDone: new Set(user.goalsDone),
  };
}

// The streak is rebuilt from the workout history, so deleting old workouts could make
// "best" smaller. The rule is that the best streak is never lost, so keep the bigger one.
export function keepBestStreak(result: WorkoutResult, user: UserData): void {
  if (user.bestStreak > result.streak.best) {
    result.streak.best = user.bestStreak;
  }
}

// only keep the fields we know about, and tidy up the text
export function cleanWorkout(input: WorkoutInput): WorkoutInput {
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
