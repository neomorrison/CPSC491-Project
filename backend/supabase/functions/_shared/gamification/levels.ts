// Levels
// Going from level L to level L+1 costs 100 * L XP.
// So the total XP needed to reach level L is 100 * (1 + 2 + ... + (L-1)) = 50 * L * (L-1).
// The user_progress view in the migration uses the same formula, so keep them in sync.

export type Rank = "Starter" | "Regular" | "Grinder" | "Athlete" | "Legend";

export interface LevelUnlock {
  level: number;
  unlock: string;
}

// themes you unlock by leveling up (shown on the level up screen)
export const LEVEL_UNLOCKS: LevelUnlock[] = [
  { level: 8, unlock: "theme:ember" },
  { level: 12, unlock: "theme:tide" },
  { level: 20, unlock: "theme:aurora" },
];

export function totalXpToReach(level: number): number {
  return 50 * level * (level - 1);
}

// XP it takes to get from this level to the next one
export function xpForLevel(level: number): number {
  return 100 * level;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (totalXp >= totalXpToReach(level + 1)) {
    level++;
  }
  return level;
}

export function rankFor(level: number): Rank {
  if (level >= 20) return "Legend";
  if (level >= 15) return "Athlete";
  if (level >= 10) return "Grinder";
  if (level >= 5) return "Regular";
  return "Starter";
}

export interface LevelProgress {
  level: number;
  rank: Rank;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

// everything the level bar on the home screen needs
export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFromXp(totalXp);
  return {
    level: level,
    rank: rankFor(level),
    xpIntoLevel: totalXp - totalXpToReach(level),
    xpForNextLevel: xpForLevel(level),
  };
}

// unlocks the user got by going from oldLevel to newLevel
export function unlocksBetween(oldLevel: number, newLevel: number): string[] {
  const result: string[] = [];
  for (const u of LEVEL_UNLOCKS) {
    if (u.level > oldLevel && u.level <= newLevel) {
      result.push(u.unlock);
    }
  }
  return result;
}
