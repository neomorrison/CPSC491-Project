// Stuff every edge function needs: CORS headers, sending JSON back, and Supabase clients.

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// browsers send an OPTIONS request first (CORS preflight). we also only allow POST.
// returns a response if we should stop here, otherwise null
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "use POST" });
  }
  return null;
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error("missing environment variable " + name);
  }
  return value;
}

// client with full access (service role key). only use this on the server, never in the app!
export function adminClient(): SupabaseClient {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

// figures out who is signed in from the Authorization header.
// returns the user, or a 401 response if they aren't signed in
export async function requireUser(req: Request): Promise<User | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, { error: "sign in first" });
  }

  const client = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return json(401, { error: "sign in first" });
  }
  return data.user;
}

// returns null instead of throwing if the body isn't valid JSON
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
