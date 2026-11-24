import { supabase } from './supabase';
import type { ThemeId } from '../theme/profileThemes';
import {
  AVATARS,
  FRAMES,
} from '../theme/profileRewards';
import type {
  AvatarId,
  FrameId,
} from '../theme/profileRewards';

export type AppearanceData = {
  theme: string;
  avatarId: string;
  frameId: string;
  level: number;
  rank: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
};

export type AppearanceSelection = {
  theme: ThemeId;
  avatarId: AvatarId;
  frameId: FrameId;
};

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again.');

  return data.user.id;
}

export async function fetchAppearance(): Promise<AppearanceData> {
  const userId = await signedInUserId();

  const [profileResult, progressResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('theme, avatar_id, frame_id')
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
    avatarId: profileResult.data.avatar_id ?? 'initials',
    frameId: profileResult.data.frame_id ?? 'minimal',
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

export async function saveAppearance(
  selection: AppearanceSelection
): Promise<void> {
  if (!AVATARS.some(item => item.id === selection.avatarId)) {
    throw new Error('Choose a valid avatar.');
  }

  if (!FRAMES.some(item => item.id === selection.frameId)) {
    throw new Error('Choose a valid frame.');
  }

  const userId = await signedInUserId();

  const { error } = await supabase
    .from('profiles')
    .update({
      theme: selection.theme,
      avatar_id: selection.avatarId,
      frame_id: selection.frameId,
    })
    .eq('id', userId)
    .select('id')
    .single();

  if (error) throw error;
}