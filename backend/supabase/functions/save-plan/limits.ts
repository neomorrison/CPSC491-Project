// Extra safety rules for plans an AI assistant suggests, on top of the basic checks
// in _shared/gamification/plans.ts. Both come from the project proposal (use case 16):
//
// 1. A cap on sessions per week that depends on the user's experience level,
//    so a beginner isn't handed a six day plan.
// 2. A limit on how many new plans an assistant can suggest in a week,
//    so it can't flood the user with suggestions.
//
// No database code in here, so it's easy to unit test.

import type { PlanInput } from "../_shared/gamification/plans.ts";

export type Experience = "beginner" | "some" | "experienced";

export const EXTRA_LIMITS = {
  // most workout days in one week, by experience level
  maxSessions: { beginner: 4, some: 5, experienced: 6 },
  // most total minutes in one week, by experience level
  maxWeeklyMinutes: { beginner: 180, some: 300, experienced: 480 },
  // most new plans an assistant can suggest in any 7 days
  maxNewPlansPerWeek: 5,
  windowDays: 7,
};

// If the user never set their experience level we treat them as a beginner.
// It is the safest guess, and they can change it in their profile.
export function experienceOf(value: string | null | undefined): Experience {
  if (value === "some" || value === "experienced") return value;
  return "beginner";
}

const LABEL: Record<Experience, string> = {
  beginner: "a beginner",
  some: "someone with some experience",
  experienced: "an experienced user",
};

// returns the reasons the plan is too much for this user. an empty list means it's fine.
export function checkPlanForExperience(plan: PlanInput, experience: string | null | undefined): string[] {
  const level = experienceOf(experience);
  const problems: string[] = [];

  const maxSessions = EXTRA_LIMITS.maxSessions[level];
  if (plan.items.length > maxSessions) {
    problems.push(
      "too many sessions for " + LABEL[level] + ": " + plan.items.length + " workout days, the most is " + maxSessions,
    );
  }

  let totalMinutes = 0;
  for (const item of plan.items) totalMinutes += item.minutes;
  const maxMinutes = EXTRA_LIMITS.maxWeeklyMinutes[level];
  if (totalMinutes > maxMinutes) {
    problems.push(
      "too much total time for " + LABEL[level] + ": " + totalMinutes + " minutes this week, the most is " + maxMinutes,
    );
  }

  return problems;
}

// the start of the window we count new suggestions in, as an ISO timestamp
export function windowStart(now: Date): string {
  return new Date(now.getTime() - EXTRA_LIMITS.windowDays * 24 * 60 * 60 * 1000).toISOString();
}

// true when the assistant has already suggested as many new plans as it's allowed
export function overWeeklyLimit(recentNewPlans: number): boolean {
  return recentNewPlans >= EXTRA_LIMITS.maxNewPlansPerWeek;
}
