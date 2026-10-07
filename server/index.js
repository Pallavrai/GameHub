// GameHub multiplayer Snake relay. Authoritative: clients send turns, the server decides every move and death.
// ponytail: rooms live in memory, so this must run as ONE instance (Cloud Run --max-instances=1). Move rooms to Redis if it ever needs more.
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { SIZE, COLORS, MAX_PLAYERS, startRound, turn, step, kill, aliveIds } from './rules.js';
import { recordMatch, topPlayers } from './stats.js';

const env = (name, fallback) => Number(process.env[name] ?? fallback);
const PORT = env('PORT', 8080);
const TICK_MS = 160;
const LOBBY_MS = env('LOBBY_MS', 5 * 60_000); // host forgot to press Start → auto-start
const ENDED_MS = 5 * 60_000; // no rematch → close the room so idle sockets don't keep the server billed
const GRACE_MS = env('GRACE_MS', 20_000); // a dropped connection keeps its seat this long, so it can resume
const RANKED_MS = env('RANKED_MS', 15_000); // shorter matches (instant forfeits) don't count on the global board
const MAX_ROOMS = 200;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const rooms = new Map();
const sessions = new Map(); // resume token → { id, token, ws, room, timer }

const server = http.createServer(async (req, res) => {
  if (new URL(req.url, 'http://x').pathname !== '/leaderboard') {
    return res.writeHead(200, { 'content-type': 'text/plain' }).end('GameHub snake server\n');
  }
  const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  try {
    res.writeHead(200, headers).end(JSON.stringify({ top: await topPlayers() }));
  } catch (e) {
    console.error('leaderboard read failed:', e.message);
    res.writeHead(503, headers).end('{"top":null}');
  }
});

const wss = new WebSocketServer({
  server,
  maxPayload: 512,
  // Browsers always send Origin; only the extension (or a localhost dev page) may connect.
  verifyClient: ({ origin }) => /^(chrome-extension:\/\/[a-p]{32}|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin ?? ''),
});

const send = (s, msg) => s.ws?.readyState === 1 && s.ws.send(JSON.stringify(msg));
const you = (s) => send(s, { t: 'you', id: s.id, token: s.token, colors: COLORS, max: MAX_PLAYERS });
const seated = (room) => [...room.players.values()].filter((p) => !p.gone);

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
    host: room.hostId,
    max: MAX_PLAYERS,
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
      offline: !p.session.ws,
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
  for (const s of room.members) if (s.ws?.readyState === 1) s.ws.send(msg);
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
  for (const s of room.members) {
    send(s, { t: 'closed', reason });
    s.room = null;
    clearTimeout(s.timer);
    if (s.ws) s.ws.close();
    else sessions.delete(s.token);
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
  room.startedAt = Date.now();
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
  if (Date.now() - room.startedAt >= RANKED_MS) rank(room);
  setDeadline(room, ENDED_MS, () => closeRoom(room, 'Room closed after 5 minutes without a rematch.'));
}

function rank(room) {
  const rows = [...room.players.values()]
    .filter((p) => p.statsId && room.round.snakes[p.id])
    .map((p) => ({ id: p.statsId, name: p.name, points: room.round.snakes[p.id].score, win: p.id === room.winner ? 1 : 0 }));
  // One browser in two windows (testing, or farming wins against yourself) plays fine but isn't ranked.
  if (new Set(rows.map((r) => r.id)).size !== rows.length) return;
  recordMatch(rows).catch((e) => console.error('leaderboard write failed:', e.message));
}

function cleanName(name) {
  return typeof name === 'string' ? name.replace(/[\p{C}]/gu, '').trim().slice(0, 16) : '';
}

function leave(s) {
  const room = s.room;
  if (!room) return;
  s.room = null;
  clearTimeout(s.timer);
  room.members.delete(s);
  const p = room.players.get(s.id);
  if (p) {
    if (room.phase === 'playing' && room.round.snakes[p.id]?.alive) {
      kill(room.round, p.id);
      placeDead(room, [p.id]);
    }
    // Keep them on this match's leaderboard; openLobby drops them.
    if (room.round?.snakes[p.id]) p.gone = true;
    else room.players.delete(p.id);
  }
  if (!room.members.size) return closeRoom(room, 'empty');
  if (room.hostId === s.id) room.hostId = ([...room.members].find((m) => room.players.has(m.id)) ?? [...room.members][0]).id;
  broadcast(room);
}

function enter(s, room) {
  leave(s);
  s.room = room;
  room.members.add(s);
  broadcast(room);
}

const handlers = {
  create(s) {
    if (rooms.size >= MAX_ROOMS) return send(s, { t: 'error', msg: 'Server is full, try again later.' });
    const room = { code: newCode(), members: new Set(), players: new Map(), hostId: s.id, phase: 'lobby' };
    rooms.set(room.code, room);
    openLobby(room);
    enter(s, room);
  },
  watch(s, { code }) {
    const room = rooms.get(String(code ?? '').toUpperCase().trim());
    if (!room) return send(s, { t: 'error', msg: 'No room with that code.' });
    enter(s, room);
  },
  join(s, { name, color, key }) {
    const room = s.room;
    if (!room) return;
    name = cleanName(name);
    // The raw key stays private to its browser; only its hash names the leaderboard entry.
    const statsId = typeof key === 'string' && key.length >= 16 && key.length <= 64 ? crypto.createHash('sha256').update(key).digest('hex').slice(0, 32) : null;
    const players = seated(room);
    let err;
    if (room.players.has(s.id)) err = 'You already joined.';
    else if (!name) err = 'Enter a name.';
    else if (players.length >= MAX_PLAYERS) err = `Room is full (${MAX_PLAYERS} players max).`;
    else if (!COLORS.includes(color)) err = 'Pick a color.';
    else if (players.some((p) => p.color === color)) err = 'That color was just taken. Pick another.';
    else if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) err = 'That name is taken in this room.';
    if (err) return send(s, { t: 'error', msg: err });
    // Joining mid-match is allowed: you spectate until the next round.
    room.players.set(s.id, { id: s.id, session: s, name, color, statsId, wins: 0, place: null });
    broadcast(room);
  },
  start(s) {
    const room = s.room;
    if (room?.hostId !== s.id || room.phase !== 'lobby') return;
    if (room.players.size < 2) return send(s, { t: 'error', msg: 'Need at least 2 players.' });
    startMatch(room);
  },
  rematch(s) {
    const room = s.room;
    if (room?.hostId !== s.id || room.phase !== 'ended') return;
    openLobby(room);
    broadcast(room);
  },
  turn(s, { dir }) {
    const room = s.room;
    if (room?.phase === 'playing') turn(room.round, s.id, dir);
  },
  leave,
};

// A reconnecting client sends its resume token first; the session (seat, host role, snake) carries over.
function resume(ws, token) {
  const s = sessions.get(token);
  if (!s?.room) return ws.send(JSON.stringify({ t: 'expired' }));
  clearTimeout(s.timer);
  if (s.ws && s.ws !== ws) {
    s.ws.session = null;
    s.ws.close();
  }
  s.ws = ws;
  ws.session = s;
  you(s);
  broadcast(s.room);
}

function drop(s) {
  s.ws = null;
  if (!s.room) return sessions.delete(s.token);
  // The snake keeps moving while its player is away; the seat is given up only after the grace period.
  s.timer = setTimeout(() => {
    sessions.delete(s.token);
    leave(s);
  }, GRACE_MS);
  broadcast(s.room);
}

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg?.t === 'resume' && !ws.session) return resume(ws, String(msg.token));
    if (!Object.hasOwn(handlers, msg?.t)) return;
    if (!ws.session) {
      ws.session = { id: crypto.randomUUID().slice(0, 8), token: crypto.randomBytes(16).toString('hex'), ws, room: null };
      sessions.set(ws.session.token, ws.session);
      you(ws.session);
    }
    handlers[msg.t](ws.session, msg);
  });
  ws.on('close', () => ws.session && drop(ws.session));
});

// Drop dead connections so seats free up and the instance can scale to zero.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate();
    ws.alive = false;
    ws.ping();
  }
}, 30_000).unref();

server.listen(PORT, () => console.log(`snake server on :${PORT}`));
