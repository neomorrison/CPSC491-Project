// save-plan: saves a workout plan suggested by the user's AI assistant.
// The MCP server calls this with the user's own login token:
//   supabase.functions.invoke("save-plan", { body: { weekStart, note, items, planId? } })
// The checks and responses are in handler.ts. This file only connects it to the database.

import { adminClient, userClient } from "../_shared/supabase.ts";
import { handleSavePlan, type SavePlanDeps } from "./handler.ts";

const deps: SavePlanDeps = {
  async getUserId(authHeader) {
    const { data, error } = await userClient(authHeader).auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  },

  async getProfile(authHeader, userId) {
    const { data, error } = await userClient(authHeader)
      .from("profiles")
      .select("ai_can_create_plans, time_zone, experience")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  },

  async countNewPlansSince(authHeader, userId, sinceIso) {
    // read with the user's own token, so RLS only lets us count their plans
    const { count, error } = await userClient(authHeader)
      .from("workout_plans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("created_by", "assistant")
      .gte("created_at", sinceIso);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async savePlan(userId, planId, plan) {
    // save_assistant_plan is server-only, so this one call uses the service role key.
    // We pass the user id we got from their token, never one from the request body.
    const { data, error } = await adminClient().rpc("save_assistant_plan", {
      p_user: userId,
      p_plan_id: planId,
      p_week_start: plan.weekStart,
      p_note: plan.note ?? null,
      p_items: plan.items,
    });
    if (error) {
      // P0002 is what the database function raises when the plan isn't a suggestion any more
      return { ok: false, notFound: error.code === "P0002", message: error.message };
    }
    return { ok: true, planId: data as string };
  },
};

Deno.serve((req) => handleSavePlan(req, deps));
