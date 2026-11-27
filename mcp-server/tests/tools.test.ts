import { describe, expect, it } from "vitest";
import {
  createWorkoutPlan,
  getGoals,
  getPlan,
  getProgress,
  getWeeklySummary,
  getWorkouts,
  isDate,
  updateWorkoutPlan,
} from "../src/tools.ts";
import { fakeData, profile } from "./fake.ts";

const PLAN_ID = "11111111-2222-4333-8444-555555555555";
const plan = {
  weekStart: "2026-11-09",
  note: "Easy week.",
  items: [{ day: "mon", workoutType: "cardio", minutes: 30 }],
};
// Wednesday Nov 4, noon in Los Angeles
const NOW = new Date("2026-11-04T20:00:00Z");

describe("read permission", () => {
  const off = () => fakeData({ getProfile: async () => profile({ ai_can_read: false }) });

  it("every read tool refuses when the user hasn't allowed reading", async () => {
    for (const result of [
      await getWorkouts(off(), {}),
      await getGoals(off()),
      await getProgress(off()),
      await getPlan(off(), {}),
      await getWeeklySummary(off()),
    ]) {
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/not allowed AI assistants to read/);
    }
  });

  it("doesn't touch the data when reading is off", async () => {
    const data = off();
    await getWorkouts(data, {});
    await getPlan(data, {});
    expect(data.calls.workouts.length).toBe(0);
    expect(data.calls.plans.length).toBe(0);
  });

  it("says so when there is no profile", async () => {
    const result = await getGoals(fakeData({ getProfile: async () => null }));
    expect(result.isError).toBe(true);
  });
});

describe("get_workouts", () => {
  it("defaults to the last 30 days in the user's time zone", async () => {
    const data = fakeData();
    const result = await getWorkouts(data, {}, NOW);
    expect(result.isError).toBe(false);
    expect(data.calls.workouts[0]).toEqual({ from: "2026-10-06", to: "2026-11-04" });
  });

  it("uses the dates it is given", async () => {
    const data = fakeData();
    await getWorkouts(data, { from: "2026-10-01", to: "2026-10-31" }, NOW);
    expect(data.calls.workouts[0]).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("returns workouts with their exercises in camelCase", async () => {
    const body = JSON.parse((await getWorkouts(fakeData(), {}, NOW)).text);
    expect(body.count).toBe(1);
    expect(body.workouts[0]).toEqual({
      date: "2026-11-02",
      title: "Leg day",
      type: "strength",
      minutes: 40,
      startedAt: "07:30",
      effort: "just_right",
      notes: null,
      earnedXp: true,
      exercises: [{ name: "Squats", sets: 3, reps: 10, seconds: null, weightLb: 95 }],
    });
  });

  it("rejects bad dates and backwards ranges", async () => {
    expect((await getWorkouts(fakeData(), { from: "yesterday" }, NOW)).isError).toBe(true);
    expect((await getWorkouts(fakeData(), { from: "2026-02-30" }, NOW)).isError).toBe(true);
    expect((await getWorkouts(fakeData(), { from: "2026-11-03", to: "2026-11-01" }, NOW)).isError).toBe(true);
  });

  it("rejects ranges longer than a year", async () => {
    const result = await getWorkouts(fakeData(), { from: "2024-01-01", to: "2026-11-01" }, NOW);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/one year/);
  });
});

describe("get_goals", () => {
  it("returns the goal settings but no personal details", async () => {
    const body = JSON.parse((await getGoals(fakeData())).text);
    expect(body.goal).toBe("be_active");
    expect(body.plannedDays).toEqual(["mon", "wed", "fri"]);
    expect(body.sessionMinutes).toBe(30);
    expect(body.experience).toBe("beginner");
    expect(body.canSuggestPlans).toBe(true);
    expect(body.display_name).toBeUndefined();
    expect(body.displayName).toBeUndefined();
  });
});

describe("get_progress", () => {
  it("returns level, XP, streak and badges", async () => {
    const body = JSON.parse((await getProgress(fakeData())).text);
    expect(body).toEqual({
      level: 3,
      totalXp: 320,
      streak: { current: 4, best: 9, freezesLeft: 1, atRisk: false },
      badges: [{ id: "first_workout", name: "First Step", unlockedAt: "2026-10-01T10:00:00Z" }],
    });
  });

  it("gives starting values for a brand new user", async () => {
    const data = fakeData({ getProgress: async () => null, getStreak: async () => null, getBadges: async () => [] });
    const body = JSON.parse((await getProgress(data)).text);
    expect(body.level).toBe(1);
    expect(body.totalXp).toBe(0);
    expect(body.streak.current).toBe(0);
    expect(body.badges).toEqual([]);
  });
});

describe("get_plan", () => {
  it("returns plans with their items", async () => {
    const data = fakeData();
    const body = JSON.parse((await getPlan(data, {})).text);
    expect(data.calls.plans).toEqual([null]);
    expect(body.plans[0].planId).toBe(PLAN_ID);
    expect(body.plans[0].status).toBe("suggested");
    expect(body.plans[0].items).toEqual([{ day: "mon", workoutType: "cardio", minutes: 30, details: null }]);
  });

  it("passes weekStart through and rejects a bad one", async () => {
    const data = fakeData();
    await getPlan(data, { weekStart: "2026-11-09" });
    expect(data.calls.plans).toEqual(["2026-11-09"]);
    expect((await getPlan(fakeData(), { weekStart: "next week" })).isError).toBe(true);
  });
});

describe("create_workout_plan and update_workout_plan", () => {
  it("create sends the plan without a planId", async () => {
    const data = fakeData();
    const result = await createWorkoutPlan(data, plan);
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text).planId).toBe(PLAN_ID);
    expect(JSON.parse(result.text).status).toBe("suggested");
    expect(result.text).toMatch(/accept or dismiss/);
    expect(data.calls.saved[0]).toEqual(plan);
  });

  it("update sends the planId", async () => {
    const data = fakeData();
    await updateWorkoutPlan(data, { ...plan, planId: PLAN_ID });
    expect(data.calls.saved[0]).toEqual({ planId: PLAN_ID, ...plan });
  });

  it("403: tells the assistant to ask the user to enable plans", async () => {
    const result = await createWorkoutPlan(fakeData({}, { status: 403, body: { error: "off" } }), plan);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/Suggest workout plans/);
  });

  it("422: passes the reasons back so the assistant can fix the plan", async () => {
    const answer = { status: 422, body: { error: "plan failed the checks", details: ["mon: minutes must be 10 to 120", "plan needs a rest day"] } };
    const result = await createWorkoutPlan(fakeData({}, answer), plan);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/minutes must be 10 to 120/);
    expect(result.text).toMatch(/rest day/);
  });

  it("404: tells the assistant to create a new plan", async () => {
    const result = await updateWorkoutPlan(fakeData({}, { status: 404, body: { error: "gone" } }), { ...plan, planId: PLAN_ID });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/create_workout_plan/);
  });

  it("401: says the login is the problem", async () => {
    const result = await createWorkoutPlan(fakeData({}, { status: 401, body: { error: "not signed in" } }), plan);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/login/);
  });

  it("429: tells the assistant to stop creating plans and update instead", async () => {
    const result = await createWorkoutPlan(fakeData({}, { status: 429, body: { error: "Too many new plans." } }), plan);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/too many new plans/);
    expect(result.text).toMatch(/update_workout_plan/);
  });

  it("422: passes back an experience cap reason too", async () => {
    const answer = { status: 422, body: { error: "plan failed the checks", details: ["too many sessions for a beginner: 5 workout days, the most is 4"] } };
    const result = await createWorkoutPlan(fakeData({}, answer), plan);
    expect(result.text).toMatch(/too many sessions for a beginner/);
  });

  it("anything else is a plain error", async () => {
    const result = await createWorkoutPlan(fakeData({}, { status: 500, body: null }), plan);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/500/);
  });

  it("plan tools still work when reading is off (separate permissions)", async () => {
    const data = fakeData({ getProfile: async () => profile({ ai_can_read: false }) });
    const result = await createWorkoutPlan(data, plan);
    expect(result.isError).toBe(false);
  });
});

describe("isDate", () => {
  it("accepts real dates only", () => {
    expect(isDate("2026-11-02")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("11/02/2026")).toBe(false);
    expect(isDate(20261102)).toBe(false);
  });
});

describe("get_weekly_summary", () => {
  // NOW is Wednesday Nov 4, so the week is Mon Nov 2 to Sun Nov 8 and last week starts Oct 26
  function workout(date: string, minutes: number, type = "strength") {
    return { workout_date: date, title: null, type, minutes, started_at: null, effort: null, notes: null, earned_xp: true, workout_exercises: [] };
  }
  const week = (workouts: ReturnType<typeof workout>[], changes = {}) =>
    fakeData({ getWorkouts: async () => workouts, getPlans: async () => [], ...changes });

  it("asks for last week and this week, in the user's time zone", async () => {
    const data = fakeData();
    const body = JSON.parse((await getWeeklySummary(data, NOW)).text);
    expect(data.calls.workouts[0]).toEqual({ from: "2026-10-26", to: "2026-11-08" });
    expect(body.today).toBe("2026-11-04");
    expect(body.weekStart).toBe("2026-11-02");
    expect(body.daysIntoWeek).toBe(3);
  });

  it("adds up this week and last week separately", async () => {
    const data = week([
      workout("2026-11-02", 40),
      workout("2026-11-03", 20, "cardio"),
      workout("2026-11-03", 15, "yoga"),
      workout("2026-10-28", 30),
    ]);
    const body = JSON.parse((await getWeeklySummary(data, NOW)).text);
    expect(body.thisWeek.workouts).toBe(3);
    expect(body.thisWeek.minutes).toBe(75);
    expect(body.thisWeek.activeDays).toBe(2);
    expect(body.thisWeek.byType).toEqual({
      strength: { workouts: 1, minutes: 40 },
      cardio: { workouts: 1, minutes: 20 },
      yoga: { workouts: 1, minutes: 15 },
    });
    expect(body.lastWeek).toEqual({ workouts: 1, minutes: 30, activeDays: 1, plannedDaysDone: 1, plannedDaysTotal: 3 });
    expect(body.comparedToLastWeek.workouts).toBe(2);
    expect(body.comparedToLastWeek.minutes).toBe(45);
  });

  it("sorts planned days into done, missed, and still to come", async () => {
    // planned mon, wed, fri. Monday was skipped, today (Wednesday) and Friday haven't happened yet.
    let body = JSON.parse((await getWeeklySummary(week([]), NOW)).text);
    expect(body.thisWeek.plannedDaysDone).toEqual([]);
    expect(body.thisWeek.plannedDaysMissed).toEqual(["mon"]);
    expect(body.thisWeek.plannedDaysLeft).toEqual(["wed", "fri"]);

    body = JSON.parse((await getWeeklySummary(week([workout("2026-11-02", 30), workout("2026-11-04", 30)]), NOW)).text);
    expect(body.thisWeek.plannedDaysDone).toEqual(["mon", "wed"]);
    expect(body.thisWeek.plannedDaysMissed).toEqual([]);
    expect(body.thisWeek.plannedDaysLeft).toEqual(["fri"]);
  });

  it("includes streak, level, and goal progress", async () => {
    const body = JSON.parse((await getWeeklySummary(fakeData(), NOW)).text);
    expect(body.streak).toEqual({ current: 4, best: 9, atRisk: false });
    expect(body.level).toBe(3);
    expect(body.totalXp).toBe(320);
    expect(body.goals).toEqual([{ type: "workouts_per_week", name: null, target: 3, progress: 1, doneThisWeek: false }]);
  });

  it("shows how far along this week's plan is, preferring the active plan", async () => {
    const plans = [
      { id: "s", week_start: "2026-11-02", status: "suggested", created_by: "assistant", note: null, plan_items: [] },
      {
        id: "a",
        week_start: "2026-11-02",
        status: "active",
        created_by: "assistant",
        note: null,
        plan_items: [
          { day: "mon", workout_type: "strength", minutes: 30, details: null },
          { day: "thu", workout_type: "cardio", minutes: 30, details: null },
        ],
      },
    ];
    const data = week([workout("2026-11-02", 30)], { getPlans: async () => plans });
    const body = JSON.parse((await getWeeklySummary(data, NOW)).text);
    expect(body.plan.planId).toBe("a");
    expect(body.plan.days).toEqual([
      { day: "mon", workoutType: "strength", minutes: 30, done: true },
      { day: "thu", workoutType: "cardio", minutes: 30, done: false },
    ]);
  });

  it("works for a user with nothing logged yet", async () => {
    const data = week([], { getStreak: async () => null, getProgress: async () => null, getGoalProgress: async () => [] });
    const body = JSON.parse((await getWeeklySummary(data, NOW)).text);
    expect(body.thisWeek.workouts).toBe(0);
    expect(body.lastWeek.workouts).toBe(0);
    expect(body.streak.current).toBe(0);
    expect(body.level).toBe(1);
    expect(body.goals).toEqual([]);
    expect(body.plan).toBeNull();
  });

  it("treats Sunday as the last day of the week, not the first", async () => {
    const sunday = new Date("2026-11-08T20:00:00Z");
    const body = JSON.parse((await getWeeklySummary(week([]), sunday)).text);
    expect(body.weekStart).toBe("2026-11-02");
    expect(body.daysIntoWeek).toBe(7);
  });
});
