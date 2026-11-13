import { describe, expect, it } from "vitest";
import {
  activeChallenges,
  challengeProgress,
  processWorkout,
  totalXpToReach,
  type AchievementDef,
  type ChallengeDef,
  type WorkoutContext,
  type WorkoutRecord,
} from "../supabase/functions/_shared/gamification/index.ts";

const achievementDefs: AchievementDef[] = [
  { id: "first_workout", name: "First Step", rule: { kind: "total_workouts", count: 1 }, xpReward: 25 },
  { id: "streak_7", name: "On a Roll", rule: { kind: "streak", days: 7 }, xpReward: 50 },
  { id: "early_bird", name: "Early Bird", rule: { kind: "early_bird", count: 5, beforeHour: 8 }, xpReward: 50 },
];

const challengeDefs: ChallengeDef[] = [
  { id: "squats_50", name: "50 squat day", period: "daily", metric: "exercise_reps", exercise: "squat", target: 50, xpReward: 40 },
  { id: "workouts_4", name: "Work out 4 times", period: "weekly", metric: "workouts", target: 4, xpReward: 150 },
];

function ctx(overrides: Partial<WorkoutContext> = {}): WorkoutContext {
  return {
    profile: { timeZone: "America/Los_Angeles", plannedDays: ["mon", "wed", "fri"] },
    today: "2026-11-02",
    history: [],
    totalXp: 0,
    achievementDefs,
    unlockedAchievements: new Set(),
    challengeDefs,
    completedChallenges: new Set(),
    ...overrides,
  };
}

describe("processWorkout", () => {
  it("first workout: base XP, streak bonus, first achievement", () => {
    const r = processWorkout({ type: "cardio", date: "2026-11-02", minutes: 30 }, ctx());
    expect(r.earnedXp).toBe(true);
    expect(r.xpEvents).toEqual([
      { amount: 50, reason: "workout" },
      { amount: 5, reason: "streak_bonus" },
      { amount: 25, reason: "achievement:first_workout" },
    ]);
    expect(r.xpGained).toBe(80);
    expect(r.streak.current).toBe(1);
    expect(r.newAchievements).toEqual(["first_workout"]);
    expect(r.leveledUp).toBe(false);
  });

  it("doesn't give the same achievement twice", () => {
    const history: WorkoutRecord[] = [{ date: "2026-11-02", minutes: 30, earnedXp: true }];
    const r = processWorkout(
      { type: "cardio", date: "2026-11-04", minutes: 30 },
      ctx({ today: "2026-11-04", history, unlockedAchievements: new Set(["first_workout"]) }),
    );
    expect(r.newAchievements).toEqual([]);
  });

  it("GT-2: a third workout on the same day is saved with no XP", () => {
    const history: WorkoutRecord[] = [
      { date: "2026-11-02", minutes: 30, earnedXp: true },
      { date: "2026-11-02", minutes: 30, earnedXp: true },
    ];
    const r = processWorkout(
      { type: "cardio", date: "2026-11-02", minutes: 30 },
      ctx({ history, unlockedAchievements: new Set(["first_workout"]) }),
    );
    expect(r.earnedXp).toBe(false);
    expect(r.xpGained).toBe(0);
  });

  it("GT-3: crossing a level boundary reports the level up and the unlock", () => {
    const r = processWorkout(
      { type: "strength", date: "2026-11-02", minutes: 30 },
      ctx({ totalXp: totalXpToReach(7) + 690, unlockedAchievements: new Set(["first_workout"]) }),
    );
    expect(r.levelBefore).toBe(7);
    expect(r.levelAfter).toBe(8);
    expect(r.leveledUp).toBe(true);
    expect(r.unlocks).toEqual(["theme:ember"]);
  });

  it("finishing a challenge pays out once", () => {
    // 2026-11-02 rotation: check which daily challenge is active first.
    const daily = activeChallenges(challengeDefs, "2026-11-02").find((c) => c.period === "daily")!;
    expect(daily.id).toBe("squats_50");

    const squats = { type: "strength" as const, date: "2026-11-02", minutes: 20, exercises: [{ name: "Squats", sets: 5, reps: 10 }] };
    const first = processWorkout(squats, ctx({ unlockedAchievements: new Set(["first_workout"]) }));
    const done = first.challenges.find((c) => c.challengeId === "squats_50")!;
    expect(done).toMatchObject({ progress: 50, completed: true, justCompleted: true });
    expect(first.xpEvents).toContainEqual({ amount: 40, reason: "challenge:squats_50" });

    const again = processWorkout(
      squats,
      ctx({
        history: [{ date: "2026-11-02", minutes: 20, earnedXp: true, exercises: squats.exercises }],
        unlockedAchievements: new Set(["first_workout"]),
        completedChallenges: new Set(["squats_50|2026-11-02"]),
      }),
    );
    expect(again.xpEvents.some((e) => e.reason.startsWith("challenge:squats_50"))).toBe(false);
  });

  it("counts reps across sets and matches exercise names loosely", () => {
    const def = challengeDefs[0];
    const workouts: WorkoutRecord[] = [
      { date: "2026-11-02", minutes: 10, earnedXp: true, exercises: [{ name: "squat", sets: 2, reps: 10 }, { name: "Push-ups", sets: 3, reps: 15 }] },
      { date: "2026-11-02", minutes: 10, earnedXp: true, exercises: [{ name: "Squats", reps: 15 }] },
    ];
    expect(challengeProgress(def, workouts)).toBe(35);
  });

  it("early bird unlocks after 5 workouts before 8am", () => {
    // 4 early workouts already, the 5th one below should unlock it
    const history: WorkoutRecord[] = [
      { date: "2026-10-25", minutes: 20, startedAt: "06:45", earnedXp: true },
      { date: "2026-10-26", minutes: 20, startedAt: "06:45", earnedXp: true },
      { date: "2026-10-27", minutes: 20, startedAt: "06:45", earnedXp: true },
      { date: "2026-10-28", minutes: 20, startedAt: "06:45", earnedXp: true },
    ];
    const r = processWorkout(
      { type: "cardio", date: "2026-11-02", minutes: 20, startedAt: "07:10" },
      ctx({ history, unlockedAchievements: new Set(["first_workout"]) }),
    );
    expect(r.newAchievements).toContain("early_bird");
  });
});
