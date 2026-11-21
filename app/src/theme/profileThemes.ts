export type ThemeId =
  | 'default'
  | 'ember'
  | 'tide'
  | 'energetic'
  | 'aurora'
  | 'abyss'
  | 'vivid_orchid';

export type ProfileTheme = {
  id: ThemeId;
  name: string;
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
  minimumLevel: number;
};

// Gradient colors other than Default are approximations
// from the Figma screenshots and can be tuned here.
export const PROFILE_THEMES: ProfileTheme[] = [
  {
    id: 'default',
    name: 'Default',
    colors: ['#06C38B', '#006868'],
    locations: [0, 1],
    minimumLevel: 1,
  },
  {
    id: 'ember',
    name: 'Blazing',
    colors: ['#E13305', '#F67131', '#FFF6AA'],
    locations: [0, 0.5, 1],
    minimumLevel: 1,
  },
  {
    id: 'tide',
    name: 'Sea Silk',
    colors: ['#02518A', '#51A5C5', '#A0BFFF'],
    locations: [0.02, 0.5, 1],
    minimumLevel: 1,
  },
  {
    id: 'energetic',
    name: 'Energetic',
    colors: ['#D295FC', '#FF497B', '#D8FFA4'],
    locations: [0, 0.5, 1],
    minimumLevel: 1,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    colors: ['#F3A7EF', '#028A8A', '#EAFEBF'],
    locations: [0, 0.56, 1],
    minimumLevel: 15,
  },
  {
    id: 'abyss',
    name: 'Abyss',
    colors: ['#1F4F8A', '#0D3E73', '#71E6EF'],
    locations: [0, 0.5, 1],
    minimumLevel: 20,
  },
  {
    id: 'vivid_orchid',
    name: 'Vivid Orchid',
    colors: ['#57122D', '#CB3A86', '#F6B8DC'],
    locations: [0, 0.5, 1],
    minimumLevel: 25,
  },
];

export function getProfileTheme(
  id: string | null | undefined
): ProfileTheme {
  return (
    PROFILE_THEMES.find(theme => theme.id === id) ??
    PROFILE_THEMES[0]
  );
}

export function canUseTheme(
  theme: ProfileTheme,
  level: number
): boolean {
  return level >= theme.minimumLevel;
}