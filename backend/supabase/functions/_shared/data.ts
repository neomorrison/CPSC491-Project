// Functions that load what the gamification engine needs from the database.
// Keeping all the queries here means the edge functions don't have to know table/column names.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import type {
  AchievementDef,
  ChallengeDef,
  Enrollment,
  GoalDef,
  Weekday,
  WorkoutRecord,
} from "./gamification/index.ts";

export interface ProfileRow {
  time_zone: string;
  planned_days: Weekday[];
  ai_can_create_plans: boolean;
}

export async function loadProfile(db: SupabaseClient, userId: string): Promise<ProfileRow> {
  const { data, error } = await db
    .from("profiles")
    .select("time_zone, planned_days, ai_can_create_plans")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("could not load profile: " + error?.message);
  return data as ProfileRow;
}

export async function loadWorkouts(db: SupabaseClient, userId: string): Promise<WorkoutRecord[]> {
  const { data, error } = await db
    .from("workouts")
    .select("id, type, outdoor, workout_date, minutes, started_at, earned_xp, workout_exercises(name, sets, reps, seconds, weight_lb)")
    .eq("user_id", userId)
    .order("workout_date");
  if (error || !data) throw new Error("could not load workouts: " + error?.message);

  // the database uses snake_case, the engine uses camelCase
  const workouts: WorkoutRecord[] = [];
  for (const row of data) {
    const exercises = [];
    for (const e of row.workout_exercises || []) {
      exercises.push({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        seconds: e.seconds,
        weightLb: e.weight_lb === null ? null : Number(e.weight_lb), // numeric columns come back as strings
      });
    }
    workouts.push({
      id: row.id,
      type: row.type,
      outdoor: row.outdoor,
      date: row.workout_date,
      minutes: row.minutes,
      startedAt: row.started_at,
      earnedXp: row.earned_xp,
      exercises: exercises,
    });
  }
  return workouts;
}

export async function loadTotalXp(db: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await db.from("user_progress").select("total_xp").eq("user_id", userId).single();
  if (error || !data) throw new Error("could not load XP total: " + error?.message);
  return data.total_xp;
}

export async function loadAchievements(db: SupabaseClient, userId: string) {
  const all = await db.from("achievements").select("id, name, rule, xp_reward");
  if (all.error || !all.data) throw new Error("could not load achievements: " + all.error?.message);

  const mine = await db.from("user_achievements").select("achievement_id").eq("user_id", userId);
  if (mine.error || !mine.data) throw new Error("could not load user achievements: " + mine.error?.message);

  const defs: AchievementDef[] = [];
  for (const row of all.data) {
    defs.push({ id: row.id, name: row.name, rule: row.rule, xpReward: row.xp_reward });
  }
  const unlocked = new Set<string>();
  for (const row of mine.data) {
    unlocked.add(row.achievement_id);
  }
  return { defs: defs, unlocked: unlocked };
}

export async function loadChallenges(db: SupabaseClient, userId: string) {
  const all = await db
    .from("challenges")
    .select("id, name, period, metric, exercise, target, xp_reward, min_level")
    .eq("active", true);
  if (all.error || !all.data) throw new Error("could not load challenges: " + all.error?.message);

  // only the challenges the user joined and hasn't finished yet
  const joined = await db
    .from("user_challenges")
    .select("challenge_id, period_start, start_date, end_date")
    .eq("user_id", userId)
    .eq("status", "active");
  if (joined.error || !joined.data) throw new Error("could not load user challenges: " + joined.error?.message);

  const defs: ChallengeDef[] = [];
  for (const row of all.data) {
    defs.push({
      id: row.id,
      name: row.name,
      period: row.period,
      metric: row.metric,
      exercise: row.exercise,
      target: row.target,
      xpReward: row.xp_reward,
      minLevel: row.min_level,
    });
  }
  const enrollments: Enrollment[] = [];
  for (const row of joined.data) {
    enrollments.push({
      challengeId: row.challenge_id,
      periodStart: row.period_start,
      startDate: row.start_date,
      endDate: row.end_date,
    });
  }
  return { defs: defs, enrollments: enrollments };
}

export async function loadGoals(db: SupabaseClient, userId: string) {
  const active = await db
    .from("goals")
    .select("id, type, target, start_date")
    .eq("user_id", userId)
    .eq("status", "active");
  if (active.error || !active.data) throw new Error("could not load goals: " + active.error?.message);

  const paid = await db.from("goal_completions").select("goal_type, week_start").eq("user_id", userId);
  if (paid.error || !paid.data) throw new Error("could not load goal completions: " + paid.error?.message);

  const goals: GoalDef[] = [];
  for (const row of active.data) {
    goals.push({ id: row.id, type: row.type, target: row.target, startDate: row.start_date });
  }
  const done = new Set<string>();
  for (const row of paid.data) {
    done.add(row.goal_type + "|" + row.week_start);
  }
  return { goals: goals, done: done };
}

// one workout, only if it belongs to this user (returns null if not)
export async function loadWorkout(db: SupabaseClient, userId: string, workoutId: string) {
  const { data, error } = await db
    .from("workouts")
    .select("id, workout_date, minutes")
    .eq("id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("could not load workout: " + error.message);
  return data;
}

// how much XP a workout earned (base + streak bonus), after any earlier edits
export async function loadWorkoutXp(db: SupabaseClient, workoutId: string): Promise<number> {
  const { data, error } = await db.from("xp_events").select("amount").eq("workout_id", workoutId);
  if (error || !data) throw new Error("could not load workout XP: " + error?.message);
  let total = 0;
  for (const row of data) total += row.amount;
  return total;
}
