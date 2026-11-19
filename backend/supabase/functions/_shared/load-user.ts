// Loads a UserData for log-workout and edit-workout. It reads with the user's own
// token, so the database security rules (RLS) make sure we only get their rows.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  loadAchievements,
  loadChallenges,
  loadGoals,
  loadProfile,
  loadTotalXp,
  loadWorkouts,
  loadWorkoutXp,
} from "./data.ts";
import type { UserData } from "./user-data.ts";

// leaveOut is the workout being edited or deleted, so it isn't counted twice.
// Its XP gets taken back in the database, so we take it off the total here too.
export async function loadUserData(db: SupabaseClient, userId: string, leaveOut?: string): Promise<UserData | null> {
  try {
    const [profile, workouts, totalXp, achievements, challenges, goals, streak] = await Promise.all([
      loadProfile(db, userId),
      loadWorkouts(db, userId),
      loadTotalXp(db, userId),
      loadAchievements(db, userId),
      loadChallenges(db, userId),
      loadGoals(db, userId),
      db.from("streaks").select("current_streak, best_streak").eq("user_id", userId).maybeSingle(),
    ]);
    if (streak.error) throw new Error(streak.error.message);

    let xp = totalXp;
    if (leaveOut) xp -= await loadWorkoutXp(db, leaveOut);

    return {
      timeZone: profile.time_zone,
      plannedDays: profile.planned_days ?? [],
      history: workouts.filter((w) => w.id !== leaveOut),
      totalXp: xp,
      bestStreak: streak.data?.best_streak ?? 0,
      currentStreak: streak.data?.current_streak ?? 0,
      achievementDefs: achievements.defs,
      unlockedAchievements: [...achievements.unlocked],
      challengeDefs: challenges.defs,
      enrollments: challenges.enrollments,
      goals: goals.goals,
      goalsDone: [...goals.done],
    };
  } catch (err) {
    console.error("could not load user data: " + String(err));
    return null;
  }
}
