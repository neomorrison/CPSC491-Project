import { describe, expect, it } from "vitest";
import {
  evaluateChallenges,
  evaluateGoals,
  goalProgress,
  isUnlocked,
  processDelete,
  processWorkout,
  validateWorkout,
  type ChallengeDef,
  type GoalDef,
  type WorkoutContext,
  type WorkoutRecord,
} from "../supabase/functions/_shared/gamification/index.ts";

// 2026-11-16 is a Monday
function ctx(overrides: Partial<WorkoutContext> = {}): WorkoutContext {
  return {
    profile: { timeZone: "America/Los_Angeles", plannedDays: ["mon", "wed", "fri"] },
    today: "2026-11-18",
    history: [],
    totalXp: 0,
    achievementDefs: [],
    unlockedAchievements: new Set(),
    challengeDefs: [],
    enrollments: [],
    goals: [],
    goalsDone: new Set(),
    ...overrides,
  };
}

const weekly3: GoalDef = { id: "g1", type: "workouts_per_week", target: 3, startDate: "2026-11-01" };

describe("goals (UC-06)", () => {
  it("weekly goals only count this week's workouts of 10+ minutes", () => {
    const workouts: WorkoutRecord[] = [
      { date: "2026-11-13", minutes: 30, earnedXp: true }, // last week
      { date: "2026-11-16", minutes: 30, earnedXp: true },
      { date: "2026-11-17", minutes: 5, earnedXp: false }, // too short
      { date: "2026-11-18", minutes: 45, earnedXp: true },
    ];
    expect(goalProgress(weekly3, workouts, "2026-11-18", 0)).toBe(2);

    const minutes: GoalDef = { id: "g2", type: "minutes_per_week", target: 100, startDate: "2026-11-01" };
    expect(goalProgress(minutes, workouts, "2026-11-18", 0)).toBe(75);

    const days: GoalDef = { id: "g3", type: "active_days_per_week", target: 3, startDate: "2026-11-01" };
    const twoOnOneDay = [...workouts, { date: "2026-11-18", minutes: 20, earnedXp: true }];
    expect(goalProgress(days, twoOnOneDay, "2026-11-18", 0)).toBe(2);
  });

  it("goals start at zero: workouts before the start date don't count", () => {
    const total: GoalDef = { id: "g4", type: "total_workouts", target: 10, startDate: "2026-11-17" };
    const workouts: WorkoutRecord[] = [
      { date: "2026-11-10", minutes: 30, earnedXp: true },
      { date: "2026-11-16", minutes: 30, earnedXp: true },
      { date: "2026-11-18", minutes: 30, earnedXp: true },
    ];
    expect(goalProgress(total, workouts, "2026-11-18", 0)).toBe(1);
  });

  it("streak goals use the current streak", () => {
    const streak: GoalDef = { id: "g5", type: "streak", target: 5, startDate: "2026-11-18" };
    expect(goalProgress(streak, [], "2026-11-18", 4)).toBe(4);
  });

  it("hitting a weekly goal pays 30 XP once per week", () => {
    const history: WorkoutRecord[] = [
      { date: "2026-11-16", minutes: 30, earnedXp: true },
      { date: "2026-11-17", minutes: 30, earnedXp: true },
    ];
    const r = processWorkout({ type: "cardio", date: "2026-11-18", minutes: 30 }, ctx({ history, goals: [weekly3] }));
    expect(r.goals[0]).toMatchObject({ goalId: "g1", weekStart: "2026-11-16", progress: 3, completed: true, justCompleted: true });
    expect(r.xpEvents).toContainEqual({ amount: 30, reason: "goal:workouts_per_week" });

    // a 4th workout the same week doesn't pay again
    const again = processWorkout(
      { type: "cardio", date: "2026-11-18", minutes: 30 },
      ctx({
        history: [...history, { date: "2026-11-18", minutes: 30, earnedXp: true }],
        goals: [weekly3],
        goalsDone: new Set(["workouts_per_week|2026-11-16"]),
      }),
    );
    expect(again.goals[0].justCompleted).toBe(false);
    expect(again.xpEvents.some((e) => e.reason.startsWith("goal:"))).toBe(false);
  });

  it("milestone goals pay 50 XP", () => {
    const total: GoalDef = { id: "g6", type: "total_workouts", target: 1, startDate: "2026-11-18" };
    const states = evaluateGoals([total], "2026-11-18", [{ date: "2026-11-18", minutes: 20, earnedXp: true }], 0, new Set());
    expect(states[0].completed).toBe(true);
    const r = processWorkout({ type: "yoga", date: "2026-11-18", minutes: 20 }, ctx({ goals: [total] }));
    expect(r.xpEvents).toContainEqual({ amount: 50, reason: "goal:total_workouts" });
  });
});

describe("joined challenges (UC-13)", () => {
  const weekly: ChallengeDef = { id: "workouts_4", name: "Work out 4 times", period: "weekly", metric: "workouts", target: 4, xpReward: 150 };

  it("only workouts from the day you joined count", () => {
    const enrollment = { challengeId: "workouts_4", periodStart: "2026-11-16", startDate: "2026-11-18", endDate: "2026-11-22" };
    const workouts: WorkoutRecord[] = [
      { date: "2026-11-16", minutes: 30, earnedXp: true },
      { date: "2026-11-17", minutes: 30, earnedXp: true },
      { date: "2026-11-18", minutes: 30, earnedXp: true },
    ];
    const states = evaluateChallenges([weekly], [enrollment], workouts);
    expect(states).toEqual([{ challengeId: "workouts_4", periodStart: "2026-11-16", progress: 1, completed: false, justCompleted: false }]);
  });

  it("a challenge that got turned off is skipped", () => {
    const enrollment = { challengeId: "gone", periodStart: "2026-11-16", startDate: "2026-11-16", endDate: "2026-11-22" };
    expect(evaluateChallenges([weekly], [enrollment], [])).toEqual([]);
  });
});

describe("editing and deleting workouts (UC-08)", () => {
  it("editing re-runs the rules without the old version of the workout", () => {
    // two XP workouts today, the user edits one of them: the edited one still earns XP
    // because the old version is left out of the history
    const other: WorkoutRecord = { id: "w1", date: "2026-11-18", minutes: 30, earnedXp: true };
    const r = processWorkout({ type: "cardio", date: "2026-11-18", minutes: 40 }, ctx({ history: [other] }));
    expect(r.earnedXp).toBe(true);
  });

  it("making a workout shorter than 10 minutes means it earns nothing", () => {
    const r = processWorkout({ type: "cardio", date: "2026-11-18", minutes: 8 }, ctx());
    expect(r.earnedXp).toBe(false);
    expect(r.xpGained).toBe(0);
    expect(r.streak.current).toBe(0);
  });

  it("deleting redoes the streak and challenge progress without the workout", () => {
    const enrollment = { challengeId: "move_20", periodStart: "2026-11-18", startDate: "2026-11-18", endDate: "2026-11-18" };
    const move: ChallengeDef = { id: "move_20", name: "Move 20", period: "daily", metric: "minutes", target: 20, xpReward: 40 };
    // the only workout left is a 15 minute one on Monday
    const history: WorkoutRecord[] = [{ date: "2026-11-16", minutes: 15, earnedXp: true }];
    const r = processDelete(ctx({ history, challengeDefs: [move], enrollments: [enrollment], totalXp: 200 }));
    expect(r.challenges[0]).toMatchObject({ progress: 0, completed: false });
    expect(r.xpEvents).toEqual([]);
    expect(r.totalXp).toBe(200);
    expect(r.earnedXp).toBe(false);
  });

  it("an edit can keep an old date, but can't move a workout to an old date", () => {
    const old = { type: "cardio", date: "2026-11-01", minutes: 30 };
    expect(validateWorkout(old, "2026-11-18", "2026-11-01")).toEqual([]);
    expect(validateWorkout(old, "2026-11-18", "2026-11-17")).toContain("workouts can only be logged up to 2 days late");
    expect(validateWorkout({ ...old, date: "2026-11-19" }, "2026-11-18", "2026-11-01")).toContain("date can't be in the future");
  });
});

describe("achievement rules (Strategy pattern)", () => {
  it("unknown rule kinds never unlock", () => {
    // deno-lint-ignore no-explicit-any
    const def = { id: "x", name: "X", rule: { kind: "moon_landing" } as any, xpReward: 10 };
    expect(isUnlocked(def, { workouts: [], currentStreak: 0, bestStreak: 0 })).toBe(false);
  });
});
