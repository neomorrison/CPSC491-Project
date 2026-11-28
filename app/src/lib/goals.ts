import { supabase } from './supabase';

// Goals for the Goals screen. The backend counts the progress and gives the XP
// (weekly goals: +30 XP every week you hit them, milestones: +50 XP once).
// Only workouts of 10+ minutes count, same as streaks.

export type GoalType =
  | 'workouts_per_week'
  | 'minutes_per_week'
  | 'active_days_per_week'
  | 'streak'
  | 'total_workouts';

// Everything the screen needs to show the choices. min and max are the same limits
// the database uses, so checking them here just gives a nicer message.
export const GOAL_TYPES: {
  type: GoalType;
  label: string;
  unit: string;
  weekly: boolean;
  min: number;
  max: number;
}[] = [
  { type: 'workouts_per_week', label: 'Workouts / week', unit: 'workouts', weekly: true, min: 1, max: 14 },
  { type: 'minutes_per_week', label: 'Minutes / week', unit: 'minutes', weekly: true, min: 10, max: 1500 },
  { type: 'active_days_per_week', label: 'Active days / week', unit: 'days', weekly: true, min: 1, max: 7 },
  { type: 'streak', label: 'Streak target', unit: 'days', weekly: false, min: 2, max: 365 },
  { type: 'total_workouts', label: 'Total workouts', unit: 'workouts', weekly: false, min: 1, max: 1000 },
];

export type Goal = {
  id: string;
  type: GoalType;
  label: string;
  name: string | null; // optional custom name
  target: number;
  progress: number; // this week for weekly goals, so far for milestones
  doneThisWeek: boolean; // weekly goals only
  weekly: boolean;
};

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again.');

  return data.user.id;
}

function typeInfo(type: string) {
  return GOAL_TYPES.find(item => item.type === type) ?? GOAL_TYPES[0];
}

// The user's active goals with their progress
export async function fetchGoals(): Promise<Goal[]> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('goal_progress')
    .select('goal_id, type, target, name, progress, done_this_week')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('start_date');

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.goal_id,
    type: row.type,
    label: typeInfo(row.type).label,
    name: row.name,
    target: row.target,
    progress: row.progress,
    doneThisWeek: row.done_this_week,
    weekly: typeInfo(row.type).weekly,
  }));
}

// Makes a new goal. You can have one active goal of each type, and 5 at most.
export async function createGoal(type: GoalType, target: number, name?: string): Promise<void> {
  const userId = await signedInUserId();
  const info = typeInfo(type);

  if (!Number.isInteger(target) || target < info.min || target > info.max) {
    throw new Error(`${info.label} has to be a whole number from ${info.min} to ${info.max}.`);
  }

  const { error } = await supabase.from('goals').insert({
    user_id: userId,
    type,
    target,
    name: name?.trim() || null,
  });

  if (error) {
    // 23505 = there's already an active goal of this type
    if (error.code === '23505') {
      throw new Error(`You already have a ${info.label} goal. Change that one instead.`);
    }
    throw new Error(error.message); // for example "you can have at most 5 active goals"
  }
}

// Changes the number on a goal that's still active
export async function changeGoalTarget(goal: Goal, target: number): Promise<void> {
  const info = typeInfo(goal.type);

  if (!Number.isInteger(target) || target < info.min || target > info.max) {
    throw new Error(`${info.label} has to be a whole number from ${info.min} to ${info.max}.`);
  }

  const { error } = await supabase.from('goals').update({ target }).eq('id', goal.id);
  if (error) throw new Error(error.message);
}

// Stops a goal. It's archived instead of deleted so the XP history still makes sense.
export async function removeGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('goals').update({ status: 'archived' }).eq('id', goalId);
  if (error) throw new Error(error.message);
}
