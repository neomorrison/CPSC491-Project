import { describe, expect, it } from "vitest";
import { handleSavePlan, type SavePlanDeps } from "../supabase/functions/save-plan/handler.ts";

const PLAN_ID = "11111111-2222-4333-8444-555555555555";

const goodPlan = {
  weekStart: "2026-11-09",
  note: "Four days this week.",
  items: [
    { day: "mon", workoutType: "strength", minutes: 35, details: "Lower body" },
    { day: "wed", workoutType: "cardio", minutes: 30 },
  ],
};

// fake database calls. each test changes only the part it cares about.
function makeDeps(changes: Partial<SavePlanDeps> = {}) {
  const calls: { userId: string; planId: string | null }[] = [];
  const deps: SavePlanDeps = {
    getUserId: async () => "user-1",
    getProfile: async () => ({ ai_can_create_plans: true, time_zone: "America/Los_Angeles" }),
    savePlan: async (userId, planId) => {
      calls.push({ userId, planId });
      return { ok: true, planId: planId ?? PLAN_ID };
    },
    now: () => new Date("2026-11-04T20:00:00Z"), // a Wednesday
    ...changes,
  };
  return { deps, calls };
}

function post(body: unknown, token: string | null = "Bearer abc") {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = token;
  return new Request("http://localhost/save-plan", {
    method: "POST",
    headers: headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("save-plan", () => {
  it("saves a good plan as suggested", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleSavePlan(post(goodPlan), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ planId: PLAN_ID, status: "suggested" });
    expect(calls).toEqual([{ userId: "user-1", planId: null }]);
  });

  it("passes planId through when updating", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleSavePlan(post({ ...goodPlan, planId: PLAN_ID }), deps);
    expect(res.status).toBe(200);
    expect(calls[0].planId).toBe(PLAN_ID);
  });

  it("answers 401 with no token", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleSavePlan(post(goodPlan, null), deps);
    expect(res.status).toBe(401);
    expect(calls.length).toBe(0);
  });

  it("answers 401 with a bad token", async () => {
    const { deps } = makeDeps({ getUserId: async () => null });
    const res = await handleSavePlan(post(goodPlan), deps);
    expect(res.status).toBe(401);
  });

  it("answers 403 when the user hasn't allowed plans", async () => {
    const { deps, calls } = makeDeps({
      getProfile: async () => ({ ai_can_create_plans: false, time_zone: "America/Los_Angeles" }),
    });
    const res = await handleSavePlan(post(goodPlan), deps);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Suggest workout plans/);
    expect(calls.length).toBe(0);
  });

  it("answers 422 with the reasons when a plan is unsafe", async () => {
    const { deps, calls } = makeDeps();
    const bad = { ...goodPlan, items: [{ day: "mon", workoutType: "cardio", minutes: 180 }] };
    const res = await handleSavePlan(post(bad), deps);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.details.join()).toMatch(/minutes must be 10 to 120/);
    expect(calls.length).toBe(0);
  });

  it("answers 422 for a body that isn't JSON", async () => {
    const { deps } = makeDeps();
    const res = await handleSavePlan(post("not json"), deps);
    expect(res.status).toBe(422);
  });

  it("answers 422 for a planId that isn't an id", async () => {
    const { deps } = makeDeps();
    const res = await handleSavePlan(post({ ...goodPlan, planId: "abc" }), deps);
    expect(res.status).toBe(422);
  });

  it("answers 404 when the plan was already accepted or dismissed", async () => {
    const { deps } = makeDeps({
      savePlan: async () => ({ ok: false, notFound: true, message: "plan not found" }),
    });
    const res = await handleSavePlan(post({ ...goodPlan, planId: PLAN_ID }), deps);
    expect(res.status).toBe(404);
  });

  it("answers 500 for other database errors", async () => {
    const { deps } = makeDeps({
      savePlan: async () => ({ ok: false, notFound: false, message: "boom" }),
    });
    const res = await handleSavePlan(post(goodPlan), deps);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/boom/);
  });

  it("uses the user's time zone for today", async () => {
    // 2026-11-16 06:00 UTC is still Sunday Nov 15 in Los Angeles, so the week of Nov 9 is the current week there
    const { deps } = makeDeps({ now: () => new Date("2026-11-16T06:00:00Z") });
    const res = await handleSavePlan(post(goodPlan), deps);
    expect(res.status).toBe(200);
  });

  it("answers the CORS preflight", async () => {
    const { deps } = makeDeps();
    const res = await handleSavePlan(new Request("http://localhost/save-plan", { method: "OPTIONS" }), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
