// The main gamification logic. Takes the user's history + a workout change and figures out
// everything it earns (XP, streak, challenges, goals, achievements, level up).
// This file doesn't talk to the database at all, which is why we can unit test it.
// log-workout and edit-workout load the data, call these functions, then save the result.
//
// - logging a new workout:  processWorkout(workout, ctx)
// - editing a workout:      processWorkout(newVersion, ctx) with the old version left out of ctx.history
// - deleting a workout:     processDelete(ctx) with the deleted workout left out of ctx.history

import { newAchievements, type AchievementDef } from "./achievements.ts";
import { evaluateChallenges, type ChallengeDef, type ChallengeState, type Enrollment } from "./challenges.ts";
import { evaluateGoals, goalXp, type GoalDef, type GoalState } from "./goals.ts";
import { levelFromXp, unlocksBetween } from "./levels.ts";
import { computeStreak, streakBonus, type StreakResult } from "./streaks.ts";
import type { ProfileInput, WorkoutInput, WorkoutRecord, XpEvent } from "./types.ts";
import { earnsXp, XP } from "./xp.ts";

export interface WorkoutContext {
  profile: ProfileInput;
  today: string; // in the user's time zone
  history: WorkoutRecord[]; // the workouts already saved (not counting the one being changed)
  totalXp: number;
  achievementDefs: AchievementDef[];
  unlockedAchievements: Set<string>;
  challengeDefs: ChallengeDef[];
  enrollments: Enrollment[]; // challenges the user joined that are still active
  goals: GoalDef[]; // active goals
  goalsDone: Set<string>; // "goalType|weekStart" for goal XP already paid
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
  goals: GoalState[];
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
    type: workout.type,
    outdoor: workout.outdoor === true,
    date: workout.date,
    minutes: workout.minutes,
    startedAt: workout.startedAt ?? null,
    earnedXp: earned,
    exercises: workout.exercises ?? [],
  };
  const allWorkouts = [...ctx.history, newRecord];

  const rewards = progressRewards(allWorkouts, workout.date, ctx);

  // base XP + streak bonus go first
  const xpEvents: XpEvent[] = [];
  if (earned) {
    xpEvents.push({ amount: XP.workout, reason: "workout" });
    const bonus = streakBonus(rewards.streak.current);
    if (bonus > 0) {
      xpEvents.push({ amount: bonus, reason: "streak_bonus" });
    }
  }
  for (const e of rewards.xpEvents) xpEvents.push(e);

  // achievements
  const unlocked = newAchievements(
    ctx.achievementDefs,
    {
      workouts: allWorkouts,
      currentStreak: rewards.streak.current,
      bestStreak: rewards.streak.best,
      plannedDays: ctx.profile.plannedDays,
    },
    ctx.unlockedAchievements,
  );
  for (const a of unlocked) {
    xpEvents.push({ amount: a.xpReward, reason: "achievement:" + a.id });
  }

  return buildResult(earned, xpEvents, ctx.totalXp, rewards, unlocked.map((a) => a.id));
}

// after a workout is deleted: redo the streak, challenge and goal progress without it.
// deleting can't earn base XP or achievements, and the XP the workout earned before
// gets taken back in the database (save_workout_result)
export function processDelete(ctx: WorkoutContext): WorkoutResult {
  const rewards = progressRewards(ctx.history, ctx.today, ctx);
  return buildResult(false, rewards.xpEvents, ctx.totalXp, rewards, []);
}

interface ProgressRewards {
  streak: StreakResult;
  challenges: ChallengeState[];
  goals: GoalState[];
  xpEvents: XpEvent[]; // XP for challenges and goals that just got finished
}

// the parts that are the same for logging, editing and deleting
function progressRewards(allWorkouts: WorkoutRecord[], date: string, ctx: WorkoutContext): ProgressRewards {
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

  const challenges = evaluateChallenges(ctx.challengeDefs, ctx.enrollments, allWorkouts);
  for (const c of challenges) {
    if (!c.justCompleted) continue;
    for (const def of ctx.challengeDefs) {
      if (def.id === c.challengeId) {
        xpEvents.push({ amount: def.xpReward, reason: "challenge:" + def.id });
      }
    }
  }

  const goals = evaluateGoals(ctx.goals, date, allWorkouts, streak.current, ctx.goalsDone);
  for (const g of goals) {
    if (g.justCompleted) {
      xpEvents.push({ amount: goalXp(g.type), reason: "goal:" + g.type });
    }
  }

  return { streak: streak, challenges: challenges, goals: goals, xpEvents: xpEvents };
}

function buildResult(
  earned: boolean,
  xpEvents: XpEvent[],
  totalXpBefore: number,
  rewards: ProgressRewards,
  achievementIds: string[],
): WorkoutResult {
  let xpGained = 0;
  for (const e of xpEvents) xpGained += e.amount;

  const totalXp = totalXpBefore + xpGained;
  const levelBefore = levelFromXp(totalXpBefore);
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
    streak: rewards.streak,
    challenges: rewards.challenges,
    goals: rewards.goals,
    newAchievements: achievementIds,
  };
}
