// The real FitnessData: signs in to Supabase as the user and reads their data.
//
// Login design: the server signs in with the user's own app email and password,
// which they put in the .env file on their own computer. That means:
// - every query runs as that user, so the database security rules (RLS) still apply
// - there is no service role key anywhere in this project
// - the assistant never sees the password, only what the tools return

import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import type { FitnessData, SavePlanAnswer } from "./data.ts";

export interface Settings {
  url: string;
  anonKey: string;
  email: string;
  password: string;
}

// reads the settings, or throws an error that says exactly what is missing
export function readSettings(env: Record<string, string | undefined>): Settings {
  const missing: string[] = [];
  for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "FITNESS_EMAIL", "FITNESS_PASSWORD"]) {
    if (!env[name]) missing.push(name);
  }
  if (missing.length > 0) {
    throw new Error("Missing settings: " + missing.join(", ") + ". Copy .env.example to .env and fill it in.");
  }
  return {
    url: env.SUPABASE_URL!,
    anonKey: env.SUPABASE_ANON_KEY!,
    email: env.FITNESS_EMAIL!,
    password: env.FITNESS_PASSWORD!,
  };
}

// signs in and returns a FitnessData for that user
export async function connect(settings: Settings): Promise<FitnessData> {
  const db = createClient(settings.url, settings.anonKey, {
    // keep the session in memory only. supabase-js refreshes the token by itself.
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { data, error } = await db.auth.signInWithPassword({ email: settings.email, password: settings.password });
  if (error || !data.user) {
    throw new Error("Could not sign in to the fitness app: " + (error?.message ?? "no user returned"));
  }
  return supabaseData(db, data.user.id);
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function supabaseData(db: SupabaseClient, userId: string): FitnessData {
  return {
    async getProfile() {
      return check(
        await db
          .from("profiles")
          .select(
            "display_name, goal, planned_days, preferred_time, session_minutes, experience, time_zone, ai_can_read, ai_can_create_plans",
          )
          .eq("id", userId)
          .maybeSingle(),
      );
    },

    async getWorkouts(from, to) {
      return (
        check(
          await db
            .from("workouts")
            .select(
              "workout_date, type, minutes, started_at, effort, notes, earned_xp, workout_exercises (name, sets, reps, seconds, weight_lb)",
            )
            .eq("user_id", userId)
            .gte("workout_date", from)
            .lte("workout_date", to)
            .order("workout_date", { ascending: false })
            .limit(500),
        ) ?? []
      );
    },

    async getProgress() {
      return check(await db.from("user_progress").select("total_xp, level").eq("user_id", userId).maybeSingle());
    },

    async getStreak() {
      return check(
        await db
          .from("streaks")
          .select("current_streak, best_streak, freezes_left, at_risk")
          .eq("user_id", userId)
          .maybeSingle(),
      );
    },

    async getBadges() {
      const rows =
        check(
          await db
            .from("user_achievements")
            .select("achievement_id, unlocked_at, achievements (name)")
            .eq("user_id", userId)
            .order("unlocked_at", { ascending: true }),
        ) ?? [];
      return rows.map((r: any) => {
        // the joined row can come back as an object or a one item list
        const a = Array.isArray(r.achievements) ? r.achievements[0] : r.achievements;
        return { achievement_id: r.achievement_id, name: a?.name ?? r.achievement_id, unlocked_at: r.unlocked_at };
      });
    },

    async getPlans(weekStart) {
      let query = db
        .from("workout_plans")
        .select("id, week_start, status, created_by, note, plan_items (day, workout_type, minutes, details)")
        .eq("user_id", userId);
      if (weekStart) query = query.eq("week_start", weekStart);
      return check(await query.order("week_start", { ascending: false }).order("updated_at", { ascending: false }).limit(5)) ?? [];
    },

    async savePlan(body): Promise<SavePlanAnswer> {
      const { data, error } = await db.functions.invoke("save-plan", { body: body as Record<string, unknown> });
      if (!error) return { status: 200, body: data };

      // a 4xx or 5xx answer comes back as FunctionsHttpError with the real response inside
      if (error instanceof FunctionsHttpError) {
        const response = error.context as Response;
        let parsed = null;
        try {
          parsed = await response.json();
        } catch (_err) {
          parsed = null;
        }
        return { status: response.status, body: parsed };
      }
      throw error;
    },
  };
}
