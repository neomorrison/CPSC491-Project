// The logic for save-plan, kept apart from the Deno setup in index.ts so the
// tests can run it with fake database calls.
//
// What it answers:
//   200 { planId, status: "suggested" }   saved. The user accepts or dismisses it in the app.
//   401 not signed in
//   403 the user hasn't turned on "Suggest workout plans"
//   404 that plan was already accepted or dismissed (make a new one instead)
//   422 { error, details }                the plan failed the safety checks. details says why.

import { todayIn } from "../_shared/gamification/dates.ts";
import { validatePlan, type PlanInput } from "../_shared/gamification/plans.ts";
import { CORS_HEADERS, errorResponse, json, readJson } from "../_shared/http.ts";

export interface PlanProfile {
  ai_can_create_plans: boolean;
  time_zone: string;
}

export type SaveResult =
  | { ok: true; planId: string }
  | { ok: false; notFound: boolean; message: string };

// The database calls the handler needs. index.ts passes in the real ones.
export interface SavePlanDeps {
  // the signed-in user's id, or null if the token is missing or bad
  getUserId(authHeader: string): Promise<string | null>;
  // the user's own profile row, read with their token
  getProfile(authHeader: string, userId: string): Promise<PlanProfile | null>;
  // calls save_assistant_plan. planId is null for a new plan.
  savePlan(userId: string, planId: string | null, plan: PlanInput): Promise<SaveResult>;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleSavePlan(req: Request, deps: SavePlanDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "use POST");
  }

  // who is asking
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return errorResponse(401, "not signed in");
  }
  const userId = await deps.getUserId(authHeader);
  if (!userId) {
    return errorResponse(401, "not signed in");
  }

  // has the user allowed the assistant to suggest plans
  const profile = await deps.getProfile(authHeader, userId);
  if (!profile) {
    return errorResponse(403, "profile not found");
  }
  if (!profile.ai_can_create_plans) {
    return errorResponse(
      403,
      'The user has not turned on "Suggest workout plans". Ask them to enable it in the app settings.',
    );
  }

  // deno-lint-ignore no-explicit-any
  const body = (await readJson(req)) as any;
  if (typeof body !== "object" || body === null) {
    return errorResponse(422, "plan failed the checks", ["body must be a JSON object"]);
  }

  // planId is only there when the assistant is changing a plan it suggested before
  let planId: string | null = null;
  if (body.planId != null) {
    if (typeof body.planId !== "string" || !UUID.test(body.planId)) {
      return errorResponse(422, "plan failed the checks", ["planId must be a plan id from create_workout_plan"]);
    }
    planId = body.planId;
  }

  // safety checks. "today" is the user's today, not the server's.
  const now = deps.now ? deps.now() : new Date();
  const check = validatePlan(body, todayIn(profile.time_zone, now));
  if (!check.ok) {
    return errorResponse(422, "plan failed the checks", check.errors);
  }

  const saved = await deps.savePlan(userId, planId, check.plan);
  if (!saved.ok) {
    if (saved.notFound) {
      return errorResponse(404, "That plan was already accepted or dismissed. Create a new plan instead.");
    }
    console.error("save-plan failed: " + saved.message);
    return errorResponse(500, "could not save the plan");
  }

  return json(200, { planId: saved.planId, status: "suggested" });
}
