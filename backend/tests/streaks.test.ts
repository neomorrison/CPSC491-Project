import { describe, expect, it } from "vitest";
import { addDays, computeStreak, streakBonus, type Weekday } from "../supabase/functions/_shared/gamification/index.ts";

// 2026-11-02 is a Monday.
const MON = "2026-11-02";
const day = (offset: number) => addDays(MON, offset);
const MWF: Weekday[] = ["mon", "wed", "fri"];

describe("computeStreak", () => {
  it("is 0 with no workouts", () => {
    expect(computeStreak({ workoutDates: [], plannedDays: MWF, today: MON })).toMatchObject({ current: 0, best: 0, freezesLeft: 1 });
  });

  it("counts planned days in a row and ignores rest days", () => {
    // Mon, Wed, Fri worked out; Tue and Thu are rest days.
    const r = computeStreak({ workoutDates: [day(0), day(2), day(4)], plannedDays: MWF, today: day(5) });
    expect(r.current).toBe(3);
    expect(r.atRisk).toBe(false);
  });

  it("adds extra workouts on unplanned days", () => {
    const r = computeStreak({ workoutDates: [day(0), day(1), day(2)], plannedDays: MWF, today: day(2) });
    expect(r.current).toBe(3);
  });

  it("GT-1: a grace day makes up a missed planned day without using a freeze", () => {
    // Streak of 5 (previous week + Mon..), miss Wednesday, work out Thursday.
    const dates = [day(-7), day(-5), day(-3), day(0)]; // prior Mon, Wed, Fri, this Mon = 4
    const r = computeStreak({ workoutDates: [...dates, day(1), day(3)], plannedDays: MWF, today: day(3) });
    // Tue extra (5), Wed missed, Thu makes it up (6)
    expect(r.current).toBe(6);
    expect(r.freezesLeft).toBe(1);
  });

  it("GT-4: a freeze keeps the streak when a missed day isn't made up", () => {
    // Mon worked out, Wed missed, Thu nothing, Fri worked out.
    const r = computeStreak({ workoutDates: [day(0), day(4)], plannedDays: MWF, today: day(4) });
    expect(r.current).toBe(2);
    expect(r.freezesLeft).toBe(0);
  });

  it("resets to 0 when there is no freeze left, but keeps the best streak", () => {
    // Week 1: Mon, Wed. Week 2: miss Mon (freeze), miss Wed (no freeze) -> reset.
    const dates = [day(0), day(2), day(4)];
    const r = computeStreak({ workoutDates: dates, plannedDays: MWF, today: day(11) });
    expect(r.current).toBe(0);
    expect(r.best).toBe(3);
  });

  it("gives a fresh freeze each week", () => {
    // Miss Wed in week 1 (freeze), miss Wed in week 2 (new freeze).
    const dates = [day(0), day(4), day(7), day(11)];
    const r = computeStreak({ workoutDates: dates, plannedDays: MWF, today: day(11) });
    expect(r.current).toBe(4);
  });

  it("doesn't count today as missed before the day is over", () => {
    const r = computeStreak({ workoutDates: [day(-3)], plannedDays: MWF, today: MON }); // prior Fri, today Mon
    expect(r.current).toBe(1);
    expect(r.atRisk).toBe(true);
  });

  it("flags at risk on the grace day", () => {
    const r = computeStreak({ workoutDates: [day(0)], plannedDays: MWF, today: day(3) }); // Wed missed, today Thu
    expect(r.pendingMissedDay).toBe(day(2));
    expect(r.atRisk).toBe(true);
    expect(r.current).toBe(1);
  });

  it("one workout can't cover both a missed day and a planned day", () => {
    // Plan every weekday. Mon worked out, Tue missed, Wed one workout covers Tue, so Wed is missed,
    // Thu nothing -> freeze. Fri worked out.
    const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
    const r = computeStreak({ workoutDates: [day(0), day(2), day(4)], plannedDays: weekdays, today: day(4) });
    expect(r.current).toBe(3);
    expect(r.freezesLeft).toBe(0);
  });

  it("two workouts on one day can cover a missed day and that day", () => {
    const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
    const r = computeStreak({ workoutDates: [day(0), day(2), day(2)], plannedDays: weekdays, today: day(2) });
    expect(r.current).toBe(3);
    expect(r.freezesLeft).toBe(1);
  });

  it("ignores workouts dated in the future", () => {
    const r = computeStreak({ workoutDates: [day(0), day(5)], plannedDays: MWF, today: day(0) });
    expect(r.current).toBe(1);
  });
});

describe("streakBonus", () => {
  it("is +5 per streak day, capped at +30", () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(2)).toBe(10);
    expect(streakBonus(6)).toBe(30);
    expect(streakBonus(40)).toBe(30);
  });
});
