import { supabase } from './supabase';

// Log out and Delete account for the Settings screen.
// AuthGate notices either one and goes back to the log in screen by itself.

export async function logOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Deletes the account and everything in it (workouts, XP, goals, medals...). Can't be undone,
// so the screen should ask "are you sure?" first.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw new Error('Could not delete your account. Try again.');

  // the login doesn't exist anymore, so clear it from the device too
  await supabase.auth.signOut({ scope: 'local' });
}
