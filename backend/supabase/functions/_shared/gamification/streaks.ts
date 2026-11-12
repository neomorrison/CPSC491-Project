// Streak rules (from the "Streaks" part of our proposal)
// - The streak counts workout days in a row, without missing a day you PLANNED to work out.
// - Rest days (days you didn't plan) don't break it. Extra workouts on rest days still count.
// - Grace day: if you miss a planned day you can make it up by working out the next day.
// - Freeze: you get 1 per week (Mon-Sun). If you miss a day and don't make it up,
//   a freeze gets used automatically and the streak stays the same.
// - No freeze left = streak goes back to 0. Best streak is never lost.
//
// We rebuild the streak from the whole workout history every time instead of adding/subtracting.
// That way deleting a workout or the daily check running late can't mess it up.

import { addDays, daysBetween, weekdayOf, weekStart, type Weekday } from "./dates.ts";

export const FREEZES_PER_WEEK = 1;

// a 2nd workout on the same day can make up a missed day, but a 3rd one doesn't do anything
const MAX_WORKOUTS_COUNTED_PER_DAY = 2;

export interface StreakInput {
  workoutDates: string[]; // date of every workout, same date twice if 2 workouts that day
  plannedDays: Weekday[];
  today: string; // in the user's time zone
  freezesPerWeek?: number;
}

export interface StreakResult {
  current: number;
  best: number;
  freezesLeft: number; // for this week
  atRisk: boolean; // true if the user needs to work out today to keep the streak
  pendingMissedDay: string | null; // missed day that can still be made up today
}

export function computeStreak(input: StreakInput): StreakResult {
  let freezesPerWeek = FREEZES_PER_WEEK;
  if (input.freezesPerWeek !== undefined) {
    freezesPerWeek = input.freezesPerWeek;
  }

  // count workouts per day, skipping anything dated after today
  const workoutsOnDay: Record<string, number> = {};
  for (const d of input.workoutDates) {
    if (d > input.today) continue;
    workoutsOnDay[d] = (workoutsOnDay[d] || 0) + 1;
  }

  const days = Object.keys(workoutsOnDay).sort();
  if (days.length === 0) {
    return { current: 0, best: 0, freezesLeft: freezesPerWeek, atRisk: false, pendingMissedDay: null };
  }

  const freezesUsed: Record<string, number> = {}; // key is the Monday of the week
  let current = 0;
  let best = 0;
  let missedDay: string | null = null;

  // walk through every day from the first workout to today
  const firstDay = days[0];
  const numDays = daysBetween(firstDay, input.today);

  for (let i = 0; i <= numDays; i++) {
    const day = addDays(firstDay, i);
    const isToday = day === input.today;
    let workouts = Math.min(workoutsOnDay[day] || 0, MAX_WORKOUTS_COUNTED_PER_DAY);

    // step 1: deal with yesterday's missed day if there is one
    if (missedDay !== null) {
      if (workouts > 0) {
        // this workout makes up for the missed day
        workouts--;
        current++;
        missedDay = null;
      } else if (!isToday) {
        // the grace day is over, try to use a freeze
        const week = weekStart(day);
        const used = freezesUsed[week] || 0;
        if (used < freezesPerWeek) {
          freezesUsed[week] = used + 1;
        } else {
          current = 0;
        }
        missedDay = null;
      }
      // if it's today and they haven't worked out yet, they still have time, so leave it
    }

    // step 2: count the day itself
    // (one workout can't count for both the missed day and today, that's why we did workouts-- above)
    if (workouts > 0) {
      current++;
    } else if (isPlannedDay(day, input.plannedDays) && !isToday) {
      missedDay = day;
    }

    if (current > best) {
      best = current;
    }
  }

  const usedThisWeek = freezesUsed[weekStart(input.today)] || 0;
  const workedOutToday = (workoutsOnDay[input.today] || 0) > 0;

  let atRisk = false;
  if (missedDay !== null) atRisk = true;
  if (isPlannedDay(input.today, input.plannedDays) && !workedOutToday) atRisk = true;

  return {
    current: current,
    best: best,
    freezesLeft: Math.max(0, freezesPerWeek - usedThisWeek),
    atRisk: atRisk,
    pendingMissedDay: missedDay,
  };
}

function isPlannedDay(date: string, plannedDays: Weekday[]): boolean {
  return plannedDays.includes(weekdayOf(date));
}

// bonus XP for having a streak: +5 per day, max +30
export function streakBonus(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(30, streak * 5);
}
