import { supabase } from './supabase';
import type { ThemeId } from '../theme/profileThemes';

export type AppearanceData = {
  theme: string;
  level: number;
  rank: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
};

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  if (!data.user) {
    throw new Error('Please sign in again.');
  }

  return data.user.id;
}

export async function fetchAppearance(): Promise<AppearanceData> {
  const userId = await signedInUserId();

  const [profileResult, progressResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('theme')
      .eq('id', userId)
      .single(),

    supabase
      .from('user_progress')
      .select('total_xp, level')
      .eq('user_id', userId)
      .single(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (progressResult.error) throw progressResult.error;

  const totalXp = Number(progressResult.data.total_xp);
  const level = Number(progressResult.data.level);

  if (
    !Number.isFinite(totalXp) ||
    !Number.isInteger(level) ||
    level < 1
  ) {
    throw new Error('Unable to read your level.');
  }

  return {
    theme: profileResult.data.theme ?? 'default',
    level,
    rank:
      level >= 20 ? 'Legend' :
      level >= 15 ? 'Athlete' :
      level >= 10 ? 'Grinder' :
      level >= 5 ? 'Regular' :
      'Starter',
    xpIntoLevel: Math.max(
      0,
      totalXp - 50 * level * (level - 1)
    ),
    xpForNextLevel: 100 * level,
  };
}

export async function saveAppearanceTheme(
  theme: ThemeId
): Promise<string> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('profiles')
    .update({ theme })
    .eq('id', userId)
    .select('theme')
    .single();

  if (error) throw error;

  return data.theme;
}