// Pure multiplayer Snake rules. No sockets, no timers: index.js owns ticking.
// Edges wrap. Hitting any snake body (yours or another) or colliding head-on kills the snake.

export const SIZE = 24;
export const COLORS = ['green', 'coral', 'sky', 'yellow', 'violet', 'orange', 'pink', 'teal'];
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// One lane per player, evenly spread down the board, everyone facing east.
export function startRound(ids, { size = SIZE, rng = Math.random } = {}) {
  const snakes = {};
  ids.forEach((id, i) => {
    const y = Math.floor(((i + 0.5) * size) / ids.length);
    snakes[id] = { body: [{ x: 5, y }, { x: 4, y }, { x: 3, y }], dir: 'right', pending: null, alive: true, score: 0 };
  });
  const round = { size, rng, snakes, food: [] };
  fillFood(round);
  return round;
}

// One queued turn per tick; reversals and repeats are ignored.
export function turn(round, id, dir) {
  const s = round.snakes[id];
  if (!s?.alive || !DIRS[dir] || s.pending || dir === s.dir || dir === OPPOSITE[s.dir]) return false;
  s.pending = dir;
  return true;
}

// Moves every live snake at once. Returns the ids that died this tick.
export function step(round) {
  const { size } = round;
  const key = (c) => c.y * size + c.x;
  const live = Object.entries(round.snakes).filter(([, s]) => s.alive);
  const food = new Set(round.food.map(key));
  const next = {};
  for (const [id, s] of live) {
    if (s.pending) {
      s.dir = s.pending;
      s.pending = null;
    }
    const [dx, dy] = DIRS[s.dir];
    const h = s.body[0];
    const n = { x: (h.x + dx + size) % size, y: (h.y + dy + size) % size };
    next[id] = { n, eats: food.has(key(n)) };
  }
  // A tail cell is free on a non-growing tick because that tail moves away.
  const blocked = new Set();
  const heads = new Map();
  for (const [id, s] of live) {
    (next[id].eats ? s.body : s.body.slice(0, -1)).forEach((c) => blocked.add(key(c)));
    const k = key(next[id].n);
    heads.set(k, (heads.get(k) ?? 0) + 1);
  }
  const dead = live
    .filter(([id]) => blocked.has(key(next[id].n)) || heads.get(key(next[id].n)) > 1)
    .map(([id]) => id);
  for (const [id, s] of live) {
    if (dead.includes(id)) {
      s.alive = false;
      continue;
    }
    const { n, eats } = next[id];
    s.body.unshift(n);
    if (!eats) s.body.pop();
    else {
      s.score += 10;
      food.delete(key(n));
    }
  }
  round.food = round.food.filter((f) => food.has(key(f)));
  fillFood(round);
  return dead;
}

export function kill(round, id) {
  if (round.snakes[id]) round.snakes[id].alive = false;
}

export function aliveIds(round) {
  return Object.keys(round.snakes).filter((id) => round.snakes[id].alive);
}

// Keep one apple per live snake (at least one) on empty cells.
function fillFood(round) {
  const { size } = round;
  const want = Math.max(1, aliveIds(round).length);
  const taken = new Set(round.food.map((f) => f.y * size + f.x));
  for (const s of Object.values(round.snakes)) if (s.alive) s.body.forEach((c) => taken.add(c.y * size + c.x));
  const empty = [];
  for (let i = 0; i < size * size; i++) if (!taken.has(i)) empty.push(i);
  while (round.food.length < want && empty.length) {
    const [i] = empty.splice(Math.floor(round.rng() * empty.length), 1);
    round.food.push({ x: i % size, y: Math.floor(i / size) });
  }
}
