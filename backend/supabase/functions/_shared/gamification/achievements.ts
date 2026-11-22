// Achievements are one time badges.
// Each one has a "rule" saved as JSON in the achievements table, for example
//   { "kind": "total_workouts", "count": 10 }
//
// We used the Strategy pattern here: every kind of rule has its own check function in
// RULE_CHECKS, and they all take the same arguments. To add a new kind of achievement,
// add it to AchievementRule and add one function to RULE_CHECKS. Nothing else changes.

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
