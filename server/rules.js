// Pure multiplayer Snake rules. No sockets, no timers: index.js owns ticking.
// Edges wrap. A head entering any snake body dies (that snake is the one hitting).
// Two heads entering one cell: facing each other (head-on) kills both; from the side, only the hitter dies.

export const SIZE = 24;
export const COLORS = ['green', 'coral', 'sky', 'yellow', 'violet', 'orange', 'pink', 'teal'];
// One 4-row lane per snake keeps spawns apart, so the board size sets the cap (24 → 6 players).
export const MAX_PLAYERS = Math.min(COLORS.length, Math.floor(SIZE / 4));
const QUEUE = 3; // buffered turns: quick double-taps inside one tick both count
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// One lane per player, evenly spread down the board, everyone facing east.
export function startRound(ids, { size = SIZE, rng = Math.random } = {}) {
  const snakes = {};
  ids.forEach((id, i) => {
    const y = Math.floor(((i + 0.5) * size) / ids.length);
    snakes[id] = { body: [{ x: 5, y }, { x: 4, y }, { x: 3, y }], dir: 'right', queue: [], turnedAt: 0, alive: true, score: 0 };
  });
  const round = { size, rng, snakes, food: [], tick: 0 };
  fillFood(round);
  return round;
}

// Queues a turn; checked against the last queued direction so no sequence of taps can reverse the snake.
export function turn(round, id, dir) {
  const s = round.snakes[id];
  if (!s?.alive || !DIRS[dir] || s.queue.length >= QUEUE) return false;
  const last = s.queue.at(-1) ?? s.dir;
  if (dir === last || dir === OPPOSITE[last]) return false;
  s.queue.push(dir);
  return true;
}

// Moves every live snake at once. Returns the ids that died this tick.
export function step(round) {
  const { size } = round;
  const tick = ++round.tick;
  const key = (c) => c.y * size + c.x;
  const live = Object.entries(round.snakes).filter(([, s]) => s.alive);
  const food = new Set(round.food.map(key));
  const next = {};
  for (const [id, s] of live) {
    if (s.queue.length) {
      s.dir = s.queue.shift();
      s.turnedAt = tick;
    }
    const [dx, dy] = DIRS[s.dir];
    const h = s.body[0];
    const n = { x: (h.x + dx + size) % size, y: (h.y + dy + size) % size };
    next[id] = { n, k: key(n), eats: food.has(key(n)) };
  }
  // A tail cell is free on a non-growing tick because that tail moves away.
  // A head that stays put this tick is never free, so swapping places head-on kills both.
  const blocked = new Set();
  const into = new Map(); // cell → ids whose heads enter it
  for (const [id, s] of live) {
    (next[id].eats ? s.body : s.body.slice(0, -1)).forEach((c) => blocked.add(key(c)));
    into.set(next[id].k, [...(into.get(next[id].k) ?? []), id]);
  }
  const dead = live.map(([id]) => id).filter((id) => blocked.has(next[id].k) || hits(round, id, into.get(next[id].k)));
  for (const [id, s] of live) {
    if (dead.includes(id)) {
      s.alive = false;
      continue;
    }
    const { n, k, eats } = next[id];
    s.body.unshift(n);
    if (!eats) s.body.pop();
    else {
      s.score += 10;
      food.delete(k);
    }
  }
  round.food = round.food.filter((f) => food.has(key(f)));
  fillFood(round);
  return dead;
}

// Sharing a cell with another head: head-on (opposite directions) both lose. From the side, the snake that
// turned onto this course most recently steered into the other, so it is the hitter. Turning on the same
// tick is a mutual crash.
function hits(round, id, rivals) {
  const me = round.snakes[id];
  return rivals.some((other) => {
    if (other === id) return false;
    const them = round.snakes[other];
    return them.dir === OPPOSITE[me.dir] || me.turnedAt >= them.turnedAt;
  });
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
