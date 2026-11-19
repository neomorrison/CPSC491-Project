// A fake FitnessData for the tests. Each test changes only the part it cares about.

import type { FitnessData, Profile, SavePlanAnswer } from "../src/data.ts";

export function profile(changes: Partial<Profile> = {}): Profile {
  return {
    display_name: "Sam",
    goal: "be_active",
    planned_days: ["mon", "wed", "fri"],
    preferred_time: "evening",
    session_minutes: 30,
    experience: "beginner",
    time_zone: "America/Los_Angeles",
    ai_can_read: true,
    ai_can_create_plans: true,
    ...changes,
  };
}

export interface Fake extends FitnessData {
  calls: { workouts: { from: string; to: string }[]; plans: (string | null)[]; saved: unknown[] };
}

export function fakeData(changes: Partial<FitnessData> = {}, saveAnswer?: SavePlanAnswer): Fake {
  const calls: Fake["calls"] = { workouts: [], plans: [], saved: [] };
  return {
    calls: calls,
    getProfile: async () => profile(),
    getWorkouts: async (from, to) => {
      calls.workouts.push({ from, to });
      return [
        {
          workout_date: "2026-11-02",
          type: "strength",
          minutes: 40,
          started_at: "07:30:00",
          effort: "just_right",
          notes: null,
          earned_xp: true,
          workout_exercises: [{ name: "Squats", sets: 3, reps: 10, seconds: null, weight_lb: 95 }],
        },
      ];
    },
    getProgress: async () => ({ total_xp: 320, level: 3 }),
    getStreak: async () => ({ current_streak: 4, best_streak: 9, freezes_left: 1, at_risk: false }),
    getBadges: async () => [{ achievement_id: "first_workout", name: "First Step", unlocked_at: "2026-10-01T10:00:00Z" }],
    getPlans: async (weekStart) => {
      calls.plans.push(weekStart);
      return [
        {
          id: "11111111-2222-4333-8444-555555555555",
          week_start: "2026-11-09",
          status: "suggested",
          created_by: "assistant",
          note: "Easy week.",
          plan_items: [{ day: "mon", workout_type: "cardio", minutes: 30, details: null }],
        },
      ];
    },
    savePlan: async (body) => {
      calls.saved.push(body);
      return saveAnswer ?? { status: 200, body: { planId: "11111111-2222-4333-8444-555555555555", status: "suggested" } };
    },
    ...changes,
  };
}
