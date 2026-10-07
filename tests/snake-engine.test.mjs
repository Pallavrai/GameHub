import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnake, turn, step, tickMs } from '../extension/games/snake/engine.js';

const first = () => 0; // always pick the first empty cell

test('starts length 3 at the center facing east, food on an empty cell', () => {
  const g = createSnake({ rng: first });
  assert.deepEqual(g.snake, [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  assert.equal(g.dir, 'right');
  assert.deepEqual(g.food, { x: 0, y: 0 });
});

test('rejects reversal, including two fast keys inside one tick', () => {
  const g = createSnake({ rng: first });
  assert.equal(turn(g, 'left'), false);
  assert.equal(turn(g, 'up'), true);
  assert.equal(turn(g, 'left'), false, 'second key in the same tick is ignored');
  step(g);
  assert.equal(g.dir, 'up');
  assert.deepEqual(g.snake[0], { x: 10, y: 9 });
  assert.equal(g.status, 'playing');
});

test('eating grows by one, scores 10, and respawns food', () => {
  const g = createSnake({ rng: first });
  g.food = { x: 11, y: 10 };
  step(g);
  assert.equal(g.snake.length, 4);
  assert.equal(g.score, 10);
  assert.ok(!g.snake.some((s) => s.x === g.food.x && s.y === g.food.y));
});

test('wall collision ends the run', () => {
  const g = createSnake({ size: 5, rng: first, snake: [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }] });
  step(g);
  assert.equal(g.status, 'over');
  step(g);
  assert.deepEqual(g.snake[0], { x: 4, y: 2 }, 'no movement after game over');
});

test('self collision ends the run', () => {
  const snake = [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }];
  const g = createSnake({ size: 5, rng: first, snake, dir: 'up' });
  turn(g, 'left');
  step(g);
  assert.equal(g.status, 'over');
});

test('moving into the vacating tail cell is legal', () => {
  const snake = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }];
  const g = createSnake({ size: 5, rng: first, snake, dir: 'up' });
  turn(g, 'left');
  step(g);
  assert.equal(g.status, 'playing');
  assert.deepEqual(g.snake[0], { x: 0, y: 0 });
});

test('filling the board is a win, not an endless food retry', () => {
  const g = createSnake({ size: 2, rng: first, snake: [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }], dir: 'up' });
  assert.deepEqual(g.food, { x: 1, y: 0 });
  step(g);
  assert.equal(g.status, 'won');
  assert.equal(g.food, null);
});

test('speed drops 5ms every 5 apples with an 80ms floor', () => {
  const g = createSnake();
  assert.equal(tickMs(g), 140);
  g.apples = 5;
  assert.equal(tickMs(g), 135);
  g.apples = 500;
  assert.equal(tickMs(g), 80);
});
