import { describe, expect, it } from "vitest";
import { changeNote, type EditWorkoutDeps, handleEditWorkout } from "../supabase/functions/edit-workout/handler.ts";
import type { UserData } from "../supabase/functions/_shared/user-data.ts";
import type { WorkoutInput, WorkoutResult } from "../supabase/functions/_shared/gamification/index.ts";

const ID = "0b9d6c1e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";

function userData(changes: Partial<UserData> = {}): UserData {
  return {
    timeZone: "America/Los_Angeles",
    plannedDays: ["mon", "wed", "fri"],
    history: [],
    totalXp: 25,
    bestStreak: 1,
    currentStreak: 1,
    achievementDefs: [],
    unlockedAchievements: ["first_workout"],
    challengeDefs: [],
    enrollments: [],
    goals: [],
    goalsDone: [],
    ...changes,
  };
}

// fake database calls. the saved total starts at 80 (25 onboarding + 55 for the workout)
function makeDeps(changes: Partial<EditWorkoutDeps> = {}) {
  const saves: { mode: string; workout: WorkoutInput | null; result: WorkoutResult }[] = [];
  let total = 80;
  const deps: EditWorkoutDeps = {
    getUserId: async () => "user-1",
    getWorkoutDate: async () => "2026-11-02",
    loadUserData: async () => userData(),
    getTotalXp: async () => total,
    saveChange: async (_userId, _id, workout, result) => {
      saves.push({ mode: workout ? "edit" : "delete", workout, result });
      total = 25 + result.xpGained; // the database takes back the old 55 and adds the new rows
      return { ok: true };
    },
    now: () => new Date("2026-11-02T20:00:00Z"), // Monday Nov 2, noon in Los Angeles
    ...changes,
  };
  return { deps, saves };
}

function post(body: unknown, token: string | null = "Bearer abc") {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = token;
  return new Request("http://localhost/edit-workout", { method: "POST", headers: headers, body: JSON.stringify(body) });
}

describe("edit-workout", () => {
  it("answers 401 without a login", async () => {
    const { deps } = makeDeps();
    expect((await handleEditWorkout(post({ workoutId: ID, delete: true }, null), deps)).status).toBe(401);
  });

  it("answers 422 for a bad workout id", async () => {
    const { deps } = makeDeps();
    expect((await handleEditWorkout(post({ workoutId: "nope", delete: true }), deps)).status).toBe(422);
  });

  it("answers 404 for a workout that isn't the user's", async () => {
    const { deps, saves } = makeDeps({ getWorkoutDate: async () => null });
    expect((await handleEditWorkout(post({ workoutId: ID, delete: true }), deps)).status).toBe(404);
    expect(saves.length).toBe(0);
  });

  it("answers 404 when the database says the workout is gone", async () => {
    const { deps } = makeDeps({ saveChange: async () => ({ ok: false, notFound: true, message: "P0002" }) });
    expect((await handleEditWorkout(post({ workoutId: ID, delete: true }), deps)).status).toBe(404);
  });

  it("shortening a workout below 10 minutes takes its XP back", async () => {
    const { deps, saves } = makeDeps();
    const res = await handleEditWorkout(post({ workoutId: ID, type: "cardio", date: "2026-11-02", minutes: 8 }), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(saves[0].mode).toBe("edit");
    expect(body.deleted).toBe(false);
    expect(body.xpChange).toBe(-55);
    expect(body.note).toBe("You lost 55 XP. Your streak went from 1 to 0 days.");
  });

  it("an edit can't move a workout to an old date", async () => {
    const { deps } = makeDeps();
    const res = await handleEditWorkout(post({ workoutId: ID, type: "cardio", date: "2026-10-01", minutes: 30 }), deps);
    expect(res.status).toBe(422);
  });

  it("deleting keeps the best streak", async () => {
    const { deps, saves } = makeDeps({ loadUserData: async () => userData({ bestStreak: 9 }) });
    const body = await (await handleEditWorkout(post({ workoutId: ID, delete: true }), deps)).json();
    expect(saves[0].mode).toBe("delete");
    expect(body.deleted).toBe(true);
    expect(body.streak.best).toBe(9);
  });

  it("writes a short note about what changed", () => {
    expect(changeNote(0, 3, 3)).toBe("Saved. Your XP and streak didn't change.");
    expect(changeNote(20, 3, 4)).toBe("You gained 20 XP. Your streak went from 3 to 4 days.");
  });
});
