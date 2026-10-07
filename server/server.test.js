import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import { MAX_PLAYERS, startRound, turn, step, aliveIds } from './rules.js';

const first = () => 0;
// round({ id: [[[x, y], ...body], dir, turnedAt] }, food)
const round = (snakes, food = []) => ({
  size: 10,
  rng: first,
  tick: 10,
  food,
  snakes: Object.fromEntries(
    Object.entries(snakes).map(([id, [body, dir, turnedAt = 0]]) => [id, { body: body.map(([x, y]) => ({ x, y })), dir, queue: [], turnedAt, alive: true, score: 0 }]),
  ),
});

test('edges wrap to the other side', () => {
  const r = round({ a: [[[9, 0], [8, 0], [7, 0]], 'right'], b: [[[5, 5], [4, 5], [3, 5]], 'right'] });
  assert.deepEqual(step(r), []);
  assert.deepEqual(r.snakes.a.body[0], { x: 0, y: 0 });
  turn(r, 'a', 'up');
  step(r);
  assert.deepEqual(r.snakes.a.body[0], { x: 0, y: 9 });
});

test('hitting another snake body kills only the hitter', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[3, 6], [3, 5], [3, 4], [3, 3]], 'down'] });
  assert.deepEqual(step(r), ['a']);
  assert.deepEqual(aliveIds(r), ['b']);
});

test('head-on into the same cell kills both', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[4, 4], [5, 4], [6, 4]], 'left'] });
  assert.deepEqual(step(r).sort(), ['a', 'b']);
});

test('head-on swapping places kills both', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[3, 4], [4, 4], [5, 4]], 'left'] });
  assert.deepEqual(step(r).sort(), ['a', 'b']);
});

test('ramming the side of a head that moves on kills only the rammer', () => {
  // b's head leaves (3,4) this tick but its neck stays there, so a dies and b lives.
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[3, 4], [3, 3], [3, 2]], 'down'] });
  assert.deepEqual(step(r), ['a']);
});

test('side hit into the same cell: the snake that turned onto that course last dies', () => {
  // Both heads enter (3,4). b turned down at tick 9, after a set off right at tick 2.
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right', 2], b: [[[3, 3], [3, 2], [3, 1]], 'down', 9] });
  assert.deepEqual(step(r), ['b']);
  assert.deepEqual(r.snakes.a.body[0], { x: 3, y: 4 });
  // Turning this very tick also counts as the latest move.
  const r2 = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right', 2], b: [[[3, 3], [2, 3], [1, 3]], 'right', 5] });
  turn(r2, 'b', 'down');
  assert.deepEqual(step(r2), ['b']);
});

test('side hit when both turned on the same tick kills both', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right', 9], b: [[[3, 3], [3, 2], [3, 1]], 'down', 9] });
  assert.deepEqual(step(r).sort(), ['a', 'b']);
});

test('two quick turns inside one tick both apply; reversal through the queue is blocked', () => {
  const r = round({ a: [[[5, 5], [4, 5], [3, 5]], 'right'], b: [[[5, 1], [4, 1], [3, 1]], 'right'] });
  assert.equal(turn(r, 'a', 'up'), true);
  assert.equal(turn(r, 'a', 'down'), false, 'up then down would reverse');
  assert.equal(turn(r, 'a', 'left'), true);
  step(r);
  step(r);
  assert.deepEqual(r.snakes.a.body.slice(0, 2), [{ x: 4, y: 4 }, { x: 5, y: 4 }]);
  assert.equal(r.snakes.a.dir, 'left');
});

test('eating scores 10, grows, keeps one apple per live snake', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[2, 8], [1, 8], [0, 8]], 'right'] }, [{ x: 3, y: 4 }]);
  step(r);
  assert.equal(r.snakes.a.score, 10);
  assert.equal(r.snakes.a.body.length, 4);
  assert.equal(r.food.length, 2);
});

test('player cap follows the board: one 4-row lane each', () => {
  assert.equal(MAX_PLAYERS, 6);
  const r = startRound(['a', 'b', 'c', 'd', 'e', 'f'], { rng: first });
  assert.deepEqual(Object.values(r.snakes).map((s) => s.body[0].y), [2, 6, 10, 14, 18, 22]);
  assert.equal(r.food.length, 6);
});

// ---------- real server process ----------

function client(port) {
  return new Promise((ok, fail) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'http://localhost' });
    ws.inbox = [];
    ws.on('message', (d) => ws.inbox.push(JSON.parse(d)));
    // wait(pred, from): first message at index >= from that matches.
    ws.wait = (pred, from = 0) =>
      new Promise((done, timeout) => {
        const t0 = Date.now();
        const poll = setInterval(() => {
          const hit = ws.inbox.slice(from).find(pred);
          if (hit) done(hit, clearInterval(poll));
          else if (Date.now() - t0 > 4000) timeout(new Error('timed out waiting'), clearInterval(poll));
        }, 5);
      });
    ws.ask = (msg, pred) => {
      const from = ws.inbox.length;
      ws.send(JSON.stringify(msg));
      return ws.wait(pred, from);
    };
    ws.on('open', () => ok(ws));
    ws.on('error', fail);
  });
}

async function startServer(t, env = {}) {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const srv = spawn(process.execPath, ['index.js'], { cwd: import.meta.dirname, env: { ...process.env, K_SERVICE: '', PORT: port, ...env } });
  t.after(() => srv.kill());
  await new Promise((ok) => srv.stdout.once('data', ok));
  return port;
}

const key = () => crypto.randomUUID();
const state = (pred = () => true) => (m) => m.t === 'state' && pred(m);

test('server: rooms, colours, host-only start, reconnect, grace expiry, global leaderboard', async (t) => {
  const port = await startServer(t, { GRACE_MS: '400', RANKED_MS: '0' });

  const refused = await new Promise((ok) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'https://evil.example' });
    ws.on('error', () => ok(true));
    ws.on('open', () => ok(false));
  });
  assert.ok(refused, 'web page origins are refused');

  const host = await client(port);
  const { code } = await host.ask({ t: 'create' }, state());
  const hostKey = key();
  await host.ask({ t: 'join', name: 'Ann', color: 'green', key: hostKey }, state((m) => m.players.length === 1));

  const guest = await client(port);
  await guest.ask({ t: 'watch', code: code.toLowerCase() }, state());
  const { token } = await guest.wait((m) => m.t === 'you');
  assert.match((await guest.ask({ t: 'join', name: 'Bo', color: 'green', key: key() }, (m) => m.t === 'error')).msg, /color/);
  const guestKey = key();
  await guest.ask({ t: 'join', name: 'Bo', color: 'sky', key: guestKey }, state((m) => m.players.length === 2));
  const from = host.inbox.length;
  guest.send(JSON.stringify({ t: 'start' }));
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(!host.inbox.slice(from).some((m) => m.phase === 'playing'), 'only the host can start');

  await host.ask({ t: 'start' }, state((m) => m.phase === 'playing'));

  // Connection drops mid-match, then resumes with its token: same seat, snake still alive.
  guest.terminate();
  await host.wait(state((m) => m.players.find((p) => p.name === 'Bo')?.offline), host.inbox.length - 1);
  const back = await client(port);
  const resumed = await back.ask({ t: 'resume', token }, state());
  const bo = resumed.players.find((p) => p.name === 'Bo');
  assert.ok(bo.alive && !bo.offline && !bo.gone, 'resumed player keeps their snake');
  assert.equal((await back.wait((m) => m.t === 'you')).id, bo.id);
  await back.ask({ t: 'turn', dir: 'up' }, state((m) => m.snakes.find((s) => s.id === bo.id)?.dir === 'up'));

  // A second drop without resuming: after the grace period the snake is out and the host wins.
  back.terminate();
  const end = await host.wait(state((m) => m.phase === 'ended'));
  const ann = end.players.find((p) => p.name === 'Ann');
  assert.equal(end.winner, ann.id);
  assert.equal(ann.wins, 1);
  assert.equal(end.players.find((p) => p.name === 'Bo').place, 2);

  const expired = await client(port);
  assert.equal((await expired.ask({ t: 'resume', token }, (m) => m.t === 'expired')).t, 'expired', 'a lapsed seat cannot be resumed');

  await new Promise((r) => setTimeout(r, 100)); // leaderboard write is async
  const res = await fetch(`http://127.0.0.1:${port}/leaderboard`);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const { top } = await res.json();
  assert.deepEqual(top.map((p) => [p.name, p.wins]), [['Ann', 1], ['Bo', 0]]);
  assert.ok(!JSON.stringify(top).includes(hostKey), 'raw player keys never leave the server');
  [host, expired].forEach((ws) => ws.close());
});

test('server: room is full at the board cap; short matches are not ranked', async (t) => {
  const port = await startServer(t); // default RANKED_MS: 15 s
  const players = await Promise.all(Array.from({ length: MAX_PLAYERS + 1 }, () => client(port)));
  const [host, ...rest] = players;
  const { code } = await host.ask({ t: 'create' }, state());
  const colors = ['green', 'coral', 'sky', 'yellow', 'violet', 'orange', 'pink'];
  await host.ask({ t: 'join', name: 'P0', color: colors[0], key: key() }, state());
  for (const ws of rest) await ws.ask({ t: 'watch', code }, state());
  for (const [i, ws] of rest.slice(0, MAX_PLAYERS - 1).entries()) {
    await ws.ask({ t: 'join', name: `P${i + 1}`, color: colors[i + 1], key: key() }, state((m) => m.players.length === i + 2));
  }
  const err = await rest.at(-1).ask({ t: 'join', name: 'Late', color: 'pink', key: key() }, (m) => m.t === 'error');
  assert.match(err.msg, /full/);

  await host.ask({ t: 'start' }, state((m) => m.phase === 'playing'));
  rest.slice(0, MAX_PLAYERS - 1).forEach((ws) => ws.send(JSON.stringify({ t: 'leave' })));
  await host.wait(state((m) => m.phase === 'ended'));
  const { top } = await (await fetch(`http://127.0.0.1:${port}/leaderboard`)).json();
  assert.deepEqual(top, [], 'an instant forfeit does not count');
  players.forEach((ws) => ws.close());
});

test('server: one browser holding two seats can play, but the match is not ranked', async (t) => {
  const port = await startServer(t, { RANKED_MS: '0' });
  const [a, b] = await Promise.all([client(port), client(port)]);
  const same = key();
  const { code } = await a.ask({ t: 'create' }, state());
  await a.ask({ t: 'join', name: 'Me', color: 'green', key: same }, state());
  await b.ask({ t: 'watch', code }, state());
  await b.ask({ t: 'join', name: 'Me too', color: 'sky', key: same }, state((m) => m.players.length === 2));
  await a.ask({ t: 'start' }, state((m) => m.phase === 'playing'));
  b.send(JSON.stringify({ t: 'leave' }));
  await a.wait(state((m) => m.phase === 'ended'));
  await new Promise((r) => setTimeout(r, 100));
  const { top } = await (await fetch(`http://127.0.0.1:${port}/leaderboard`)).json();
  assert.deepEqual(top, []);
  [a, b].forEach((ws) => ws.close());
});
