export const AVATARS = [
  { id: 'initials', name: 'Classic', colors: ['#646464', '#646464'] },
  { id: 'pink', name: 'Pink', colors: ['#F3A7EF', '#FF6DB8'] },
  { id: 'mint', name: 'Mint', colors: ['#06C38B', '#B5EDDD'] },
  { id: 'orange', name: 'Ember', colors: ['#FF6500', '#FFAA75'] },
  { id: 'lime', name: 'Electric', colors: ['#09FB8B', '#CEFF32'] },
  { id: 'aqua', name: 'Aqua', colors: ['#63F5FF', '#00BFC4'] },
] as const;

export const FRAMES = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Starter frame',
    colors: ['#AFF0DF', '#AFF0DF'],
  },
  {
    id: 'flare',
    name: 'Flare',
    description: '12 day streak reward',
    colors: ['#FF0000', '#FFAA75'],
  },
  {
    id: 'orbit',
    name: 'Orbit',
    description: 'Level 10 reward',
    colors: ['#174FC5', '#7124FF'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Level 15 reward',
    colors: ['#F3A7EF', '#AE79EB'],
  },
] as const;

export type AvatarId = (typeof AVATARS)[number]['id'];
export type FrameId = (typeof FRAMES)[number]['id'];

export function getAvatar(id: string) {
  return AVATARS.find(item => item.id === id) ?? AVATARS[0];
}

export function getFrame(id: string) {
  return FRAMES.find(item => item.id === id) ?? FRAMES[0];
}