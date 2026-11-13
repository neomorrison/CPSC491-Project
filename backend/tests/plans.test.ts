import { describe, expect, it } from "vitest";
import { validatePlan } from "../supabase/functions/_shared/gamification/index.ts";

const today = "2026-11-04"; // a Wednesday
const good = {
  weekStart: "2026-11-09",
  note: "You hit your goal 3 weeks in a row, so this week has 4 days.",
  items: [
    { day: "mon", workoutType: "strength", minutes: 35, details: "Lower body" },
    { day: "wed", workoutType: "sports", minutes: 45, details: "Pickup basketball" },
    { day: "fri", workoutType: "strength", minutes: 35 },
    { day: "sat", workoutType: "yoga", minutes: 20 },
  ],
};

describe("validatePlan", () => {
  it("accepts a normal plan", () => {
    const r = validatePlan(good, today);
    expect(r.ok).toBe(true);
  });

  it("requires at least one rest day", () => {
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const r = validatePlan({ ...good, items: days.map((day) => ({ day, workoutType: "cardio", minutes: 30 })) }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/rest day/);
  });

  it("keeps sessions between 10 and 120 minutes", () => {
    const r = validatePlan({ ...good, items: [{ day: "mon", workoutType: "cardio", minutes: 180 }] }, today);
    expect(r.ok).toBe(false);
  });

  it("rejects medical advice", () => {
    const r = validatePlan({ ...good, note: "This plan will cure your back pain." }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("note can't include medical advice");
  });

  it("rejects duplicate days, bad types, and weeks that don't start on Monday", () => {
    const r = validatePlan(
      { weekStart: "2026-11-10", items: [{ day: "mon", workoutType: "cardio", minutes: 30 }, { day: "mon", workoutType: "flying", minutes: 30 }] },
      today,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/Monday/);
      expect(r.errors.join("\n")).toMatch(/listed twice/);
      expect(r.errors.join("\n")).toMatch(/workoutType/);
    }
  });

  it("allows the current week but not past weeks or more than 4 weeks ahead", () => {
    expect(validatePlan({ ...good, weekStart: "2026-11-02" }, today).ok).toBe(true);
    expect(validatePlan({ ...good, weekStart: "2026-10-26" }, today).ok).toBe(false);
    expect(validatePlan({ ...good, weekStart: "2026-12-14" }, today).ok).toBe(false);
  });
});
