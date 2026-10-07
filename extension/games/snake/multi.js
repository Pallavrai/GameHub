// Multiplayer Snake view. The server owns the rules; this file only renders state and sends turns.
// Names come from other players: always set them with textContent, never innerHTML.

const SERVER = location.protocol === 'chrome-extension:' ? 'wss://gamehub-snake-733095730479.us-central1.run.app' : 'ws://localhost:8787';

export const HEX = {
  green: '#89E66B', coral: '#FF6B6B', sky: '#5BC0FF', yellow: '#FFD25B',
  violet: '#B58CFF', orange: '#FF9F43', pink: '#FF7AC8', teal: '#2ED8C3',
};
const KEYS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
const MEDAL = ['#FFD25B', '#C9D6E2', '#E0A070'];

const TEMPLATE = `
<section class="m-view" data-view="start">
  <h2>Multiplayer</h2>
  <button class="primary" data-act="create">Create room</button>
  <form class="m-row" data-act="watch">
    <label class="sr-only" for="m-code">Room code</label>
    <input id="m-code" maxlength="5" placeholder="Room code" autocomplete="off" spellcheck="false" required>
    <button>Join</button>
  </form>
  <button class="link" data-act="back">Back to single player</button>
</section>

<section class="m-view" data-view="lobby" hidden>
  <div class="m-code">
    <span>Room</span><b data-ref="code"></b>
    <button class="icon" data-act="copy" aria-label="Copy room code" title="Copy code">⧉</button>
  </div>
  <p class="m-muted" data-ref="countdown" aria-live="off"></p>
  <ul class="m-players" data-ref="lobbyPlayers"></ul>
  <form class="m-join" data-act="join" data-ref="joinForm">
    <label for="m-name">Your name</label>
    <input id="m-name" maxlength="16" autocomplete="nickname" required>
    <fieldset>
      <legend>Snake color</legend>
      <div class="m-swatches" data-ref="swatches"></div>
    </fieldset>
    <button class="primary">Join game</button>
  </form>
  <button class="primary" data-act="start" data-ref="startBtn" hidden>Start game</button>
  <p class="m-muted" data-ref="waitMsg" hidden>Waiting for the host to start…</p>
  <button class="link" data-act="leave">Leave room</button>
</section>

<section class="m-view" data-view="game" hidden>
  <ul class="m-board" data-ref="scoreboard" aria-label="Scoreboard"></ul>
  <div class="stage">
    <canvas data-ref="canvas" role="img" aria-label="Multiplayer Snake board. Steer with arrow keys or W A S D."></canvas>
    <p class="m-banner" data-ref="banner" hidden></p>
  </div>
  <div class="dpad" data-ref="dpad">
    ${['up', 'left', 'down', 'right'].map((d) => `<button class="dir dir-${d}" data-dir="${d}" aria-label="Turn ${d}"><img src="/assets/ui/arrow-${d}.svg" alt=""></button>`).join('')}
  </div>
</section>

<section class="m-view m-end" data-view="end" hidden>
  <img class="m-trophy" src="/assets/ui/trophy.svg" alt="">
  <h2 data-ref="title"></h2>
  <p class="m-muted" data-ref="subtitle"></p>
  <ol class="m-ranks" data-ref="ranks"></ol>
  <button class="primary" data-act="rematch" data-ref="rematchBtn" hidden>Rematch</button>
  <p class="m-muted" data-ref="rematchMsg"></p>
  <button class="link" data-act="leave">Leave room</button>
</section>

<p class="m-error" data-ref="error" role="alert"></p>
<p class="sr-only" data-ref="announce" aria-live="polite"></p>`;

// mountMulti(container, { onExit }) → { destroy }
export function mountMulti(container, { onExit }) {
  const root = document.createElement('main');
  root.className = 'shell multi';
  root.innerHTML = TEMPLATE; // static markup only
  container.append(root);
  const ref = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((el) => [el.dataset.ref, el]));
  const ctx = ref.canvas.getContext('2d');

  let ws;
  let me = null;
  let colors = Object.keys(HEX);
  let state = null;
  let deadlineAt = 0;
  let clock = 0;
  let away = !document.hasFocus();
  let lastPhase = null;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const dot = (color) => {
    const d = el('span', 'm-dot');
    d.style.background = HEX[color];
    return d;
  };

  function show(view) {
    root.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== view));
  }

  function error(msg = '') {
    ref.error.textContent = msg;
  }

  function connect(first) {
    error('Connecting… (the server may take a few seconds to wake up)');
    hangUp();
    ws = new WebSocket(SERVER);
    ws.onopen = () => {
      error();
      ws.send(JSON.stringify(first));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === 'you') {
        me = msg.id;
        colors = msg.colors.filter((c) => HEX[c]);
      } else if (msg.t === 'error') error(msg.msg);
      else if (msg.t === 'closed') {
        if (msg.reason !== 'empty') error(msg.reason);
        reset();
      } else if (msg.t === 'state') render(msg);
    };
    ws.onclose = () => {
      if (state) {
        error('Disconnected from the room.');
        reset();
      }
    };
    ws.onerror = () => error("Couldn't reach the game server. Check your connection and try again.");
  }

  function hangUp() {
    if (!ws) return;
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  function reset() {
    state = null;
    me = null;
    lastPhase = null;
    show('start');
  }

  function send(msg) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function render(s) {
    const entering = s.phase !== lastPhase;
    lastPhase = s.phase;
    state = s;
    deadlineAt = s.endsIn == null ? 0 : Date.now() + s.endsIn;
    const mine = s.players.find((p) => p.id === me);
    const isHost = s.host === me;
    if (s.phase === 'lobby') renderLobby(s, mine, isHost);
    else if (s.phase === 'playing') renderGame(s, mine);
    else renderEnd(s, mine, isHost, entering);
    if (entering && s.phase === 'playing') {
      error();
      ref.announce.textContent = 'Game started';
      root.querySelector('.stage').focus?.();
    }
  }

  function tickClock() {
    if (!state || !deadlineAt) return;
    const left = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
    const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (state.phase === 'lobby') ref.countdown.textContent = `Auto-start in ${mmss} · needs 2+ players`;
    if (state.phase === 'ended') ref.rematchMsg.textContent = `Room closes in ${mmss} unless the host starts a rematch.`;
  }

  function renderLobby(s, mine, isHost) {
    show('lobby');
    ref.code.textContent = s.code;
    ref.lobbyPlayers.replaceChildren(
      ...s.players.map((p) => {
        const li = el('li');
        li.append(dot(p.color), el('span', 'm-name', p.name));
        if (p.id === s.host) li.append(el('span', 'm-tag', 'host'));
        if (p.id === me) li.append(el('span', 'm-tag', 'you'));
        if (p.wins) li.append(el('span', 'm-wins', `${p.wins} win${p.wins > 1 ? 's' : ''}`));
        return li;
      }),
    );
    if (!s.players.length) ref.lobbyPlayers.append(el('li', 'm-muted', 'No players yet'));

    ref.joinForm.hidden = Boolean(mine);
    if (!mine) {
      const taken = new Set(s.players.map((p) => p.color));
      const picked = ref.swatches.querySelector('input:checked')?.value;
      ref.swatches.replaceChildren(
        ...colors.map((c) => {
          const label = el('label', 'm-swatch');
          label.style.setProperty('--c', HEX[c]);
          label.title = taken.has(c) ? `${c} (taken)` : c;
          const input = el('input');
          Object.assign(input, { type: 'radio', name: 'color', value: c, disabled: taken.has(c), checked: c === picked && !taken.has(c) });
          input.setAttribute('aria-label', taken.has(c) ? `${c}, taken` : c);
          label.append(input);
          return label;
        }),
      );
      if (!ref.swatches.querySelector('input:checked')) {
        const free = ref.swatches.querySelector('input:not(:disabled)');
        if (free) free.checked = true;
      }
    }
    ref.startBtn.hidden = !isHost;
    ref.startBtn.disabled = s.players.length < 2;
    ref.startBtn.textContent = s.players.length < 2 ? 'Start (need 2 players)' : 'Start game';
    ref.waitMsg.hidden = isHost || !mine;
    tickClock();
  }

  function renderGame(s, mine) {
    show('game');
    const ranked = s.players.filter((p) => p.inRound).sort((a, b) => b.alive - a.alive || b.score - a.score);
    ref.scoreboard.replaceChildren(
      ...ranked.map((p) => {
        const li = el('li', p.alive ? '' : 'out');
        li.append(dot(p.color), el('span', 'm-name', p.name), el('b', '', String(p.score)));
        if (!p.alive) li.append(el('span', 'm-tag', p.gone ? 'left' : 'out'));
        return li;
      }),
    );
    let banner = '';
    if (!mine?.inRound) banner = 'Spectating — you can play next round';
    else if (!mine.alive) banner = "You're out — spectating";
    else if (away) banner = "You're away — your snake keeps moving!";
    ref.banner.textContent = banner;
    ref.banner.hidden = !banner;
    draw(s);
  }

  function renderEnd(s, mine, isHost, entering) {
    show('end');
    const champ = s.players.find((p) => p.id === s.winner);
    // Head-on crash between the last snakes: they share #1 and nobody gets the win.
    const tied = s.players.filter((p) => p.place === 1).map((p) => p.name);
    ref.title.textContent = champ ? `${champ.name} rules the room!` : 'Draw!';
    ref.title.style.color = champ ? HEX[champ.color] : '';
    ref.subtitle.textContent = champ
      ? champ.id === me ? 'You were the last snake standing.' : 'Last snake standing.'
      : `${tied.join(' & ') || 'The last snakes'} crashed together and share #1.`;
    const ranked = s.players.filter((p) => p.inRound).sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || b.score - a.score);
    ref.ranks.replaceChildren(
      ...ranked.map((p) => {
        const li = el('li', p.place === 1 ? 'champ' : '');
        const medal = el('span', 'm-place', `#${p.place ?? '–'}`);
        if (p.place <= 3) medal.style.color = MEDAL[p.place - 1];
        li.append(medal, dot(p.color), el('span', 'm-name', p.name), el('span', 'm-score', p.gone ? 'left' : `${p.score} pts`), el('span', 'm-wins', `${p.wins} win${p.wins === 1 ? '' : 's'}`));
        return li;
      }),
    );
    ref.rematchBtn.hidden = !isHost;
    if (entering) ref.announce.textContent = ref.title.textContent;
    tickClock();
  }

  function draw(s) {
    const css = Math.floor(Math.min(312, root.clientWidth - 24 || 312) / s.size) * s.size;
    const cell = css / s.size;
    const dpr = window.devicePixelRatio || 1;
    if (ref.canvas.width !== Math.round(css * dpr)) {
      ref.canvas.style.width = ref.canvas.style.height = `${css}px`;
      ref.canvas.width = ref.canvas.height = Math.round(css * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#111B24';
    ctx.fillRect(0, 0, css, css);
    ctx.strokeStyle = '#1D2B37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < s.size; i++) {
      ctx.moveTo(i * cell + 0.5, 0);
      ctx.lineTo(i * cell + 0.5, css);
      ctx.moveTo(0, i * cell + 0.5);
      ctx.lineTo(css, i * cell + 0.5);
    }
    ctx.stroke();
    ctx.fillStyle = '#FF6B6B';
    for (const [x, y] of s.food) {
      ctx.beginPath();
      ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    const colorOf = Object.fromEntries(s.players.map((p) => [p.id, HEX[p.color]]));
    for (const snake of s.snakes) {
      ctx.fillStyle = colorOf[snake.id] ?? '#F2F7FA';
      snake.body.forEach(([x, y], i) => {
        const inset = i === 0 ? 0.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(x * cell + inset, y * cell + inset, cell - 2 * inset, cell - 2 * inset, cell * (i === 0 ? 0.35 : 0.2));
        ctx.fill();
      });
      // Eyes on the head; a ring marks your own snake so it isn't shown by color alone.
      const [hx, hy] = snake.body[0];
      ctx.fillStyle = '#10161F';
      const [ex, ey] = { right: [0.68, 0], left: [0.32, 0], up: [0, 0.32], down: [0, 0.68] }[snake.dir];
      const eyes = ex ? [[ex, 0.3], [ex, 0.7]] : [[0.3, ey], [0.7, ey]];
      for (const [px, py] of eyes) {
        ctx.beginPath();
        ctx.arc((hx + px) * cell, (hy + py) * cell, Math.max(1.2, cell * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
      if (snake.id === me) {
        ctx.strokeStyle = '#F2F7FA';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx * cell - 1, hy * cell - 1, cell + 2, cell + 2);
      }
    }
  }

  function steer(dir) {
    if (state?.phase === 'playing') send({ t: 'turn', dir });
  }

  function onKey(e) {
    if (e.target.closest('input')) return;
    const dir = KEYS[e.key];
    if (!dir || state?.phase !== 'playing') return;
    e.preventDefault();
    steer(dir);
  }

  function onClick(e) {
    const dir = e.target.closest('[data-dir]')?.dataset.dir;
    if (dir) return steer(dir);
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (act === 'create') connect({ t: 'create' });
    else if (act === 'back') onExit();
    else if (act === 'copy') navigator.clipboard?.writeText(state?.code ?? '').then(() => (ref.announce.textContent = 'Room code copied'), () => {});
    else if (act === 'start') send({ t: 'start' });
    else if (act === 'rematch') send({ t: 'rematch' });
    else if (act === 'leave') {
      hangUp();
      error();
      reset();
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const act = e.target.dataset.act;
    if (act === 'watch') connect({ t: 'watch', code: root.querySelector('#m-code').value });
    else if (act === 'join') {
      const color = ref.swatches.querySelector('input:checked')?.value;
      send({ t: 'join', name: root.querySelector('#m-name').value, color });
    }
  }

  const onBlur = () => {
    away = true;
    if (state?.phase === 'playing') renderGame(state, state.players.find((p) => p.id === me));
  };
  const onFocus = () => (away = false);

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  clock = setInterval(tickClock, 1000);
  show('start');
  root.querySelector('[data-act="create"]').focus({ preventScroll: true });

  return {
    destroy() {
      clearInterval(clock);
      hangUp();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      root.remove();
    },
  };
}
