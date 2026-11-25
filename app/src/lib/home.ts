import { supabase } from './supabase';

// Which cards show on the Home screen and in what order (saved in home_widgets).
// New accounts start with level, streak, weekly goal, daily challenge and recent workouts.

export type HomeCardId =
  | 'level'
  | 'streak'
  | 'weekly_goal'
  | 'daily_challenge'
  | 'recent_workouts'
  | 'progress_chart'
  | 'streak_calendar';

export const HOME_CARDS: { id: HomeCardId; label: string }[] = [
  { id: 'level', label: 'Level' },
  { id: 'streak', label: 'Streak' },
  { id: 'weekly_goal', label: 'Weekly goal' },
  { id: 'daily_challenge', label: 'Challenges' },
  { id: 'recent_workouts', label: 'Recent workouts' },
  { id: 'progress_chart', label: 'Progress chart' },
  { id: 'streak_calendar', label: 'Streak calendar' },
];

export type HomeCard = {
  id: HomeCardId;
  label: string;
  visible: boolean;
};

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Please sign in again.');

  return data.user.id;
}

// Every card in the order to show them. Cards the user never set up come last, hidden.
export async function fetchHomeCards(): Promise<HomeCard[]> {
  const userId = await signedInUserId();

  const { data, error } = await supabase
    .from('home_widgets')
    .select('widget, position, visible')
    .eq('user_id', userId)
    .order('position');

  if (error) throw error;

  const cards: HomeCard[] = [];
  for (const row of data ?? []) {
    const card = HOME_CARDS.find(item => item.id === row.widget);
    if (card) cards.push({ id: card.id, label: card.label, visible: row.visible });
  }
  for (const card of HOME_CARDS) {
    if (!cards.some(item => item.id === card.id)) {
      cards.push({ id: card.id, label: card.label, visible: false });
    }
  }
  return cards;
}

// Saves the order (the order of the list) and which ones are visible
export async function saveHomeCards(cards: HomeCard[]): Promise<void> {
  const userId = await signedInUserId();

  const rows = cards.map((card, index) => ({
    user_id: userId,
    widget: card.id,
    position: index,
    visible: card.visible,
  }));

  const { error } = await supabase.from('home_widgets').upsert(rows);
  if (error) throw error;
}
