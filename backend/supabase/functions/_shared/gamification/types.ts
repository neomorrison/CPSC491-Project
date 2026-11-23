// Shared types for the gamification code

import type { Weekday } from "./dates.ts";

export type WorkoutType = "strength" | "cardio" | "yoga" | "sports" | "other";
export const WORKOUT_TYPES: string[] = ["strength", "cardio", "yoga", "sports", "other"];

export type Effort = "easy" | "just_right" | "tough";
export const EFFORTS: string[] = ["easy", "just_right", "tough"];

export interface ExerciseInput {
  name: string;
  sets?: number | null;
  reps?: number | null;
  seconds?: number | null;
  weightLb?: number | null;
}

// what the app sends to log-workout
export interface WorkoutInput {
  type: WorkoutType;
  title?: string | null; // "Workout name" on the Log Workout screen, optional
  date: string; // YYYY-MM-DD in the user's time zone
  startedAt?: string | null; // "HH:MM", optional
  minutes: number;
  effort?: Effort | null;
  notes?: string | null;
  exercises?: ExerciseInput[];
}

// a workout that's already saved in the database
export interface WorkoutRecord {
  id?: string; // the workouts table id (edit-workout uses it to leave out the one being changed)
  date: string;
  minutes: number;
  startedAt?: string | null;
  earnedXp: boolean;
  exercises?: ExerciseInput[];
}

// one row in the xp_events table
// reason is "workout", "streak_bonus", "challenge:<id>", "goal:<type>", "achievement:<id>" or "onboarding".
// the database also adds "workout_edited", "workout_deleted" and "level_floor" rows
export interface XpEvent {
  amount: number;
  reason: string;
}

export interface ProfileInput {
  timeZone: string;
  plannedDays: Weekday[];
}
