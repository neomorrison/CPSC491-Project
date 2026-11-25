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
  medalsTotal: number;
  latestMedals: { id: string; name: string }[]; // the 3 most recent, newest first
  activeGoals: number;
  weeklyGoalXp?: number; // XP for hitting the weekly goal, only if they set one
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

// XP needed for the next frame that unlocks by level (Orbit at 10, Aurora at 15).
// Reaching level L takes 50 * L * (L - 1) XP. undefined once they have them all.
const FRAME_LEVELS = [10, 15];

export function nextFrameUnlockXp(level: number): number | undefined {
  for (const frameLevel of FRAME_LEVELS) {
    if (level < frameLevel) return 50 * frameLevel * (frameLevel - 1);
  }
  return undefined;
}

// the backend gives this much XP each week you hit a weekly goal (GOAL_XP.weekly in goals.ts)
const WEEKLY_GOAL_XP = 30;

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

  const [progress, streak, profile, goal, medals, challenges, allMedals, latest, goals] = await Promise.all([
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
    supabase.from('achievements').select('id', { count: 'exact', head: true }),
    supabase
      .from('user_achievements')
      .select('achievement_id, achievements (name)')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false })
      .limit(3),
    supabase
      .from('goals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);

  for (const result of [progress, streak, profile, goal, medals, challenges, allMedals, latest, goals]) {
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
    medalsTotal: allMedals.count ?? 0,
    latestMedals: (latest.data ?? []).map(row => {
      // the joined achievement can come back as an object or a one item list
      const achievement = Array.isArray(row.achievements) ? row.achievements[0] : row.achievements;
      return { id: row.achievement_id, name: achievement?.name ?? 'Medal' };
    }),
    activeGoals: goals.count ?? 0,
    weeklyGoalXp: goal.data ? WEEKLY_GOAL_XP : undefined,
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

// A workout from the app, in the shape the log-workout and edit-workout functions want
function toBackend(workout: NewWorkout) {
  return {
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
  };
}

// Turns an error from a function call into something the screen can show
async function backendError(error: unknown): Promise<Error> {
  // 422 means the workout failed the backend's checks; details says why
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    return new WorkoutRejected(body?.error ?? 'Could not save the workout.', body?.details ?? []);
  }
  return new Error('Could not reach the server. Check your connection and try again.');
}

// Sends a new workout to the backend, which works out the XP, streak and rewards
export async function logWorkout(workout: NewWorkout): Promise<WorkoutReward> {
  const { data, error } = await supabase.functions.invoke('log-workout', {
    body: toBackend(workout),
  });

  if (error) throw await backendError(error);

  return {
    earnedXp: data.earnedXp,
    xpGained: data.xpGained,
    leveledUp: data.leveledUp,
    level: data.level?.level ?? data.levelAfter,
    streak: data.streak?.current ?? 0,
    newAchievements: data.newAchievements ?? [],
  };
}

// What changed after an edit or delete. The backend takes back the old XP and works out
// the streak, goals and challenges again, so the screen should call fetchProgress() after.
export type WorkoutChange = {
  xpChange: number; // can be negative
  totalXp: number;
  level: number;
  streak: number;
};

function toChange(data: any): WorkoutChange {
  return {
    xpChange: data.xpChange ?? 0,
    totalXp: data.totalXp ?? 0,
    level: data.level?.level ?? data.level ?? 1,
    streak: data.streak?.current ?? 0,
  };
}

// Saves changes to a workout that's already logged (same fields as logWorkout)
export async function editWorkout(workoutId: string, workout: NewWorkout): Promise<WorkoutChange> {
  const { data, error } = await supabase.functions.invoke('edit-workout', {
    body: { workoutId, ...toBackend(workout) },
  });

  if (error) throw await backendError(error);
  return toChange(data);
}

// Deletes a workout. Medals and finished challenges are kept, the workout's own XP is taken back
export async function deleteWorkout(workoutId: string): Promise<WorkoutChange> {
  const { data, error } = await supabase.functions.invoke('edit-workout', {
    body: { workoutId, delete: true },
  });

  if (error) throw await backendError(error);
  return toChange(data);
}

export type WeekCount = {
  weekStart: string; // the Monday, YYYY-MM-DD
  workouts: number;
  minutes: number;
};

function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// Workouts and minutes for each of the last few weeks, oldest first, for the Progress chart.
// Weeks with no workouts are included as 0 so the chart has no gaps.
export async function fetchWeeklyCounts(weeks = 8): Promise<WeekCount[]> {
  const userId = await signedInUserId();

  // the Monday of this week, then go back
  const today = new Date();
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const result: WeekCount[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(thisMonday);
    monday.setDate(monday.getDate() - 7 * i);
    result.push({ weekStart: toDateKey(monday), workouts: 0, minutes: 0 });
  }

  const { data, error } = await supabase
    .from('workouts')
    .select('workout_date, minutes')
    .eq('user_id', userId)
    .gte('workout_date', result[0].weekStart);

  if (error) throw error;

  for (const row of data ?? []) {
    // the last week that starts on or before this workout's date
    for (let i = result.length - 1; i >= 0; i--) {
      if (row.workout_date >= result[i].weekStart) {
        result[i].workouts++;
        result[i].minutes += row.minutes;
        break;
      }
    }
  }
  return result;
}
