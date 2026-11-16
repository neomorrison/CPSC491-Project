import { describe, expect, it } from "vitest";
import {
  checkPlanForExperience,
  experienceOf,
  EXTRA_LIMITS,
  overWeeklyLimit,
  windowStart,
} from "../supabase/functions/save-plan/limits.ts";
import type { PlanInput } from "../supabase/functions/_shared/gamification/index.ts";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

// a plan with this many workout days, each this many minutes
function plan(days: number, minutes: number): PlanInput {
  return {
    weekStart: "2026-11-09",
    items: DAYS.slice(0, days).map((day) => ({ day: day, workoutType: "cardio" as const, minutes: minutes })),
  };
}

describe("experienceOf", () => {
  it("keeps known levels", () => {
    expect(experienceOf("beginner")).toBe("beginner");
    expect(experienceOf("some")).toBe("some");
    expect(experienceOf("experienced")).toBe("experienced");
  });

  it("treats anything else as a beginner", () => {
    expect(experienceOf(null)).toBe("beginner");
    expect(experienceOf(undefined)).toBe("beginner");
    expect(experienceOf("expert")).toBe("beginner");
  });
});

describe("sessions per week", () => {
  it("lets a beginner have 4 days but not 5", () => {
    expect(checkPlanForExperience(plan(4, 30), "beginner")).toEqual([]);
    expect(checkPlanForExperience(plan(5, 30), "beginner")[0]).toMatch(/too many sessions for a beginner: 5 workout days, the most is 4/);
  });

  it("lets someone with some experience have 5 days but not 6", () => {
    expect(checkPlanForExperience(plan(5, 30), "some")).toEqual([]);
    expect(checkPlanForExperience(plan(6, 30), "some")[0]).toMatch(/too many sessions/);
  });

  it("lets an experienced user have 6 days", () => {
    expect(checkPlanForExperience(plan(6, 30), "experienced")).toEqual([]);
  });

  it("uses the beginner cap when experience isn't set", () => {
    expect(checkPlanForExperience(plan(5, 30), null).length).toBe(1);
  });
});

describe("total minutes per week", () => {
  it("lets a beginner have 180 minutes but not more", () => {
    expect(checkPlanForExperience(plan(4, 45), "beginner")).toEqual([]);
    expect(checkPlanForExperience(plan(4, 50), "beginner")[0]).toMatch(/too much total time for a beginner: 200 minutes this week, the most is 180/);
  });

  it("lets someone with some experience have 300 minutes but not more", () => {
    expect(checkPlanForExperience(plan(5, 60), "some")).toEqual([]);
    expect(checkPlanForExperience(plan(5, 61), "some").length).toBe(1);
  });

  it("lets an experienced user have 480 minutes but not more", () => {
    expect(checkPlanForExperience(plan(6, 80), "experienced")).toEqual([]);
    expect(checkPlanForExperience(plan(6, 90), "experienced").length).toBe(1);
  });

  it("reports both problems at once", () => {
    expect(checkPlanForExperience(plan(6, 120), "beginner").length).toBe(2);
  });

  it("is fine with an empty plan", () => {
    expect(checkPlanForExperience(plan(0, 0), "beginner")).toEqual([]);
  });
});

describe("weekly limit on new plans", () => {
  it("allows up to the limit and blocks at it", () => {
    expect(overWeeklyLimit(0)).toBe(false);
    expect(overWeeklyLimit(EXTRA_LIMITS.maxNewPlansPerWeek - 1)).toBe(false);
    expect(overWeeklyLimit(EXTRA_LIMITS.maxNewPlansPerWeek)).toBe(true);
    expect(overWeeklyLimit(EXTRA_LIMITS.maxNewPlansPerWeek + 3)).toBe(true);
  });

  it("looks back exactly 7 days", () => {
    expect(windowStart(new Date("2026-11-16T12:00:00Z"))).toBe("2026-11-09T12:00:00.000Z");
  });
});
