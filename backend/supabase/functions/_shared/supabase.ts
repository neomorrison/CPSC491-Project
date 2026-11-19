// Supabase clients for the edge functions.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set automatically
// by Supabase (locally and when deployed), so they don't go in the .env file.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("missing environment variable " + name);
  return value;
}

// Acts as the signed-in user. The database security rules (RLS) still apply,
// so this client can only see that user's rows.
export function userClient(authHeader: string): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Skips the security rules. Only use it for the server-only database functions
// (save_workout_result, save_assistant_plan, set_streak, expire_challenges) and the
// admin API, and only after checking who the user is.
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// the signed-in user's id from their login token, or null if the token is missing or bad
export async function userIdFromToken(authHeader: string): Promise<string | null> {
  const { data, error } = await userClient(authHeader).auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
