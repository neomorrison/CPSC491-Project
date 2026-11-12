// Achievements are one time badges.
// Each one has a "rule" saved as JSON in the achievements table, for example
//   { "kind": "total_workouts", "count": 10 }
// To add a new kind of achievement, add it to AchievementRule and add a case in isUnlocked.

import type { WorkoutRecord } from "./types.ts";

export type AchievementRule =
  | { kind: "total_workouts"; count: number }
  | { kind: "streak"; days: number }
  | { kind: "early_bird"; count: number; beforeHour: number };

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
}

export function isUnlocked(def: AchievementDef, stats: AchievementStats): boolean {
  const rule = def.rule;
  switch (rule.kind) {
    case "total_workouts":
      return stats.workouts.length >= rule.count;

    case "streak":
      return Math.max(stats.currentStreak, stats.bestStreak) >= rule.days;

    case "early_bird": {
      let earlyWorkouts = 0;
      for (const w of stats.workouts) {
        if (w.startedAt) {
          const hour = Number(w.startedAt.slice(0, 2));
          if (hour < rule.beforeHour) earlyWorkouts++;
        }
      }
      return earlyWorkouts >= rule.count;
    }

    default:
      // unknown kind (maybe added to the database before the code), just don't unlock it
      return false;
  }
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
