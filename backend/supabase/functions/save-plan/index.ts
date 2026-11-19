// POST /functions/v1/save-plan
// The MCP server calls this when the AI assistant makes (or changes) a weekly workout plan.
// We run the safety checks and save it as a "suggested" plan. The user then accepts, edits,
// or dismisses it in the app, so the AI can never change someone's schedule by itself.
//
// Body: { planId?, weekStart: "YYYY-MM-DD" (Monday), note?, items: [{ day, workoutType, minutes, details? }] }
// Send planId to replace a plan the assistant already suggested.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { loadProfile } from "../_shared/data.ts";
import { todayIn, validatePlan } from "../_shared/gamification/index.ts";
import { adminClient, json, preflight, readJson, requireUser } from "../_shared/http.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;

  const user = await requireUser(req);
  if (user instanceof Response) return user;

  try {
    const db = adminClient();
    const profile = await loadProfile(db, user.id);

    // the user has to turn this on in their settings first
    if (!profile.ai_can_create_plans) {
      return json(403, {
        error: "The user hasn't allowed their assistant to create plans. They can turn it on under Profile > AI assistant.",
      });
    }

    // deno-lint-ignore no-explicit-any
    const body: any = await readJson(req);
    let planId = null;
    if (body && body.planId != null) {
      planId = body.planId;
      if (typeof planId !== "string" || !UUID_REGEX.test(planId)) {
        return json(400, { error: "planId must be a plan id" });
      }
    }

    const check = validatePlan(body, todayIn(profile.time_zone));
    if (!check.ok) {
      return json(422, { error: "plan didn't pass the safety checks", details: check.errors });
    }

    const { data: savedId, error } = await db.rpc("save_assistant_plan", {
      p_user: user.id,
      p_plan_id: planId,
      p_week_start: check.plan.weekStart,
      p_note: check.plan.note,
      p_items: check.plan.items,
    });
    // P0002 is the error code save_assistant_plan raises when it can't find the plan
    if (error && error.code === "P0002") {
      return json(404, { error: "That plan doesn't exist or the user already accepted or dismissed it." });
    }
    if (error) throw new Error(error.message);

    return json(200, {
      planId: savedId,
      status: "suggested",
      message: "Saved. The user will see it in the app and can accept, edit, or dismiss it.",
    });
  } catch (err) {
    console.error("save-plan failed", err);
    return json(500, { error: "couldn't save the plan, try again" });
  }
});
