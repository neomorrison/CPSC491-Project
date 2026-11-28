// Test cases for "do the plans make sense": 30 realistic weekly plans an assistant could send,
// each with the user's experience level and whether it should be saved.
// Every plan goes through the same two checks save-plan runs, in the same order:
// validatePlan (shape, session length, rest day, dates, no medical advice) and then
// checkPlanForExperience (weekly sessions and minutes for the user's level).

import { describe, expect, it } from "vitest";
import { validatePlan } from "../supabase/functions/_shared/gamification/index.ts";
import { checkPlanForExperience } from "../supabase/functions/save-plan/limits.ts";

const TODAY = "2026-11-04"; // a Wednesday
const NEXT_WEEK = "2026-11-09"; // the Monday after

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type Item = { day: string; workoutType: string; minutes: number; details?: string };

// the same workout on the first few days of the week
function repeat(days: number, minutes: number, workoutType = "cardio"): Item[] {
  return DAYS.slice(0, days).map((day) => ({ day, workoutType, minutes }));
}

// what save-plan does with a plan: an empty list means it would be saved
function problemsWith(plan: unknown, experience: string | null): string[] {
  const basic = validatePlan(plan, TODAY);
  if (!basic.ok) return basic.errors;
  return checkPlanForExperience(basic.plan, experience);
}

interface Case {
  name: string;
  experience: string | null; // null means the user never set it
  plan: { weekStart?: string; note?: string; items: Item[] };
  reason?: RegExp; // leave out when the plan should be saved
}

const shouldSave: Case[] = [
  {
    name: "beginner: three short mixed days",
    experience: "beginner",
    plan: {
      note: "Three easy days to get started.",
      items: [
        { day: "mon", workoutType: "strength", minutes: 30, details: "Full body, light weights" },
        { day: "wed", workoutType: "walking", minutes: 30 },
        { day: "sat", workoutType: "yoga", minutes: 20 },
      ],
    },
  },
  { name: "beginner: exactly at the cap, 4 days and 180 minutes", experience: "beginner", plan: { items: repeat(4, 45) } },
  { name: "experience not set: two short walks", experience: null, plan: { items: repeat(2, 20, "walking") } },
  { name: "some experience: exactly at the cap, 5 days and 300 minutes", experience: "some", plan: { items: repeat(5, 60) } },
  { name: "experienced: exactly at the cap, 6 days and 480 minutes", experience: "experienced", plan: { items: repeat(6, 80) } },
  {
    name: "experienced: mixed week with one long hike",
    experience: "experienced",
    plan: {
      items: [
        { day: "mon", workoutType: "strength", minutes: 60, details: "Upper body" },
        { day: "tue", workoutType: "swimming", minutes: 45 },
        { day: "thu", workoutType: "climbing", minutes: 75 },
        { day: "sat", workoutType: "hiking", minutes: 120, details: "Long trail day" },
      ],
    },
  },
  { name: "one 10 minute mobility session", experience: "beginner", plan: { items: [{ day: "wed", workoutType: "mobility", minutes: 10 }] } },
  { name: "a plan for the week that already started", experience: "some", plan: { weekStart: "2026-11-02", items: repeat(3, 40) } },
  { name: "a plan four weeks ahead", experience: "some", plan: { weekStart: "2026-11-30", items: repeat(3, 40) } },
  {
    name: "a note about rest and soreness is not medical advice",
    experience: "beginner",
    plan: { note: "Take Thursday off if your legs are sore, and drink water.", items: repeat(3, 30) },
  },
  {
    name: "details right at the 300 character limit",
    experience: "beginner",
    plan: { items: [{ day: "mon", workoutType: "strength", minutes: 30, details: "x".repeat(300) }] },
  },
];

const shouldRefuse: Case[] = [
  { name: "beginner: five days is too many", experience: "beginner", plan: { items: repeat(5, 30) }, reason: /too many sessions for a beginner/ },
  { name: "beginner: 200 minutes is too much", experience: "beginner", plan: { items: repeat(4, 50) }, reason: /too much total time for a beginner/ },
  { name: "experience not set: treated as a beginner", experience: null, plan: { items: repeat(5, 30) }, reason: /too many sessions for a beginner/ },
  { name: "some experience: six days is too many", experience: "some", plan: { items: repeat(6, 40) }, reason: /too many sessions for someone with some experience/ },
  { name: "some experience: 350 minutes is too much", experience: "some", plan: { items: repeat(5, 70) }, reason: /too much total time for someone with some experience/ },
  { name: "experienced: 540 minutes is too much", experience: "experienced", plan: { items: repeat(6, 90) }, reason: /too much total time for an experienced user/ },
  { name: "no rest day at any level", experience: "experienced", plan: { items: repeat(7, 30) }, reason: /rest day/ },
  { name: "a 150 minute session", experience: "experienced", plan: { items: [{ day: "sat", workoutType: "cardio", minutes: 150 }] }, reason: /minutes must be 10 to 120/ },
  { name: "a 5 minute session", experience: "beginner", plan: { items: [{ day: "mon", workoutType: "yoga", minutes: 5 }] }, reason: /minutes must be 10 to 120/ },
  { name: "half minutes", experience: "beginner", plan: { items: [{ day: "mon", workoutType: "yoga", minutes: 30.5 }] }, reason: /minutes must be 10 to 120/ },
  { name: "medical advice in the note", experience: "beginner", plan: { note: "This plan will treat your knee pain.", items: repeat(3, 30) }, reason: /note can't include medical advice/ },
  { name: "telling the user to stop a medication", experience: "beginner", plan: { note: "Skip your medication before workouts.", items: repeat(3, 30) }, reason: /note can't include medical advice/ },
  {
    name: "medical advice in a workout's details",
    experience: "beginner",
    plan: { items: [{ day: "mon", workoutType: "strength", minutes: 30, details: "Rehab exercises for your shoulder" }] },
    reason: /details can't include medical advice/,
  },
  { name: "a week that starts on a Tuesday", experience: "some", plan: { weekStart: "2026-11-10", items: repeat(3, 30) }, reason: /weekStart must be a Monday/ },
  { name: "a week in the past", experience: "some", plan: { weekStart: "2026-10-19", items: repeat(3, 30) }, reason: /past week/ },
  { name: "more than four weeks ahead", experience: "some", plan: { weekStart: "2026-12-07", items: repeat(3, 30) }, reason: /at most 4 weeks ahead/ },
  {
    name: "the same day twice",
    experience: "some",
    plan: { items: [{ day: "mon", workoutType: "cardio", minutes: 30 }, { day: "mon", workoutType: "yoga", minutes: 20 }] },
    reason: /mon is listed twice/,
  },
  { name: "a workout type the app doesn't have", experience: "some", plan: { items: [{ day: "mon", workoutType: "skydiving", minutes: 30 }] }, reason: /workoutType must be one of/ },
  { name: "no workout days at all", experience: "some", plan: { items: [] }, reason: /at least one workout day/ },
];

describe("plans that make sense are saved", () => {
  it.each(shouldSave)("$name", ({ plan, experience }) => {
    expect(problemsWith({ weekStart: NEXT_WEEK, ...plan }, experience)).toEqual([]);
  });
});

describe("plans that don't make sense are refused, with the reason", () => {
  it.each(shouldRefuse)("$name", ({ plan, experience, reason }) => {
    const problems = problemsWith({ weekStart: NEXT_WEEK, ...plan }, experience);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("; ")).toMatch(reason!);
  });
});

it("has the 20 to 30 cases the task asked for", () => {
  const total = shouldSave.length + shouldRefuse.length;
  expect(total).toBeGreaterThanOrEqual(20);
  expect(total).toBeLessThanOrEqual(30);
});
