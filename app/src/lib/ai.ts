import { supabase } from './supabase';

// AI Connections for the Settings screen and the suggested plan screen.
// The assistant itself is not in the app: the user connects their own assistant app
// (Claude, ChatGPT...) through our MCP server. This file only reads and changes what the
// user allows, and lets them accept or dismiss the plans an assistant suggested.

export type AiSettings = {
  canRead: boolean; // the assistant can read workouts, goals, progress and plans
  canMakePlans: boolean; // the assistant can suggest weekly plans
};

export type PlanDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// the same workout types the Log Workout screen and the backend use
export type WorkoutType =
  | 'strength'
  | 'cardio'
  | 'walking'
  | 'yoga'
  | 'pilates'
  | 'mobility'
  | 'hiking'
  | 'swimming'
  | 'climbing'
  | 'sports'
  | 'other';

export type SuggestedPlanItem = {
  day: PlanDay;
  dayLabel: string; // "Monday"
  workoutType: WorkoutType;
  minutes: number;
  details: string | null;
};

export type SuggestedPlan = {
  id: string;
  weekStart: string; // the Monday of the week the plan is for, YYYY-MM-DD
  note: string | null; // the assistant's short message about the plan
  createdAt: string;
  totalMinutes: number;
  items: SuggestedPlanItem[]; // Monday first
};

const DAY_ORDER: PlanDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_LABELS: Record<PlanDay, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

type SettingsRow = {
  ai_can_read: boolean;
  ai_can_create_plans: boolean;
};

type PlanRow = {
  id: string;
  week_start: string;
  note: string | null;
  created_at: string;
  plan_items: {
    day: PlanDay;
    workout_type: SuggestedPlanItem['workoutType'];
    minutes: number;
    details: string | null;
  }[] | null;
};

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again.');

  return data.user.id;
}

function toSettings(row: SettingsRow): AiSettings {
  return { canRead: row.ai_can_read, canMakePlans: row.ai_can_create_plans };
}

// What the user currently allows. Both are off until they turn them on.
export async function fetchAiSettings(): Promise<AiSettings> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('profiles')
    .select('ai_can_read, ai_can_create_plans')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return toSettings(data);
}

// Saves both switches and gives back what was saved.
// Turning canRead off stops the assistant's read tools right away. Turning canMakePlans
// off stops new suggestions; plans it already suggested stay until accepted or dismissed.
export async function saveAiSettings(canRead: boolean, canMakePlans: boolean): Promise<AiSettings> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('profiles')
    .update({ ai_can_read: canRead, ai_can_create_plans: canMakePlans })
    .eq('id', userId)
    .select('ai_can_read, ai_can_create_plans')
    .single();

  if (error) throw error;

  return toSettings(data);
}

// Plans an assistant suggested that the user hasn't accepted or dismissed yet, newest first
export async function fetchSuggestedPlans(): Promise<SuggestedPlan[]> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('workout_plans')
    .select('id, week_start, note, created_at, plan_items (day, workout_type, minutes, details)')
    .eq('user_id', userId)
    .eq('created_by', 'assistant')
    .eq('status', 'suggested')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return ((data ?? []) as PlanRow[]).map(row => {
    const items = [...(row.plan_items ?? [])]
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
      .map(item => ({
        day: item.day,
        dayLabel: DAY_LABELS[item.day],
        workoutType: item.workout_type,
        minutes: item.minutes,
        details: item.details,
      }));

    return {
      id: row.id,
      weekStart: row.week_start,
      note: row.note,
      createdAt: row.created_at,
      totalMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
      items,
    };
  });
}

// Accept and dismiss only work on a plan that is still a suggestion from an assistant,
// so tapping twice or acting on an old screen can't change a plan that was already decided.
async function decidePlan(id: string, status: 'active' | 'dismissed'): Promise<void> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('workout_plans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('created_by', 'assistant')
    .eq('status', 'suggested')
    .select('id');

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error('This plan was already accepted or dismissed.');
  }
}

// Makes the suggested plan the user's plan for that week
export async function acceptPlan(id: string): Promise<void> {
  await decidePlan(id, 'active');
}

// Turns the suggestion down. The assistant can suggest a new one.
export async function dismissPlan(id: string): Promise<void> {
  await decidePlan(id, 'dismissed');
}
