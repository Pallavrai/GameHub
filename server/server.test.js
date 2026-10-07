import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { startRound, turn, step, aliveIds } from './rules.js';

const first = () => 0;
const round = (snakes, food = []) => ({ size: 10, rng: first, food, snakes: Object.fromEntries(Object.entries(snakes).map(([id, [body, dir]]) => [id, { body: body.map(([x, y]) => ({ x, y })), dir, pending: null, alive: true, score: 0 }])) });

test('edges wrap to the other side', () => {
  const r = round({ a: [[[9, 0], [8, 0], [7, 0]], 'right'], b: [[[5, 5], [4, 5], [3, 5]], 'right'] });
  assert.deepEqual(step(r), []);
  assert.deepEqual(r.snakes.a.body[0], { x: 0, y: 0 });
  turn(r, 'a', 'up');
  step(r);
  assert.deepEqual(r.snakes.a.body[0], { x: 0, y: 9 });
});

test('hitting another snake body kills only the attacker', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[3, 6], [3, 5], [3, 4], [3, 3]], 'down'] });
  assert.deepEqual(step(r), ['a']);
  assert.deepEqual(aliveIds(r), ['b']);
});

test('head-on collision kills both', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[4, 4], [5, 4], [6, 4]], 'left'] });
  assert.deepEqual(step(r).sort(), ['a', 'b']);
});

test('eating scores 10, grows, keeps one apple per live snake', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[2, 8], [1, 8], [0, 8]], 'right'] }, [{ x: 3, y: 4 }]);
  step(r);
  assert.equal(r.snakes.a.score, 10);
  assert.equal(r.snakes.a.body.length, 4);
  assert.equal(r.food.length, 2);
});

test('startRound gives every player a lane and an apple', () => {
  const r = startRound(['a', 'b', 'c'], { rng: first });
  assert.equal(new Set(Object.values(r.snakes).map((s) => s.body[0].y)).size, 3);
  assert.equal(r.food.length, 3);
});

test('server: create, join, colour taken, start, last snake wins', async (t) => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const srv = spawn(process.execPath, ['index.js'], { cwd: import.meta.dirname, env: { ...process.env, PORT: port } });
  t.after(() => srv.kill());
  await new Promise((ok) => srv.stdout.once('data', ok));

  const client = () =>
    new Promise((ok) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'http://localhost' });
      ws.inbox = [];
      ws.on('message', (d) => ws.inbox.push(JSON.parse(d)));
      ws.next = (pred) =>
        new Promise((done) => {
          const hit = () => ws.inbox.find(pred);
          const poll = setInterval(() => hit() && (clearInterval(poll), done(hit())), 5);
        });
      ws.on('open', () => ok(ws));
    });

  const rejected = await new Promise((ok) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'https://evil.example' });
    ws.on('error', () => ok(true));
    ws.on('open', () => ok(false));
  });
  assert.ok(rejected, 'web page origins are refused');

  const host = await client();
  host.send(JSON.stringify({ t: 'create' }));
  const { code } = await host.next((m) => m.t === 'state');
  host.send(JSON.stringify({ t: 'join', name: 'Ann', color: 'green' }));
  await host.next((m) => m.t === 'state' && m.players.length === 1);

  const guest = await client();
  guest.send(JSON.stringify({ t: 'watch', code: code.toLowerCase() }));
  await guest.next((m) => m.t === 'state');
  guest.send(JSON.stringify({ t: 'join', name: 'Bo', color: 'green' }));
  assert.match((await guest.next((m) => m.t === 'error')).msg, /color/);
  guest.send(JSON.stringify({ t: 'start' }));
  guest.send(JSON.stringify({ t: 'join', name: 'Bo', color: 'sky' }));
  await host.next((m) => m.t === 'state' && m.players.length === 2);
  assert.ok(!host.inbox.some((m) => m.phase === 'playing'), 'only the host can start');

  host.send(JSON.stringify({ t: 'start' }));
  const playing = await guest.next((m) => m.phase === 'playing');
  assert.equal(playing.snakes.length, 2);

  guest.close(); // a leaving player dies, so the host is last snake standing
  const end = await host.next((m) => m.phase === 'ended');
  const ann = end.players.find((p) => p.name === 'Ann');
  assert.equal(end.winner, ann.id);
  assert.equal(ann.wins, 1);
  assert.equal(ann.place, 1);
  const bo = end.players.find((p) => p.name === 'Bo');
  assert.ok(bo.gone && bo.place === 2, 'a player who left stays on the leaderboard');
  host.close();
});

test('last two crash head-on: both die in the same tick, so neither survives', () => {
  const r = round({ a: [[[2, 4], [1, 4], [0, 4]], 'right'], b: [[[4, 4], [5, 4], [6, 4]], 'left'] });
  const dead = step(r);
  // index.js places every same-tick death at aliveLeft + 1 → both #1, winner null (draw).
  assert.equal(aliveIds(r).length + 1, 1);
  assert.equal(dead.length, 2);
});
