import { SIZE, createSnake, turn, step, tickMs } from './engine.js';

const KEYS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
const ANGLE = { right: 0, down: 90, left: 180, up: 270 };
const CORNER = { 'right,up': 0, 'down,right': 90, 'down,left': 180, 'left,up': 270 };

function load(name) {
  const img = new Image();
  img.src = `/assets/snake/${name}.svg`;
  return img;
}
const sprites = {
  head: load('head-east'),
  body: load('body-horizontal'),
  corner: load('corner-ne'),
  tail: load('tail-east'),
  apple: load('apple'),
};

function dirTo(from, to) {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  return to.y > from.y ? 'down' : 'up';
}

// mount(container, { controls, onScore, onEnd }) → { start, pause, resume, restart, destroy }
export function mount(container, { controls, onScore, onEnd }) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Snake board. Steer with arrow keys or W A S D.');
  container.append(canvas);
  const ctx = canvas.getContext('2d');

  controls.innerHTML = ['up', 'left', 'down', 'right']
    .map((d) => `<button class="dir dir-${d}" data-dir="${d}" aria-label="Turn ${d}"><img src="/assets/ui/arrow-${d}.svg" alt=""></button>`)
    .join('');

  let game = createSnake();
  let timer = 0;
  let running = false;
  let cell = 16;

  function resize() {
    const css = Math.floor(Math.min(320, container.clientWidth || 320) / SIZE) * SIZE;
    const dpr = window.devicePixelRatio || 1;
    cell = css / SIZE;
    canvas.style.width = canvas.style.height = `${css}px`;
    canvas.width = canvas.height = Math.round(css * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function piece(img, x, y, deg, fallback) {
    ctx.save();
    ctx.translate((x + 0.5) * cell, (y + 0.5) * cell);
    ctx.rotate((deg * Math.PI) / 180);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -cell / 2, -cell / 2, cell, cell);
    else {
      ctx.fillStyle = fallback;
      ctx.fillRect(-cell / 2 + 1, -cell / 2 + 1, cell - 2, cell - 2);
    }
    ctx.restore();
  }

  function draw() {
    const px = cell * SIZE;
    ctx.fillStyle = '#111B24';
    ctx.fillRect(0, 0, px, px);
    ctx.strokeStyle = '#1D2B37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < SIZE; i++) {
      ctx.moveTo(i * cell + 0.5, 0);
      ctx.lineTo(i * cell + 0.5, px);
      ctx.moveTo(0, i * cell + 0.5);
      ctx.lineTo(px, i * cell + 0.5);
    }
    ctx.stroke();

    if (game.food) piece(sprites.apple, game.food.x, game.food.y, 0, '#FF6B6B');
    const s = game.snake;
    s.forEach((seg, i) => {
      if (i === 0) return piece(sprites.head, seg.x, seg.y, ANGLE[dirTo(s[1], seg)], '#89E66B');
      if (i === s.length - 1) return piece(sprites.tail, seg.x, seg.y, ANGLE[dirTo(seg, s[i - 1])], '#89E66B');
      const a = dirTo(seg, s[i - 1]);
      const b = dirTo(seg, s[i + 1]);
      const pair = [a, b].sort().join(',');
      if (pair === 'left,right') return piece(sprites.body, seg.x, seg.y, 0, '#89E66B');
      if (pair === 'down,up') return piece(sprites.body, seg.x, seg.y, 90, '#89E66B');
      piece(sprites.corner, seg.x, seg.y, CORNER[pair], '#89E66B');
    });
  }

  function tick() {
    const before = game.score;
    step(game);
    draw();
    if (game.score !== before) onScore(game.score);
    if (game.status !== 'playing') {
      running = false;
      onEnd(game.status, game.score);
      return;
    }
    timer = setTimeout(tick, tickMs(game));
  }

  function start() {
    if (running || game.status !== 'playing') return;
    running = true;
    timer = setTimeout(tick, tickMs(game));
  }

  function pause() {
    running = false;
    clearTimeout(timer);
  }

  function restart() {
    pause();
    game = createSnake();
    onScore(0);
    draw();
  }

  function onKey(e) {
    const dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault(); // keep arrows from scrolling the game frame
    if (running) turn(game, dir);
  }

  function onDirButton(e) {
    const dir = e.target.closest('[data-dir]')?.dataset.dir;
    if (dir && running) turn(game, dir);
  }

  window.addEventListener('keydown', onKey);
  controls.addEventListener('click', onDirButton);
  window.addEventListener('resize', resize);
  Object.values(sprites).forEach((img) => img.addEventListener('load', draw));
  resize();

  return {
    start,
    pause,
    resume: start,
    restart,
    destroy() {
      pause();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      controls.removeEventListener('click', onDirButton);
      canvas.remove();
      controls.innerHTML = '';
    },
  };
}
