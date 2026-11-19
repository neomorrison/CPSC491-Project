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

const fiveDayPlan = {
  weekStart: "2026-11-09",
  items: ["mon", "tue", "wed", "thu", "fri"].map((day) => ({ day, workoutType: "cardio", minutes: 30 })),
};

// fake database calls. each test changes only the part it cares about.
function makeDeps(changes: Partial<SavePlanDeps> = {}) {
  const calls: { userId: string; planId: string | null }[] = [];
  const deps: SavePlanDeps = {
    getUserId: async () => "user-1",
    getProfile: async () => ({ ai_can_create_plans: true, time_zone: "America/Los_Angeles", experience: "some" }),
    countNewPlansSince: async () => 0,
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

  it("answers 422 when a plan has too many sessions for a beginner", async () => {
    const { deps, calls } = makeDeps({
      getProfile: async () => ({ ai_can_create_plans: true, time_zone: "America/Los_Angeles", experience: "beginner" }),
    });
    const res = await handleSavePlan(post(fiveDayPlan), deps);
    expect(res.status).toBe(422);
    expect((await res.json()).details.join()).toMatch(/too many sessions for a beginner/);
    expect(calls.length).toBe(0);
  });

  it("allows the same plan for someone with some experience", async () => {
    const { deps } = makeDeps();
    const res = await handleSavePlan(post(fiveDayPlan), deps);
    expect(res.status).toBe(200);
  });

  it("treats a user with no experience level as a beginner", async () => {
    const { deps } = makeDeps({
      getProfile: async () => ({ ai_can_create_plans: true, time_zone: "America/Los_Angeles", experience: null }),
    });
    const res = await handleSavePlan(post(fiveDayPlan), deps);
    expect(res.status).toBe(422);
  });

  it("answers 429 after too many new plans in a week", async () => {
    const { deps, calls } = makeDeps({ countNewPlansSince: async () => 5 });
    const res = await handleSavePlan(post(goodPlan), deps);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/at most 5 new plans/);
    expect(calls.length).toBe(0);
  });

  it("still allows updating a suggested plan when over the limit", async () => {
    const { deps, calls } = makeDeps({ countNewPlansSince: async () => 99 });
    const res = await handleSavePlan(post({ ...goodPlan, planId: PLAN_ID }), deps);
    expect(res.status).toBe(200);
    expect(calls.length).toBe(1);
  });

  it("counts new plans from 7 days before now", async () => {
    let since = "";
    const { deps } = makeDeps({
      countNewPlansSince: async (_auth, _user, sinceIso) => {
        since = sinceIso;
        return 0;
      },
    });
    await handleSavePlan(post(goodPlan), deps);
    expect(since).toBe("2026-10-28T20:00:00.000Z");
  });
});
