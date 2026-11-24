// Tests for Gala's medals and challenge medals (the new rule kinds in achievements.ts)
import { describe, expect, it } from "vitest";
import {
  isOutdoor,
  isUnlocked,
  processWorkout,
  type AchievementDef,
  type AchievementRule,
  type AchievementStats,
  type WorkoutContext,
  type WorkoutRecord,
} from "../supabase/functions/_shared/gamification/index.ts";

function medal(rule: AchievementRule): AchievementDef {
  return { id: "test", name: "Test", rule: rule, xpReward: 25 };
}

function stats(workouts: WorkoutRecord[], plannedDays: AchievementStats["plannedDays"] = []): AchievementStats {
  return { workouts: workouts, currentStreak: 0, bestStreak: 0, plannedDays: plannedDays };
}

function workout(date: string, type: string, outdoor = false): WorkoutRecord {
  return { date: date, type: type, outdoor: outdoor, minutes: 30, earnedXp: true };
}

// one workout of this type on each of the next "days" days, starting at "start"
function everyDay(start: string, days: number, type: string): WorkoutRecord[] {
  const list: WorkoutRecord[] = [];
  const first = new Date(start + "T00:00:00Z");
  for (let i = 0; i < days; i++) {
    const d = new Date(first);
    d.setUTCDate(first.getUTCDate() + i);
    list.push(workout(d.toISOString().slice(0, 10), type));
  }
  return list;
}

describe("Fresh Air and Expeditionist (outdoor)", () => {
  it("a hike always counts as outdoor, other workouts need the toggle", () => {
    expect(isOutdoor(workout("2026-11-02", "hiking"))).toBe(true);
    expect(isOutdoor(workout("2026-11-02", "cardio"))).toBe(false);
    expect(isOutdoor(workout("2026-11-02", "cardio", true))).toBe(true);
  });

  it("Fresh Air unlocks on the first outdoor workout", () => {
    const freshAir = medal({ kind: "outdoor", count: 1 });
    expect(isUnlocked(freshAir, stats([workout("2026-11-02", "strength")]))).toBe(false);
    expect(isUnlocked(freshAir, stats([workout("2026-11-02", "swimming", true)]))).toBe(true);
  });

  it("Expeditionist needs 12 outdoor workouts", () => {
    const expeditionist = medal({ kind: "outdoor", count: 12 });
    const eleven = everyDay("2026-11-01", 11, "hiking");
    expect(isUnlocked(expeditionist, stats(eleven))).toBe(false);
    expect(isUnlocked(expeditionist, stats([...eleven, workout("2026-11-20", "climbing", true)]))).toBe(true);
  });
});

describe("Finding Balance (workout type)", () => {
  const findingBalance = medal({ kind: "workout_type", types: ["yoga", "pilates"], count: 1 });

  it("unlocks on a yoga or pilates workout", () => {
    expect(isUnlocked(findingBalance, stats([workout("2026-11-02", "pilates")]))).toBe(true);
  });

  it("doesn't unlock on other types, or old workouts with no type", () => {
    expect(isUnlocked(findingBalance, stats([workout("2026-11-02", "mobility")]))).toBe(false);
    expect(isUnlocked(findingBalance, stats([{ date: "2026-11-02", minutes: 30, earnedXp: true }]))).toBe(false);
  });
});

describe("Breezy (walks on different days)", () => {
  const breezy = medal({ kind: "type_days", types: ["walking"], days: 30 });

  it("needs walks on 30 different days, not in a row", () => {
    // 29 walks, every other day
    const walks = everyDay("2026-09-01", 58, "walking").filter((_w, i) => i % 2 === 0);
    expect(walks.length).toBe(29);
    expect(isUnlocked(breezy, stats(walks))).toBe(false);
    expect(isUnlocked(breezy, stats([...walks, workout("2026-12-31", "walking")]))).toBe(true);
  });

  it("two walks on the same day count once", () => {
    const sameDay = [];
    for (let i = 0; i < 30; i++) sameDay.push(workout("2026-11-02", "walking"));
    expect(isUnlocked(breezy, stats(sameDay))).toBe(false);
  });
});

describe("Go-Getter and Harmonious (days in a row)", () => {
  const goGetter = medal({ kind: "type_days_in_a_row", types: ["cardio"], days: 7 });
  const harmonious = medal({ kind: "type_days_in_a_row", types: ["yoga", "pilates", "mobility"], days: 14 });

  it("Go-Getter needs cardio 7 days in a row", () => {
    expect(isUnlocked(goGetter, stats(everyDay("2026-11-01", 6, "cardio")))).toBe(false);
    expect(isUnlocked(goGetter, stats(everyDay("2026-11-01", 7, "cardio")))).toBe(true);
  });

  it("a missed day starts the count over", () => {
    const withGap = [...everyDay("2026-11-01", 4, "cardio"), ...everyDay("2026-11-06", 4, "cardio")];
    expect(isUnlocked(goGetter, stats(withGap))).toBe(false);
  });

  it("a day of a different type doesn't count", () => {
    const list = everyDay("2026-11-01", 7, "cardio");
    list[3] = workout(list[3].date, "strength");
    expect(isUnlocked(goGetter, stats(list))).toBe(false);
  });

  it("Harmonious can mix yoga, pilates and mobility", () => {
    const list = [
      ...everyDay("2026-11-01", 5, "yoga"),
      ...everyDay("2026-11-06", 5, "pilates"),
      ...everyDay("2026-11-11", 4, "mobility"),
    ];
    expect(isUnlocked(harmonious, stats(list))).toBe(true);
    expect(isUnlocked(harmonious, stats(list.slice(1)))).toBe(false);
  });
});

describe("Firestarter (planned weeks in a row)", () => {
  const firestarter = medal({ kind: "planned_weeks", weeks: 3 });
  const plan: AchievementStats["plannedDays"] = ["mon", "wed", "fri"];

  // Mon, Wed and Fri of the week starting on this Monday
  function fullWeek(monday: string): WorkoutRecord[] {
    const days = everyDay(monday, 5, "strength");
    return [days[0], days[2], days[4]];
  }

  it("unlocks after 3 weeks in a row with enough workout days", () => {
    const workouts = [...fullWeek("2026-11-02"), ...fullWeek("2026-11-09"), ...fullWeek("2026-11-16")];
    expect(isUnlocked(firestarter, stats(workouts, plan))).toBe(true);
  });

  it("any days count, as long as there are enough of them", () => {
    const workouts = [
      ...everyDay("2026-11-03", 3, "cardio"), // Tue, Wed, Thu
      ...fullWeek("2026-11-09"),
      ...everyDay("2026-11-20", 3, "walking"), // Fri, Sat, Sun
    ];
    expect(isUnlocked(firestarter, stats(workouts, plan))).toBe(true);
  });

  it("a short week in the middle starts the count over", () => {
    const shortWeek = fullWeek("2026-11-09").slice(0, 2);
    const workouts = [...fullWeek("2026-11-02"), ...shortWeek, ...fullWeek("2026-11-16")];
    expect(isUnlocked(firestarter, stats(workouts, plan))).toBe(false);
  });

  it("a week with no workouts at all also breaks it", () => {
    const workouts = [...fullWeek("2026-11-02"), ...fullWeek("2026-11-09"), ...fullWeek("2026-11-23")];
    expect(isUnlocked(firestarter, stats(workouts, plan))).toBe(false);
  });

  it("never unlocks without planned days", () => {
    const workouts = [...fullWeek("2026-11-02"), ...fullWeek("2026-11-09"), ...fullWeek("2026-11-16")];
    expect(isUnlocked(firestarter, stats(workouts, []))).toBe(false);
  });
});

describe("processWorkout with the new medals", () => {
  function ctx(overrides: Partial<WorkoutContext> = {}): WorkoutContext {
    return {
      profile: { timeZone: "America/Los_Angeles", plannedDays: ["mon", "wed", "fri"] },
      today: "2026-11-02",
      history: [],
      totalXp: 0,
      achievementDefs: [
        { id: "fresh_air", name: "Fresh Air", rule: { kind: "outdoor", count: 1 }, xpReward: 25 },
        { id: "firestarter", name: "Firestarter", rule: { kind: "planned_weeks", weeks: 1 }, xpReward: 150 },
      ],
      unlockedAchievements: new Set(),
      challengeDefs: [],
      enrollments: [],
      goals: [],
      goalsDone: new Set(),
      ...overrides,
    };
  }

  it("the workout being logged counts, with its type and outdoor toggle", () => {
    const r = processWorkout({ type: "walking", outdoor: true, date: "2026-11-02", minutes: 30 }, ctx());
    expect(r.newAchievements).toEqual(["fresh_air"]);
  });

  it("uses the planned days from the profile", () => {
    const history = [workout("2026-11-02", "strength"), workout("2026-11-04", "strength")];
    const r = processWorkout(
      { type: "strength", date: "2026-11-06", minutes: 30 },
      ctx({ today: "2026-11-06", history: history }),
    );
    expect(r.newAchievements).toEqual(["firestarter"]);
  });
});
