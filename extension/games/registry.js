// Bundled games only. `load` must be a static local import, never a user-supplied path.
export const games = [
  {
    id: 'snake',
    title: 'Snake',
    description: 'Eat apples, grow longer, avoid the walls.',
    cover: '/assets/art/snake-cover.png',
    load: () => import('./snake/index.js'),
  },
];
