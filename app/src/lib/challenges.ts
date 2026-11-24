import { supabase } from './supabase';

export type Challenge = {
  id: string;
  name: string;
  description: string;
  period: string;
  metric: string;
  exercise: string | null;
  target: number;
  xp_reward: number;
  difficulty: string;
  min_level: number;
};

export type Enrollment = {
  challenge_id: string;
  period_start: string;
  progress: number;
  status: string;
  start_date: string;
  end_date: string;
  joined_at: string;
  completed_at: string | null;
};

export type Medal = {
  id: string;
  name: string;
  description: string;
};

export type EarnedMedal = {
  achievement_id: string;
  unlocked_at: string;
};

export type ChallengeData = {
  challenges: Challenge[];
  enrollments: Enrollment[];
  medals: Medal[];
  earnedMedals: EarnedMedal[];
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(error.message);
  }

  return 'Something went wrong. Please try again.';
}

async function userId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again.');

  return data.user.id;
}

export async function fetchChallenges(): Promise<ChallengeData> {
  const id = await userId();

  const [catalog, enrollments, medals, earned] = await Promise.all([
    supabase
      .from('challenges')
      .select('id, name, description, period, metric, exercise, target, xp_reward, difficulty, min_level')
      .eq('active', true)
      .order('min_level')
      .order('name'),

    supabase
      .from('user_challenges')
      .select('challenge_id, period_start, progress, status, start_date, end_date, joined_at, completed_at')
      .eq('user_id', id)
      .order('joined_at', { ascending: false }),

    supabase
      .from('achievements')
      .select('id, name, description')
      .order('name'),

    supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', id)
      .order('unlocked_at', { ascending: false }),
  ]);

  if (catalog.error) throw catalog.error;
  if (enrollments.error) throw enrollments.error;
  if (medals.error) throw medals.error;
  if (earned.error) throw earned.error;

  return {
    challenges: catalog.data as unknown as Challenge[],
    enrollments: enrollments.data as Enrollment[],
    medals: medals.data as Medal[],
    earnedMedals: earned.data as EarnedMedal[],
  };
}

export async function joinChallenge(
  challengeId: string
): Promise<void> {
  await userId();

  const { error } = await supabase.rpc('join_challenge', {
    p_challenge_id: challengeId,
  });

  if (error) throw error;
}

export function challengeRequirement(challenge: Challenge): string {
  const activity =
    challenge.metric === 'minutes'
      ? 'active minutes'
      : challenge.metric === 'exercise_reps'
        ? `${challenge.exercise || 'exercise'} reps`
        : 'workouts';

  return `${challenge.target} ${activity} • ${challenge.period}`;
}