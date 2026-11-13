import { describe, expect, it } from "vitest";
import {
  earnsXp,
  levelFromXp,
  levelProgress,
  rankFor,
  totalXpToReach,
  unlocksBetween,
  validateWorkout,
} from "../supabase/functions/_shared/gamification/index.ts";

describe("levels", () => {
  it("matches the level table in the proposal", () => {
    expect(totalXpToReach(2)).toBe(100);
    expect(totalXpToReach(3)).toBe(300);
    expect(totalXpToReach(6)).toBe(1500);
    expect(totalXpToReach(8)).toBe(2800);
    expect(totalXpToReach(11)).toBe(5500);
  });

  it("finds the level for a total", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(2799)).toBe(7);
    expect(levelFromXp(2800)).toBe(8);
  });

  it("GT-3: level 7 with 620 of 700 XP plus 100 XP reaches level 8 with 20 XP toward level 9", () => {
    const before = totalXpToReach(7) + 620;
    expect(levelProgress(before)).toMatchObject({ level: 7, xpIntoLevel: 620, xpForNextLevel: 700 });
    expect(levelProgress(before + 100)).toMatchObject({ level: 8, xpIntoLevel: 20, xpForNextLevel: 800 });
  });

  it("names ranks and unlocks", () => {
    expect(rankFor(4)).toBe("Starter");
    expect(rankFor(8)).toBe("Regular");
    expect(rankFor(20)).toBe("Legend");
    expect(unlocksBetween(7, 8)).toEqual(["theme:ember"]);
    expect(unlocksBetween(8, 9)).toEqual([]);
  });
});

describe("XP rules", () => {
  it("GT-5: workouts under 10 minutes earn no XP", () => {
    expect(earnsXp(8, 0)).toBe(false);
    expect(earnsXp(10, 0)).toBe(true);
  });

  it("GT-2: only 2 workouts a day earn XP", () => {
    expect(earnsXp(30, 1)).toBe(true);
    expect(earnsXp(30, 2)).toBe(false);
  });
});

describe("validateWorkout", () => {
  const today = "2026-11-04";
  const ok = { type: "strength", date: today, minutes: 35 };

  it("accepts a normal workout", () => {
    expect(validateWorkout(ok, today)).toEqual([]);
    expect(validateWorkout({ ...ok, startedAt: "07:30", effort: "tough", exercises: [{ name: "Squats", sets: 3, reps: 10, weightLb: 95 }] }, today)).toEqual([]);
  });

  it("rejects future dates and dates more than 2 days back", () => {
    expect(validateWorkout({ ...ok, date: "2026-11-05" }, today)).toContain("date can't be in the future");
    expect(validateWorkout({ ...ok, date: "2026-11-02" }, today)).toEqual([]);
    expect(validateWorkout({ ...ok, date: "2026-11-01" }, today).join()).toMatch(/2 days late/);
  });

  it("rejects bad fields", () => {
    expect(validateWorkout({ ...ok, type: "napping" }, today).join()).toMatch(/type/);
    expect(validateWorkout({ ...ok, minutes: 0 }, today).join()).toMatch(/minutes/);
    expect(validateWorkout({ ...ok, startedAt: "25:00" }, today).join()).toMatch(/startedAt/);
    expect(validateWorkout({ ...ok, exercises: [{ name: "", reps: 5 }] }, today).join()).toMatch(/name/);
    expect(validateWorkout(null, today)).toEqual(["workout must be an object"]);
  });
});
