// Smoke test for the MCP tools against a running local Supabase with the backend
// functions being served (see backend/README.md).
//
// It signs up a throwaway user, logs one workout through log-workout, then calls
// every tool the way an assistant would and checks the answers.
//
// Run from the mcp-server folder:
//   npx tsx scripts/smoke-test.ts <API_URL> <ANON_KEY>

import { createClient } from "@supabase/supabase-js";
import { connect } from "../src/supabase.ts";
import { createWorkoutPlan, getGoals, getPlan, getProgress, getWeeklySummary, getWorkouts, todayIn, updateWorkoutPlan } from "../src/tools.ts";

const [url, anonKey] = process.argv.slice(2);
if (!url || !anonKey) {
  console.log("usage: npx tsx scripts/smoke-test.ts <API_URL> <ANON_KEY>");
  process.exit(1);
}

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  if (ok) {
    passed++;
    console.log("PASS  " + name);
  } else {
    failed++;
    console.log("FAIL  " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : ""));
  }
}

function nextMonday(from: string): string {
  const d = new Date(from + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

const today = todayIn("America/Los_Angeles");
const email = "mcp-smoke-" + Date.now() + "@example.com";
const password = "smoke-test-pw-123";

// 1. make a throwaway user with one workout, using the app's normal paths
const app = createClient(url, anonKey, { auth: { persistSession: false } });
const signup = await app.auth.signUp({ email: email, password: password });
const userId = signup.data.user?.id;
check("sign up a test user", !signup.error && !!userId, signup.error?.message);
if (!userId) process.exit(1);

const logged = await app.functions.invoke("log-workout", {
  body: { type: "strength", date: today, minutes: 40, exercises: [{ name: "Squats", sets: 3, reps: 10 }] },
});
check("log one workout through log-workout", !logged.error, logged.error?.message);

// 2. sign in the way the MCP server does
const data = await connect({ url: url, anonKey: anonKey, email: email, password: password });
check("MCP server signs in as the user", true);

// 3. both permissions are off for a new user
let r = await getWorkouts(data, {});
check("get_workouts refuses while reading is off", r.isError && /not allowed/.test(r.text), r.text);

const plan = {
  weekStart: nextMonday(today),
  note: "Smoke test plan.",
  items: [
    { day: "mon", workoutType: "strength", minutes: 35, details: "Lower body" },
    { day: "wed", workoutType: "cardio", minutes: 30 },
  ],
};
r = await createWorkoutPlan(data, plan);
check("create_workout_plan refuses while plans are off (403)", r.isError && /Suggest workout plans/.test(r.text), r.text);

// 4. the user turns both on in the app
const on = await app.from("profiles").update({ ai_can_read: true, ai_can_create_plans: true, goal: "be_active", planned_days: ["mon", "wed", "fri"] }).eq("id", userId);
check("user turns on both permissions", !on.error, on.error?.message);

// 5. read tools
r = await getWorkouts(data, {});
let body = r.isError ? null : JSON.parse(r.text);
check("get_workouts returns the workout and its exercise", body?.count === 1 && body.workouts[0].exercises[0].name === "Squats", r.text);

r = await getGoals(data);
body = r.isError ? null : JSON.parse(r.text);
check("get_goals returns goal and planned days", body?.goal === "be_active" && body.plannedDays.length === 3, r.text);

r = await getProgress(data);
body = r.isError ? null : JSON.parse(r.text);
check("get_progress returns XP, level, streak and a badge", body?.totalXp >= 50 && body.level >= 1 && body.streak.current === 1 && body.badges.length >= 1, r.text);

r = await getWeeklySummary(data);
body = r.isError ? null : JSON.parse(r.text);
check(
  "get_weekly_summary counts this week's workout and reads goals",
  body?.thisWeek.workouts === 1 && body.thisWeek.activeDays === 1 && body.streak.current === 1 && Array.isArray(body.goals) && body.plan === null,
  r.text,
);

r = await getPlan(data, {});
body = r.isError ? null : JSON.parse(r.text);
check("get_plan returns no plans yet", body?.count === 0, r.text);

// 6. plan tools
r = await createWorkoutPlan(data, { ...plan, items: [{ day: "mon", workoutType: "cardio", minutes: 180 }] });
check("create_workout_plan passes back why an unsafe plan failed (422)", r.isError && /safety checks/.test(r.text) && /minutes/.test(r.text), r.text);

r = await createWorkoutPlan(data, plan);
body = r.isError ? null : JSON.parse(r.text);
const planId = body?.planId;
check("create_workout_plan saves a suggestion (200)", !!planId && body.status === "suggested", r.text);

r = await updateWorkoutPlan(data, { ...plan, planId: planId, note: "Updated." });
body = r.isError ? null : JSON.parse(r.text);
check("update_workout_plan changes the same plan (200)", body?.planId === planId, r.text);

r = await getPlan(data, { weekStart: plan.weekStart });
body = r.isError ? null : JSON.parse(r.text);
check("get_plan shows the suggestion with 2 items", body?.plans[0]?.status === "suggested" && body.plans[0].items.length === 2 && body.plans[0].note === "Updated.", r.text);

const accepted = await app.from("workout_plans").update({ status: "active" }).eq("id", planId);
check("user accepts the plan in the app", !accepted.error, accepted.error?.message);

r = await updateWorkoutPlan(data, { ...plan, planId: planId });
check("update_workout_plan says to create a new plan once accepted (404)", r.isError && /create_workout_plan/.test(r.text), r.text);

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
