import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Workouts, XP, level and streak all come from the backend.
// The app never calculates rewards itself: a new workout goes to the log-workout
// function, which runs the game rules and saves everything (see backend/README.md).

export type WorkoutType =
  | 'Strength'
  | 'Cardio'
  | 'Walking'
  | 'Yoga'
  | 'Pilates'
  | 'Mobility'
  | 'Hiking'
  | 'Swimming'
  | 'Climbing'
  | 'Sports'
  | 'Other';
export type Intensity = 'Light' | 'Moderate' | 'Hard';

export type SavedWorkout = {
  id: string;
  name: string;
  minutes: number;
  date: string; // YYYY-MM-DD
  workoutType?: WorkoutType;
  outdoor?: boolean;
  intensity?: Intensity;
  exercises?: { id: number; name: string; sets: number; reps: number; weight: number }[];
  notes?: string;
};

export type Progress = {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  rank: string;
  streak: number;
  bestStreak: number;
  weeklyTarget: number;
  medals: number;
  challengesCompleted: number;
};

export type NewWorkout = {
  title: string;
  minutes: number;
  date: string; // YYYY-MM-DD
  workoutType: WorkoutType;
  outdoor?: boolean; // the "Outdoors" toggle. Hikes count as outdoor either way
  intensity: Intensity;
  exercises: { name: string; sets: number; reps: number; weight: number }[];
  notes: string;
};

export type WorkoutReward = {
  earnedXp: boolean;
  xpGained: number;
  leveledUp: boolean;
  level: number;
  streak: number;
  newAchievements: string[];
};

// The backend said no, and details says why (for example "date can't be in the future")
export class WorkoutRejected extends Error {
  details: string[];

  constructor(message: string, details: string[]) {
    super(message);
    this.details = details;
  }
}

// Screen values <-> database values
// (the medals use these types, for example Finding Balance needs yoga or pilates)
const TYPE_TO_DB: Record<WorkoutType, string> = {
  Strength: 'strength',
  Cardio: 'cardio',
  Walking: 'walking',
  Yoga: 'yoga',
  Pilates: 'pilates',
  Mobility: 'mobility',
  Hiking: 'hiking',
  Swimming: 'swimming',
  Climbing: 'climbing',
  Sports: 'sports',
  Other: 'other',
};
const TYPE_FROM_DB: Record<string, WorkoutType> = {
  strength: 'Strength',
  cardio: 'Cardio',
  walking: 'Walking',
  yoga: 'Yoga',
  pilates: 'Pilates',
  mobility: 'Mobility',
  hiking: 'Hiking',
  swimming: 'Swimming',
  climbing: 'Climbing',
  sports: 'Sports',
  other: 'Other',
};
const INTENSITY_TO_DB: Record<Intensity, string> = { Light: 'easy', Moderate: 'just_right', Hard: 'tough' };
const INTENSITY_FROM_DB: Record<string, Intensity> = { easy: 'Light', just_right: 'Moderate', tough: 'Hard' };

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again.');

  return data.user.id;
}

export function rankFor(level: number): string {
  return level >= 20 ? 'Legend' :
    level >= 15 ? 'Athlete' :
    level >= 10 ? 'Grinder' :
    level >= 5 ? 'Regular' :
    'Starter';
}

// XP, level, streak and the counts shown on Home, Progress and Profile
export async function fetchProgress(): Promise<Progress> {
  const userId = await signedInUserId();

  const [progress, streak, profile, goal, medals, challenges] = await Promise.all([
    supabase.from('user_progress').select('total_xp, level').eq('user_id', userId).maybeSingle(),
    supabase.from('streaks').select('current_streak, best_streak').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('planned_days').eq('id', userId).single(),
    supabase
      .from('goals')
      .select('target')
      .eq('user_id', userId)
      .eq('type', 'workouts_per_week')
      .eq('status', 'active')
      .maybeSingle(),
    supabase.from('user_achievements').select('achievement_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('user_challenges')
      .select('challenge_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),
  ]);

  for (const result of [progress, streak, profile, goal, medals, challenges]) {
    if (result.error) throw result.error;
  }

  const totalXp = Number(progress.data?.total_xp ?? 0);
  const level = Number(progress.data?.level ?? 1);
  const plannedDays: string[] = profile.data?.planned_days ?? [];

  return {
    totalXp,
    level,
    // the database decides total XP and level; this only splits it for the progress bar
    // (reaching level L takes 50 * L * (L - 1) XP, the same formula as the backend)
    xpIntoLevel: Math.max(0, totalXp - 50 * level * (level - 1)),
    xpForNextLevel: 100 * level,
    rank: rankFor(level),
    streak: streak.data?.current_streak ?? 0,
    bestStreak: streak.data?.best_streak ?? 0,
    // their "workouts per week" goal if they set one, otherwise how many days they planned
    weeklyTarget: goal.data?.target ?? plannedDays.length,
    medals: medals.count ?? 0,
    challengesCompleted: challenges.count ?? 0,
  };
}

// Workout history, oldest first (the Workouts screen shows it newest first)
export async function fetchWorkouts(): Promise<SavedWorkout[]> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('workouts')
    // '*' so this works before and after the workout title column exists
    .select('*, workout_exercises (name, sets, reps, weight_lb, position)')
    .eq('user_id', userId)
    .order('workout_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    name: row.title || row.type.charAt(0).toUpperCase() + row.type.slice(1) + ' workout',
    minutes: row.minutes,
    date: row.workout_date,
    workoutType: TYPE_FROM_DB[row.type],
    outdoor: row.outdoor ?? false,
    intensity: row.effort ? INTENSITY_FROM_DB[row.effort] : undefined,
    notes: row.notes ?? undefined,
    exercises: [...(row.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((exercise, index) => ({
        id: index,
        name: exercise.name,
        sets: exercise.sets ?? 0,
        reps: exercise.reps ?? 0,
        weight: exercise.weight_lb === null ? 0 : Number(exercise.weight_lb),
      })),
  }));
}

// Sends a new workout to the backend, which works out the XP, streak and rewards
export async function logWorkout(workout: NewWorkout): Promise<WorkoutReward> {
  const { data, error } = await supabase.functions.invoke('log-workout', {
    body: {
      type: TYPE_TO_DB[workout.workoutType],
      title: workout.title.trim() || null,
      date: workout.date,
      minutes: workout.minutes,
      outdoor: workout.outdoor === true,
      effort: INTENSITY_TO_DB[workout.intensity],
      notes: workout.notes.trim() || null,
      exercises: workout.exercises.map(exercise => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weightLb: exercise.weight > 0 ? exercise.weight : null,
      })),
    },
  });

  if (error) {
    // 422 means the workout failed the backend's checks; details says why
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new WorkoutRejected(body?.error ?? 'Could not save the workout.', body?.details ?? []);
    }
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  return {
    earnedXp: data.earnedXp,
    xpGained: data.xpGained,
    leveledUp: data.leveledUp,
    level: data.level?.level ?? data.levelAfter,
    streak: data.streak?.current ?? 0,
    newAchievements: data.newAchievements ?? [],
  };
}
