// The main gamification logic. Takes the user's history + a new workout and figures out
// everything the workout earns (XP, streak, challenges, achievements, level up).
// This file doesn't talk to the database at all, which is why we can unit test it.
// log-workout/index.ts loads the data, calls processWorkout, then saves the result.

import { newAchievements, type AchievementDef } from "./achievements.ts";
import { evaluateChallenges, type ChallengeDef, type ChallengeState } from "./challenges.ts";
import { levelFromXp, unlocksBetween } from "./levels.ts";
import { computeStreak, streakBonus, type StreakResult } from "./streaks.ts";
import type { ProfileInput, WorkoutInput, WorkoutRecord, XpEvent } from "./types.ts";
import { earnsXp, XP } from "./xp.ts";

export interface WorkoutContext {
  profile: ProfileInput;
  today: string; // in the user's time zone
  history: WorkoutRecord[]; // all workouts they already logged
  totalXp: number;
  achievementDefs: AchievementDef[];
  unlockedAchievements: Set<string>;
  challengeDefs: ChallengeDef[];
  completedChallenges: Set<string>; // "challengeId|periodStart"
}

export interface WorkoutResult {
  earnedXp: boolean;
  xpEvents: XpEvent[];
  xpGained: number;
  totalXp: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  unlocks: string[];
  streak: StreakResult;
  challenges: ChallengeState[];
  newAchievements: string[];
}

// the workout should already be checked with validateWorkout before calling this
export function processWorkout(workout: WorkoutInput, ctx: WorkoutContext): WorkoutResult {
  // how many workouts already earned XP that day (for the 2 per day limit)
  let xpWorkoutsThatDay = 0;
  for (const w of ctx.history) {
    if (w.date === workout.date && w.earnedXp) xpWorkoutsThatDay++;
  }
  const earned = earnsXp(workout.minutes, xpWorkoutsThatDay);

  const newRecord: WorkoutRecord = {
    date: workout.date,
    minutes: workout.minutes,
    startedAt: workout.startedAt ?? null,
    earnedXp: earned,
    exercises: workout.exercises ?? [],
  };
  const allWorkouts = [...ctx.history, newRecord];

  // only workouts long enough to earn XP count for the streak
  const streakDates: string[] = [];
  for (const w of allWorkouts) {
    if (w.minutes >= XP.minMinutesForXp) streakDates.push(w.date);
  }
  const streak = computeStreak({
    workoutDates: streakDates,
    plannedDays: ctx.profile.plannedDays,
    today: ctx.today,
  });

  const xpEvents: XpEvent[] = [];

  // base XP + streak bonus
  if (earned) {
    xpEvents.push({ amount: XP.workout, reason: "workout" });
    const bonus = streakBonus(streak.current);
    if (bonus > 0) {
      xpEvents.push({ amount: bonus, reason: "streak_bonus" });
    }
  }

  // challenges
  const challenges = evaluateChallenges(ctx.challengeDefs, workout.date, allWorkouts, ctx.completedChallenges);
  for (const c of challenges) {
    if (!c.justCompleted) continue;
    const def = ctx.challengeDefs.find((d) => d.id === c.challengeId);
    if (def) {
      xpEvents.push({ amount: def.xpReward, reason: "challenge:" + def.id });
    }
  }

  // achievements
  const unlocked = newAchievements(
    ctx.achievementDefs,
    { workouts: allWorkouts, currentStreak: streak.current, bestStreak: streak.best },
    ctx.unlockedAchievements,
  );
  for (const a of unlocked) {
    xpEvents.push({ amount: a.xpReward, reason: "achievement:" + a.id });
  }

  // add it all up and check for a level up
  let xpGained = 0;
  for (const e of xpEvents) xpGained += e.amount;

  const totalXp = ctx.totalXp + xpGained;
  const levelBefore = levelFromXp(ctx.totalXp);
  const levelAfter = levelFromXp(totalXp);

  return {
    earnedXp: earned,
    xpEvents: xpEvents,
    xpGained: xpGained,
    totalXp: totalXp,
    levelBefore: levelBefore,
    levelAfter: levelAfter,
    leveledUp: levelAfter > levelBefore,
    unlocks: unlocksBetween(levelBefore, levelAfter),
    streak: streak,
    challenges: challenges,
    newAchievements: unlocked.map((a) => a.id),
  };
}
