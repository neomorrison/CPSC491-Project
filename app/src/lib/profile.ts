import { supabase } from './supabase';

export type ProfileChanges = {
  displayName: string;
  experience: string;
  plannedDays: string[];
};

export type ProfileData = ProfileChanges & {
  theme: string;
};

type ProfileRow = {
  display_name: string;
  experience: string | null;
  planned_days: string[];
  theme: string;
};

function toScreenProfile(row: ProfileRow): ProfileData {
  const experience =
    row.experience === 'beginner' ? 'Beginner' :
    row.experience === 'some' ? 'Intermediate' :
    row.experience === 'experienced' ? 'Advanced' :
    '';

  return {
    displayName: row.display_name,
    experience,
    plannedDays: row.planned_days,
    theme: row.theme,
 };
}

async function signedInUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again.');

  return data.user.id;
}

export async function fetchProfile(): Promise<ProfileData> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, experience, planned_days, theme')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return toScreenProfile(data);
}

export async function updateProfile(
  changes: ProfileChanges
): Promise<ProfileData> {
  const userId = await signedInUserId();
  const name = changes.displayName.trim();

  if (!name || name.length > 60) {
    throw new Error('Display name must contain 1–60 characters.');
  }

  const experience =
    changes.experience === 'Beginner' ? 'beginner' :
    changes.experience === 'Intermediate' ? 'some' :
    changes.experience === 'Advanced' ? 'experienced' :
    null;

  if (!experience) {
    throw new Error('Choose an experience level.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: name,
      experience,
      planned_days: [...new Set(changes.plannedDays)],
    })
    .eq('id', userId)
    .select('display_name, experience, planned_days, theme')
    .single();

  if (error) throw error;

  return toScreenProfile(data);
}