// Date helpers.
// We store dates as "YYYY-MM-DD" strings in the user's time zone so "today" means
// the user's today and not the server's (the server runs in UTC).

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// turns "2026-11-02" into a Date at midnight UTC
function toDate(date: string): Date {
  return new Date(date + "T00:00:00Z");
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// true if the value is a real date like "2026-11-02" ("2026-02-30" is not)
export function isDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = toDate(value);
  if (isNaN(d.getTime())) return false;
  return toDateString(d) === value;
}

export function addDays(date: string, days: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

// number of days from a to b (negative if b is before a)
export function daysBetween(a: string, b: string): number {
  const diff = toDate(b).getTime() - toDate(a).getTime();
  return Math.round(diff / ONE_DAY_MS);
}

export function weekdayOf(date: string): Weekday {
  // getUTCDay() gives 0 for Sunday, but our weeks start on Monday
  const day = toDate(date).getUTCDay();
  if (day === 0) return "sun";
  return WEEKDAYS[day - 1];
}

// the Monday of the week this date is in
export function weekStart(date: string): string {
  const index = WEEKDAYS.indexOf(weekdayOf(date)); // 0 for Monday
  return addDays(date, -index);
}

// today's date in a time zone like "America/Los_Angeles"
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // the en-CA locale happens to format dates as YYYY-MM-DD
  return now.toLocaleDateString("en-CA", { timeZone: timeZone });
}
