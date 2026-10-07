// GameHub multiplayer Snake relay. Authoritative: clients send turns, the server decides every move and death.
// ponytail: rooms live in memory, so this must run as ONE instance (Cloud Run --max-instances=1). Move rooms to Redis if it ever needs more.
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { SIZE, COLORS, startRound, turn, step, kill, aliveIds } from './rules.js';

const PORT = Number(process.env.PORT) || 8080;
const TICK_MS = 130;
const LOBBY_MS = Number(process.env.LOBBY_MS) || 5 * 60_000; // host forgot to press Start → auto-start
const ENDED_MS = 5 * 60_000; // no rematch → close the room so idle sockets don't keep the server billed
const MAX_ROOMS = 200;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const rooms = new Map();

const server = http.createServer((req, res) => res.writeHead(200, { 'content-type': 'text/plain' }).end('GameHub snake server\n'));
const wss = new WebSocketServer({
  server,
  maxPayload: 512,
  // Browsers always send Origin; only the extension (or a localhost dev page) may connect.
  verifyClient: ({ origin }) => /^(chrome-extension:\/\/[a-p]{32}|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin ?? ''),
});

const send = (ws, msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

function newCode() {
  let code;
  do code = Array.from(crypto.randomBytes(5), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  while (rooms.has(code));
  return code;
}

function snapshot(room) {
  const r = room.round;
  return {
    t: 'state',
    code: room.code,
    phase: room.phase,
    host: room.host?.id ?? null,
    endsIn: room.deadline ? Math.max(0, room.deadline - Date.now()) : null,
    size: SIZE,
    winner: room.winner,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      wins: p.wins,
      place: p.place,
      gone: Boolean(p.gone),
      score: r?.snakes[p.id]?.score ?? 0,
      alive: Boolean(r?.snakes[p.id]?.alive),
      inRound: Boolean(r?.snakes[p.id]),
    })),
    snakes: r ? Object.entries(r.snakes).filter(([, s]) => s.alive).map(([id, s]) => ({ id, dir: s.dir, body: s.body.map((c) => [c.x, c.y]) })) : [],
    food: r ? r.food.map((f) => [f.x, f.y]) : [],
  };
}

function broadcast(room) {
  const msg = JSON.stringify(snapshot(room));
  for (const ws of room.clients) if (ws.readyState === ws.OPEN) ws.send(msg);
}

function setDeadline(room, ms, fn) {
  clearTimeout(room.timer);
  room.deadline = Date.now() + ms;
  room.timer = setTimeout(fn, ms);
}

function closeRoom(room, reason) {
  clearTimeout(room.timer);
  clearInterval(room.loop);
  rooms.delete(room.code);
  for (const ws of room.clients) {
    send(ws, { t: 'closed', reason });
    ws.room = null;
    ws.close();
  }
}

function openLobby(room) {
  clearInterval(room.loop);
  room.phase = 'lobby';
  room.round = null;
  room.winner = null;
  for (const [id, p] of room.players) {
    p.place = null;
    if (p.gone) room.players.delete(id); // left during the last match; frees their name and colour
  }
  setDeadline(room, LOBBY_MS, () => {
    if (room.players.size >= 2) startMatch(room);
    else closeRoom(room, 'Not enough players joined within 5 minutes.');
  });
}

function startMatch(room) {
  clearTimeout(room.timer);
  room.deadline = null;
  room.phase = 'playing';
  room.winner = null;
  for (const p of room.players.values()) p.place = null;
  room.round = startRound([...room.players.keys()]);
  room.loop = setInterval(() => {
    placeDead(room, step(room.round));
    broadcast(room);
  }, TICK_MS);
  broadcast(room);
}

// Everyone who dies in the same tick shares a place. Last snake standing wins; nobody left is a draw.
function placeDead(room, dead) {
  if (room.phase !== 'playing') return;
  const left = aliveIds(room.round);
  for (const id of dead) {
    const p = room.players.get(id);
    if (p) p.place = left.length + 1;
  }
  if (left.length > 1) return;
  clearInterval(room.loop);
  room.phase = 'ended';
  const champ = left[0] && room.players.get(left[0]);
  if (champ) {
    champ.place = 1;
    champ.wins += 1;
    room.winner = champ.id;
  }
  setDeadline(room, ENDED_MS, () => closeRoom(room, 'Room closed after 5 minutes without a rematch.'));
}

function cleanName(name) {
  return typeof name === 'string' ? name.replace(/[\p{C}]/gu, '').trim().slice(0, 16) : '';
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  room.clients.delete(ws);
  if (room.players.has(ws.id)) {
    if (room.phase === 'playing' && room.round.snakes[ws.id]?.alive) {
      kill(room.round, ws.id);
      placeDead(room, [ws.id]);
    }
    // Keep them on this match's leaderboard; openLobby drops them.
    if (room.round?.snakes[ws.id]) room.players.get(ws.id).gone = true;
    else room.players.delete(ws.id);
  }
  if (!room.clients.size) return closeRoom(room, 'empty');
  if (room.host === ws) room.host = [...room.clients].find((c) => room.players.has(c.id)) ?? [...room.clients][0];
  if (room.phase === 'lobby') room.players.forEach((p, id) => p.gone && room.players.delete(id));
  broadcast(room);
}

function enter(ws, room) {
  leave(ws);
  ws.room = room;
  room.clients.add(ws);
  send(ws, { t: 'you', id: ws.id, colors: COLORS });
  broadcast(room);
}

const handlers = {
  create(ws) {
    if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', msg: 'Server is full, try again later.' });
    const room = { code: newCode(), clients: new Set(), players: new Map(), host: ws, phase: 'lobby' };
    rooms.set(room.code, room);
    openLobby(room);
    enter(ws, room);
  },
  watch(ws, { code }) {
    const room = rooms.get(String(code ?? '').toUpperCase().trim());
    if (!room) return send(ws, { t: 'error', msg: 'No room with that code.' });
    enter(ws, room);
  },
  join(ws, { name, color }) {
    const room = ws.room;
    if (!room) return;
    name = cleanName(name);
    const players = [...room.players.values()];
    let err;
    if (room.players.has(ws.id)) err = 'You already joined.';
    else if (!name) err = 'Enter a name.';
    else if (players.length >= COLORS.length) err = 'Room is full.';
    else if (!COLORS.includes(color)) err = 'Pick a color.';
    else if (players.some((p) => p.color === color)) err = 'That color was just taken. Pick another.';
    else if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) err = 'That name is taken in this room.';
    if (err) return send(ws, { t: 'error', msg: err });
    // Joining mid-match is allowed: you spectate until the next round.
    room.players.set(ws.id, { id: ws.id, name, color, wins: 0, place: null });
    broadcast(room);
  },
  start(ws) {
    const room = ws.room;
    if (room?.host !== ws || room.phase !== 'lobby') return;
    if (room.players.size < 2) return send(ws, { t: 'error', msg: 'Need at least 2 players.' });
    startMatch(room);
  },
  rematch(ws) {
    const room = ws.room;
    if (room?.host !== ws || room.phase !== 'ended') return;
    openLobby(room);
    broadcast(room);
  },
  turn(ws, { dir }) {
    const room = ws.room;
    if (room?.phase === 'playing') turn(room.round, ws.id, dir);
  },
  leave,
};

wss.on('connection', (ws) => {
  ws.id = crypto.randomUUID().slice(0, 8);
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (Object.hasOwn(handlers, msg?.t)) handlers[msg.t](ws, msg);
  });
  ws.on('close', () => leave(ws));
});

// Drop dead connections so empty rooms close and the instance can scale to zero.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate();
    ws.alive = false;
    ws.ping();
  }
}, 30_000).unref();

server.listen(PORT, () => console.log(`snake server on :${PORT}`));
