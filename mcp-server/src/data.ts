// Everything the tools need from the app's backend, as one interface.
// supabase.ts has the real version. The tests pass in a fake one.

export interface Profile {
  display_name: string;
  goal: string | null;
  planned_days: string[];
  preferred_time: string | null;
  session_minutes: number | null;
  experience: string | null;
  time_zone: string;
  ai_can_read: boolean;
  ai_can_create_plans: boolean;
}

export interface Exercise {
  name: string;
  sets: number | null;
  reps: number | null;
  seconds: number | null;
  weight_lb: number | null;
}

export interface Workout {
  workout_date: string;
  type: string;
  minutes: number;
  started_at: string | null;
  effort: string | null;
  notes: string | null;
  earned_xp: boolean;
  workout_exercises: Exercise[];
}

export interface Progress {
  total_xp: number;
  level: number;
}

export interface Streak {
  current_streak: number;
  best_streak: number;
  freezes_left: number;
  at_risk: boolean;
}

export interface Badge {
  achievement_id: string;
  name: string;
  unlocked_at: string;
}

export interface PlanItem {
  day: string;
  workout_type: string;
  minutes: number;
  details: string | null;
}

export interface Plan {
  id: string;
  week_start: string;
  status: string;
  created_by: string;
  note: string | null;
  plan_items: PlanItem[];
}

// what the save-plan function answered
export interface SavePlanAnswer {
  status: number;
  // { planId, status } on success, { error, details? } on failure
  body: { planId?: string; status?: string; error?: string; details?: string[] } | null;
}

export interface FitnessData {
  getProfile(): Promise<Profile | null>;
  getWorkouts(from: string, to: string): Promise<Workout[]>;
  getProgress(): Promise<Progress | null>;
  getStreak(): Promise<Streak | null>;
  getBadges(): Promise<Badge[]>;
  // weekStart null means "the newest plans"
  getPlans(weekStart: string | null): Promise<Plan[]>;
  savePlan(body: unknown): Promise<SavePlanAnswer>;
}
