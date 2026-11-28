// What each tool does. No MCP or Supabase code in here, so it's easy to unit test.
//
// Rules from the README:
// - The assistant can read (and give feedback on what it reads), and it can suggest plans. That's all. There is no tool that
//   logs workouts, gives XP, changes streaks, or deletes anything.
// - Reading and creating plans are separate permissions the user turns on in the app.
//   Read tools check ai_can_read here. Plan tools are checked by the save-plan function.

import type { FitnessData, Profile } from "./data.ts";

export interface ToolResult {
  text: string;
  isError: boolean;
}

function ok(data: unknown): ToolResult {
  return { text: JSON.stringify(data, null, 2), isError: false };
}

function fail(message: string): ToolResult {
  return { text: message, isError: true };
}

const READ_OFF =
  "The user has not allowed AI assistants to read their fitness data. " +
  "Ask them to turn that on in the app's AI Assistant settings, then try again.";

const PLANS_OFF =
  'The user has not turned on "Suggest workout plans". ' +
  "Ask them to enable it in the app's AI Assistant settings, then try again.";

// every read tool starts with this. returns the profile, or the error to send back.
async function readableProfile(data: FitnessData): Promise<Profile | ToolResult> {
  const profile = await data.getProfile();
  if (!profile) return fail("Could not find this user's profile. They may need to sign in to the app first.");
  if (!profile.ai_can_read) return fail(READ_OFF);
  return profile;
}

function isError(x: Profile | ToolResult): x is ToolResult {
  return (x as ToolResult).isError !== undefined;
}

export function isDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// today's date in a time zone, as YYYY-MM-DD
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: timeZone });
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

// get_workouts: the user's logged workouts with their exercises.
// from and to are optional. Without them you get the last 30 days.
export async function getWorkouts(
  data: FitnessData,
  args: { from?: string; to?: string },
  now: Date = new Date(),
): Promise<ToolResult> {
  const profile = await readableProfile(data);
  if (isError(profile)) return profile;

  if (args.from !== undefined && !isDate(args.from)) return fail("from must be a date like 2026-11-02");
  if (args.to !== undefined && !isDate(args.to)) return fail("to must be a date like 2026-11-02");

  const to = args.to ?? todayIn(profile.time_zone, now);
  const from = args.from ?? addDays(to, -(DEFAULT_DAYS - 1));
  if (from > to) return fail("from can't be after to");
  if (addDays(from, MAX_DAYS) < to) return fail("ask for at most one year at a time");

  const workouts = await data.getWorkouts(from, to);
  return ok({
    from: from,
    to: to,
    count: workouts.length,
    workouts: workouts.map((w) => ({
      date: w.workout_date,
      title: w.title,
      type: w.type,
      minutes: w.minutes,
      startedAt: w.started_at ? w.started_at.slice(0, 5) : null,
      effort: w.effort,
      notes: w.notes,
      earnedXp: w.earned_xp,
      exercises: w.workout_exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        seconds: e.seconds,
        weightLb: e.weight_lb,
      })),
    })),
  });
}

// get_goals: what the user is aiming for and when they plan to work out
export async function getGoals(data: FitnessData): Promise<ToolResult> {
  const profile = await readableProfile(data);
  if (isError(profile)) return profile;

  return ok({
    goal: profile.goal,
    plannedDays: profile.planned_days,
    preferredTime: profile.preferred_time,
    sessionMinutes: profile.session_minutes,
    experience: profile.experience,
    timeZone: profile.time_zone,
    today: todayIn(profile.time_zone),
    canSuggestPlans: profile.ai_can_create_plans,
  });
}

// get_progress: level and XP, streak and freezes, and badges
export async function getProgress(data: FitnessData): Promise<ToolResult> {
  const profile = await readableProfile(data);
  if (isError(profile)) return profile;

  const [progress, streak, badges] = await Promise.all([data.getProgress(), data.getStreak(), data.getBadges()]);
  return ok({
    level: progress?.level ?? 1,
    totalXp: progress?.total_xp ?? 0,
    streak: {
      current: streak?.current_streak ?? 0,
      best: streak?.best_streak ?? 0,
      freezesLeft: streak?.freezes_left ?? 0,
      atRisk: streak?.at_risk ?? false,
    },
    badges: badges.map((b) => ({ id: b.achievement_id, name: b.name, unlockedAt: b.unlocked_at })),
  });
}

// get_plan: the user's workout plans with their items.
// weekStart is optional. Without it you get the newest plans.
export async function getPlan(data: FitnessData, args: { weekStart?: string }): Promise<ToolResult> {
  const profile = await readableProfile(data);
  if (isError(profile)) return profile;

  if (args.weekStart !== undefined && !isDate(args.weekStart)) {
    return fail("weekStart must be a date like 2026-11-02 (a Monday)");
  }

  const plans = await data.getPlans(args.weekStart ?? null);
  return ok({
    count: plans.length,
    plans: plans.map((p) => ({
      planId: p.id,
      weekStart: p.week_start,
      status: p.status,
      createdBy: p.created_by,
      note: p.note,
      items: p.plan_items.map((i) => ({
        day: i.day,
        workoutType: i.workout_type,
        minutes: i.minutes,
        details: i.details,
      })),
    })),
  });
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// mon, tue... for a YYYY-MM-DD date
function dayOf(date: string): string {
  return DAY_KEYS[new Date(date + "T00:00:00Z").getUTCDay()];
}

// the Monday of the week a date is in
function mondayOf(date: string): string {
  const daysSinceMonday = (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

function totals(workouts: { workout_date: string; minutes: number }[]) {
  let minutes = 0;
  const days = new Set<string>();
  for (const w of workouts) {
    minutes += w.minutes;
    days.add(w.workout_date);
  }
  return { workouts: workouts.length, minutes: minutes, activeDays: days.size };
}

// get_weekly_summary: the numbers an assistant needs to give feedback on the user's week.
// It only adds up what the user logged. The wording of the feedback is up to the assistant.
export async function getWeeklySummary(data: FitnessData, now: Date = new Date()): Promise<ToolResult> {
  const profile = await readableProfile(data);
  if (isError(profile)) return profile;

  const today = todayIn(profile.time_zone, now);
  const weekStart = mondayOf(today);
  const lastWeekStart = addDays(weekStart, -7);

  const [workouts, streak, progress, goals, plans] = await Promise.all([
    data.getWorkouts(lastWeekStart, addDays(weekStart, 6)),
    data.getStreak(),
    data.getProgress(),
    data.getGoalProgress(),
    data.getPlans(weekStart),
  ]);

  const thisWeek = workouts.filter((w) => w.workout_date >= weekStart);
  const lastWeek = workouts.filter((w) => w.workout_date < weekStart);
  const doneDays = new Set(thisWeek.map((w) => dayOf(w.workout_date)));
  const lastWeekDays = new Set(lastWeek.map((w) => dayOf(w.workout_date)));

  // planned days: done, missed (the day has passed), or still to come this week
  const planned = profile.planned_days;
  const done: string[] = [];
  const missed: string[] = [];
  const left: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const day = dayOf(date);
    if (!planned.includes(day)) continue;
    if (doneDays.has(day)) done.push(day);
    else if (date < today) missed.push(day);
    else left.push(day);
  }

  const byType: Record<string, { workouts: number; minutes: number }> = {};
  for (const w of thisWeek) {
    byType[w.type] ??= { workouts: 0, minutes: 0 };
    byType[w.type].workouts += 1;
    byType[w.type].minutes += w.minutes;
  }

  // the plan the user is following this week, or one waiting for their answer
  const plan = plans.find((p) => p.status === "active") ?? plans.find((p) => p.status === "suggested") ?? null;

  const now7 = totals(thisWeek);
  const before = totals(lastWeek);

  return ok({
    today: today,
    weekStart: weekStart,
    daysIntoWeek: dayOfWeekNumber(today),
    thisWeek: {
      ...now7,
      byType: byType,
      plannedDays: planned,
      plannedDaysDone: done,
      plannedDaysMissed: missed,
      plannedDaysLeft: left,
    },
    lastWeek: {
      ...before,
      plannedDaysDone: planned.filter((day) => lastWeekDays.has(day)).length,
      plannedDaysTotal: planned.length,
    },
    comparedToLastWeek: {
      workouts: now7.workouts - before.workouts,
      minutes: now7.minutes - before.minutes,
      note: "This week is not finished unless daysIntoWeek is 7, so compare with care.",
    },
    streak: {
      current: streak?.current_streak ?? 0,
      best: streak?.best_streak ?? 0,
      atRisk: streak?.at_risk ?? false,
    },
    level: progress?.level ?? 1,
    totalXp: progress?.total_xp ?? 0,
    goals: goals.map((g) => ({
      type: g.type,
      name: g.name,
      target: g.target,
      progress: g.progress,
      doneThisWeek: g.done_this_week,
    })),
    plan: plan
      ? {
          planId: plan.id,
          status: plan.status,
          days: plan.plan_items.map((i) => ({
            day: i.day,
            workoutType: i.workout_type,
            minutes: i.minutes,
            done: doneDays.has(i.day),
          })),
        }
      : null,
  });
}

// 1 on Monday up to 7 on Sunday
function dayOfWeekNumber(date: string): number {
  return ((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7) + 1;
}

export interface PlanArgs {
  weekStart: string;
  note?: string;
  items: { day: string; workoutType: string; minutes: number; details?: string }[];
}

// create_workout_plan: saves a new plan as a suggestion
export function createWorkoutPlan(data: FitnessData, args: PlanArgs): Promise<ToolResult> {
  return sendPlan(data, { weekStart: args.weekStart, note: args.note, items: args.items });
}

// update_workout_plan: changes a plan this assistant suggested before, while it's still a suggestion
export function updateWorkoutPlan(data: FitnessData, args: PlanArgs & { planId: string }): Promise<ToolResult> {
  return sendPlan(data, { planId: args.planId, weekStart: args.weekStart, note: args.note, items: args.items });
}

// Both plan tools go through the backend's save-plan function. It checks the permission
// and runs the safety checks, so we don't repeat them here. We only turn its answer
// into something the assistant can act on.
async function sendPlan(data: FitnessData, body: unknown): Promise<ToolResult> {
  const answer = await data.savePlan(body);
  const reply = answer.body;

  switch (answer.status) {
    case 200:
      return ok({
        planId: reply?.planId,
        status: "suggested",
        message:
          "The plan was saved as a suggestion. It is not active yet. " +
          "Tell the user to open the app to accept or dismiss it.",
      });

    case 401:
      return fail("The fitness app login has expired or is wrong. Ask the user to check the MCP server's sign-in settings.");

    case 403:
      return fail(PLANS_OFF);

    case 404:
      return fail(
        "That plan was already accepted or dismissed, so it can't be changed. " +
          "Use create_workout_plan to suggest a new one instead.",
      );

    case 422: {
      const reasons = reply?.details && reply.details.length > 0 ? reply.details : [reply?.error ?? "unknown reason"];
      return fail(
        "The plan was not saved because it failed the safety checks:\n- " +
          reasons.join("\n- ") +
          "\nFix these and try again.",
      );
    }

    case 429:
      return fail(
        "You have suggested too many new plans for this user this week. " +
          "Do not create another one. Use update_workout_plan to change a plan that is still a suggestion, " +
          "or tell the user to try again in a few days.",
      );

    default:
      return fail("The plan could not be saved (the server answered " + answer.status + "). Try again later.");
  }
}
