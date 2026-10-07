// Pure Snake rules. No DOM, no timers: the caller owns ticking and rendering.

export const SIZE = 20;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function createSnake({ size = SIZE, rng = Math.random, snake, dir = 'right' } = {}) {
  const c = Math.floor(size / 2);
  const game = {
    size,
    rng,
    snake: snake ?? [{ x: c, y: c }, { x: c - 1, y: c }, { x: c - 2, y: c }],
    dir,
    pending: null,
    score: 0,
    apples: 0,
    status: 'playing', // 'playing' | 'over' | 'won'
    food: null,
  };
  game.food = placeFood(game);
  return game;
}

// One queued turn per tick; reversals and repeats are ignored.
export function turn(game, dir) {
  if (!DIRS[dir] || game.pending || dir === game.dir || dir === OPPOSITE[game.dir]) return false;
  game.pending = dir;
  return true;
}

export function step(game) {
  if (game.status !== 'playing') return;
  if (game.pending) {
    game.dir = game.pending;
    game.pending = null;
  }
  const [dx, dy] = DIRS[game.dir];
  const next = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };
  const eats = game.food && next.x === game.food.x && next.y === game.food.y;
  // The tail cell is free on a non-growing tick because the tail moves away.
  const body = eats ? game.snake : game.snake.slice(0, -1);
  if (
    next.x < 0 || next.y < 0 || next.x >= game.size || next.y >= game.size ||
    body.some((s) => s.x === next.x && s.y === next.y)
  ) {
    game.status = 'over';
    return;
  }
  game.snake.unshift(next);
  if (!eats) {
    game.snake.pop();
    return;
  }
  game.score += 10;
  game.apples += 1;
  game.food = placeFood(game);
  if (!game.food) game.status = 'won';
}

export function tickMs(game) {
  return Math.max(80, 140 - 5 * Math.floor(game.apples / 5));
}

function placeFood(game) {
  const taken = new Set(game.snake.map((s) => s.y * game.size + s.x));
  const empty = [];
  for (let i = 0; i < game.size * game.size; i++) if (!taken.has(i)) empty.push(i);
  if (!empty.length) return null;
  const i = empty[Math.floor(game.rng() * empty.length)];
  return { x: i % game.size, y: Math.floor(i / game.size) };
}
