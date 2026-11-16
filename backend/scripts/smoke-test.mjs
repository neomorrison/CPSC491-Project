// Smoke test for the edge functions against a running local Supabase.
// It signs up a throwaway user, then calls log-workout, save-plan and daily-streaks
// and checks each response.
//
// Run from the backend folder (Node 18 or newer):
//   node scripts/smoke-test.mjs <API_URL> <ANON_KEY> <CRON_SECRET>
// `npx supabase status` prints the API URL and the anon (publishable) key.

const [url, anonKey, cronSecret] = process.argv.slice(2);
if (!url || !anonKey || !cronSecret) {
  console.log("usage: node scripts/smoke-test.mjs <API_URL> <ANON_KEY> <CRON_SECRET>");
  process.exit(1);
}

let passed = 0;
let failed = 0;
function check(name, ok, extra) {
  if (ok) {
    passed++;
    console.log("PASS  " + name);
  } else {
    failed++;
    console.log("FAIL  " + name + (extra ? "  -> " + JSON.stringify(extra) : ""));
  }
}

async function call(path, options = {}) {
  const headers = { apikey: anonKey, "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.token) headers.Authorization = "Bearer " + options.token;
  const res = await fetch(url + path, {
    method: options.method || "POST",
    headers: headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_err) {
    body = text;
  }
  return { status: res.status, body: body };
}

// dates in the default profile time zone
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
function nextMonday(from) {
  const d = new Date(from + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 is Sunday
  d.setUTCDate(d.getUTCDate() + ((8 - day) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const weekStart = nextMonday(today);

// 1. sign up a throwaway user
const email = "smoke-" + Date.now() + "@example.com";
const signup = await call("/auth/v1/signup", { body: { email: email, password: "smoke-test-pw-123" } });
const token = signup.body && signup.body.access_token;
const userId = signup.body && signup.body.user && signup.body.user.id;
check("sign up a test user", signup.status === 200 && !!token, signup);
if (!token) {
  console.log("Can't continue without a login token.");
  process.exit(1);
}

// 2. log-workout
const workout = { type: "cardio", date: today, minutes: 30, exercises: [{ name: "Squats", sets: 5, reps: 10 }] };

let r = await call("/functions/v1/log-workout", { body: workout });
check("log-workout: 401 without a token", r.status === 401, r);

r = await call("/functions/v1/log-workout", { token: token, body: { type: "swimming", date: today, minutes: 0 } });
check("log-workout: 422 for a bad workout, with details", r.status === 422 && Array.isArray(r.body.details), r);

r = await call("/functions/v1/log-workout", { token: token, body: workout });
check("log-workout: 200 for a good workout", r.status === 200 && !!r.body.workoutId, r);
const logged = r.body || {};
check("log-workout: earned XP", logged.earnedXp === true && logged.xpGained >= 50, logged);
check("log-workout: streak is 1", logged.streak && logged.streak.current === 1, logged.streak);
check("log-workout: unlocked first_workout", (logged.newAchievements || []).includes("first_workout"), logged.newAchievements);

r = await call("/rest/v1/workouts?select=id,minutes,earned_xp,workout_exercises(name)", { method: "GET", token: token });
check("database: the workout and its exercise were saved", r.status === 200 && r.body.length === 1 && r.body[0].workout_exercises.length === 1, r);

r = await call("/rest/v1/user_progress?select=total_xp,level", { method: "GET", token: token });
check("database: total XP matches what log-workout said", r.status === 200 && r.body[0] && r.body[0].total_xp === logged.totalXp, r);

r = await call("/rest/v1/streaks?select=current_streak,last_checked", { method: "GET", token: token });
check("database: streak row was updated", r.status === 200 && r.body[0] && r.body[0].current_streak === 1 && r.body[0].last_checked === today, r);

// 3. save-plan
const plan = {
  weekStart: weekStart,
  note: "Smoke test plan.",
  items: [
    { day: "mon", workoutType: "strength", minutes: 35, details: "Lower body" },
    { day: "wed", workoutType: "cardio", minutes: 30 },
  ],
};

r = await call("/functions/v1/save-plan", { body: plan });
check("save-plan: 401 without a token", r.status === 401, r);

r = await call("/functions/v1/save-plan", { token: token, body: plan });
check("save-plan: 403 while the permission is off", r.status === 403, r);

r = await call("/rest/v1/profiles?id=eq." + userId, {
  method: "PATCH",
  token: token,
  headers: { Prefer: "return=minimal" },
  body: { ai_can_create_plans: true },
});
check("turn on 'Suggest workout plans' for the test user", r.status === 204, r);

r = await call("/functions/v1/save-plan", {
  token: token,
  body: { ...plan, items: [{ day: "mon", workoutType: "cardio", minutes: 180 }] },
});
check("save-plan: 422 for an unsafe plan, with details", r.status === 422 && Array.isArray(r.body.details), r);

r = await call("/functions/v1/save-plan", { token: token, body: plan });
check("save-plan: 200 for a good plan", r.status === 200 && r.body.status === "suggested" && !!r.body.planId, r);
const planId = r.body && r.body.planId;

r = await call("/functions/v1/save-plan", { token: token, body: { ...plan, planId: planId, note: "Updated." } });
check("save-plan: 200 when updating the same plan", r.status === 200 && r.body.planId === planId, r);

r = await call("/rest/v1/plan_items?select=day&plan_id=eq." + planId, { method: "GET", token: token });
check("database: the plan has 2 items", r.status === 200 && r.body.length === 2, r);

r = await call("/rest/v1/workout_plans?id=eq." + planId, {
  method: "PATCH",
  token: token,
  headers: { Prefer: "return=minimal" },
  body: { status: "active" },
});
check("accept the plan as the user", r.status === 204, r);

r = await call("/functions/v1/save-plan", { token: token, body: { ...plan, planId: planId } });
check("save-plan: 404 once the plan was accepted", r.status === 404, r);

// 4. daily-streaks
r = await call("/functions/v1/daily-streaks", { headers: { "x-cron-secret": "wrong" } });
check("daily-streaks: 401 with the wrong secret", r.status === 401, r);

r = await call("/functions/v1/daily-streaks", { headers: { "x-cron-secret": cronSecret } });
check(
  "daily-streaks: 200 with the right secret",
  r.status === 200 && r.body.failed === 0 && r.body.checked + r.body.skipped >= 1,
  r,
);

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
