import { describe, expect, it } from "vitest";
import { handleLogWorkout, type LogWorkoutDeps, type UserData } from "../supabase/functions/log-workout/handler.ts";
import type { WorkoutResult } from "../supabase/functions/_shared/gamification/index.ts";

function userData(changes: Partial<UserData> = {}): UserData {
  return {
    timeZone: "America/Los_Angeles",
    plannedDays: ["mon", "wed", "fri"],
    history: [],
    totalXp: 0,
    bestStreak: 0,
    currentStreak: 0,
    achievementDefs: [{ id: "first_workout", name: "First Step", rule: { kind: "total_workouts", count: 1 }, xpReward: 25 }],
    unlockedAchievements: [],
    challengeDefs: [{ id: "move_20", name: "Move for 20 minutes", period: "daily", metric: "minutes", target: 20, xpReward: 40 }],
    // the user joined move_20 today (only joined challenges count)
    enrollments: [{ challengeId: "move_20", periodStart: "2026-11-02", startDate: "2026-11-02", endDate: "2026-11-02" }],
    goals: [],
    goalsDone: [],
    ...changes,
  };
}

// fake database calls. each test changes only the part it cares about.
function makeDeps(changes: Partial<LogWorkoutDeps> = {}) {
  const saves: { userId: string; result: WorkoutResult; today: string }[] = [];
  const deps: LogWorkoutDeps = {
    getUserId: async () => "user-1",
    loadUserData: async () => userData(),
    saveWorkout: async (userId, _workout, result, today) => {
      saves.push({ userId, result, today });
      return { ok: true, workoutId: "workout-1" };
    },
    now: () => new Date("2026-11-02T20:00:00Z"), // Monday Nov 2, noon in Los Angeles
    ...changes,
  };
  return { deps, saves };
}

function post(body: unknown, token: string | null = "Bearer abc") {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = token;
  return new Request("http://localhost/log-workout", {
    method: "POST",
    headers: headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const workout = { type: "cardio", date: "2026-11-02", minutes: 30 };

describe("log-workout", () => {
  it("saves a first workout and returns what it earned", async () => {
    const { deps, saves } = makeDeps();
    const res = await handleLogWorkout(post(workout), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workoutId).toBe("workout-1");
    expect(body.earnedXp).toBe(true);
    // 50 workout + 5 streak bonus + 40 daily challenge + 25 first achievement
    expect(body.xpGained).toBe(120);
    expect(body.totalXp).toBe(120);
    expect(body.leveledUp).toBe(true);
    expect(body.streak.current).toBe(1);
    expect(body.newAchievements).toEqual(["first_workout"]);
    expect(saves.length).toBe(1);
    expect(saves[0].userId).toBe("user-1");
    expect(saves[0].today).toBe("2026-11-02");
  });

  it("answers 401 with no token", async () => {
    const { deps, saves } = makeDeps();
    const res = await handleLogWorkout(post(workout, null), deps);
    expect(res.status).toBe(401);
    expect(saves.length).toBe(0);
  });

  it("answers 401 with a bad token", async () => {
    const { deps } = makeDeps({ getUserId: async () => null });
    const res = await handleLogWorkout(post(workout), deps);
    expect(res.status).toBe(401);
  });

  it("answers 422 with the reasons for a bad workout", async () => {
    const { deps, saves } = makeDeps();
    const res = await handleLogWorkout(post({ type: "skydiving", date: "2026-11-02", minutes: 0 }), deps);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.details.length).toBe(2);
    expect(saves.length).toBe(0);
  });

  it("answers 422 for a body that isn't JSON", async () => {
    const { deps } = makeDeps();
    const res = await handleLogWorkout(post("not json"), deps);
    expect(res.status).toBe(422);
  });

  it("rejects a workout dated tomorrow in the user's time zone", async () => {
    // 2026-11-03 06:00 UTC is still Nov 2 in Los Angeles
    const { deps } = makeDeps({ now: () => new Date("2026-11-03T06:00:00Z") });
    const res = await handleLogWorkout(post({ ...workout, date: "2026-11-03" }), deps);
    expect(res.status).toBe(422);
    expect((await res.json()).details.join()).toMatch(/future/);
  });

  it("saves a short workout without XP", async () => {
    const { deps, saves } = makeDeps();
    const res = await handleLogWorkout(post({ ...workout, minutes: 5 }), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.earnedXp).toBe(false);
    expect(saves.length).toBe(1);
  });

  it("gives no base XP for a third workout in one day", async () => {
    const earlier = { date: "2026-11-02", minutes: 30, earnedXp: true };
    const { deps } = makeDeps({
      // move_20 was already finished earlier today, so it's no longer an active enrollment
      loadUserData: async () => userData({ history: [earlier, earlier], unlockedAchievements: ["first_workout"], enrollments: [] }),
    });
    const res = await handleLogWorkout(post(workout), deps);
    const body = await res.json();
    expect(body.earnedXp).toBe(false);
    expect(body.xpGained).toBe(0);
  });

  it("never lowers the best streak", async () => {
    const { deps, saves } = makeDeps({ loadUserData: async () => userData({ bestStreak: 12 }) });
    const res = await handleLogWorkout(post(workout), deps);
    expect((await res.json()).streak.best).toBe(12);
    expect(saves[0].result.streak.best).toBe(12);
  });

  it("trims exercise names and drops unknown fields", async () => {
    let saved: unknown = null;
    const { deps } = makeDeps({
      saveWorkout: async (_u, w) => {
        saved = w;
        return { ok: true, workoutId: "workout-1" };
      },
    });
    const res = await handleLogWorkout(
      post({ ...workout, userId: "someone-else", exercises: [{ name: "  Squats ", sets: 3, reps: 10 }] }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(saved).toEqual({
      type: "cardio",
      title: null,
      date: "2026-11-02",
      startedAt: null,
      minutes: 30,
      outdoor: false,
      effort: null,
      notes: null,
      exercises: [{ name: "Squats", sets: 3, reps: 10, seconds: null, weightLb: null }],
    });
  });

  it("saves the workout title, trimmed, and rejects one over 60 characters", async () => {
    let saved: { title?: string | null } | null = null;
    const { deps } = makeDeps({
      saveWorkout: async (_u, w) => {
        saved = w;
        return { ok: true, workoutId: "workout-1" };
      },
    });
    const res = await handleLogWorkout(post({ ...workout, title: "  Morning run " }), deps);
    expect(res.status).toBe(200);
    expect(saved!.title).toBe("Morning run");

    const tooLong = await handleLogWorkout(post({ ...workout, title: "x".repeat(61) }), deps);
    expect(tooLong.status).toBe(422);
    expect((await tooLong.json()).details.join()).toMatch(/title/);
  });

  it("pays weekly goal XP and returns goal progress", async () => {
    const goal = { id: "g1", type: "workouts_per_week" as const, target: 1, startDate: "2026-11-02" };
    const { deps } = makeDeps({ loadUserData: async () => userData({ goals: [goal] }) });
    const body = await (await handleLogWorkout(post(workout), deps)).json();
    expect(body.xpEvents).toContainEqual({ amount: 30, reason: "goal:workouts_per_week" });
    expect(body.goals[0]).toMatchObject({ goalId: "g1", progress: 1, completed: true, justCompleted: true });
    expect(body.level.level).toBe(2);
  });

  it("doesn't pay for a challenge the user didn't join", async () => {
    const { deps } = makeDeps({ loadUserData: async () => userData({ enrollments: [] }) });
    const body = await (await handleLogWorkout(post(workout), deps)).json();
    // 50 workout + 5 streak bonus + 25 first achievement, no challenge XP
    expect(body.xpGained).toBe(80);
  });

  it("answers 500 when the user's data can't be loaded", async () => {
    const { deps } = makeDeps({ loadUserData: async () => null });
    const res = await handleLogWorkout(post(workout), deps);
    expect(res.status).toBe(500);
  });

  it("answers 500 without leaking the database error", async () => {
    const { deps } = makeDeps({ saveWorkout: async () => ({ ok: false, message: "boom" }) });
    const res = await handleLogWorkout(post(workout), deps);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/boom/);
  });
});
