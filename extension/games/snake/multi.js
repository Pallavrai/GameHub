// Multiplayer Snake view. The server owns the rules; this file only renders state and sends turns.
// Names come from other players: always set them with textContent, never innerHTML.
// This is the only module that touches the network, and single-player never loads it.

const SERVER = location.protocol === 'chrome-extension:' ? 'wss://gamehub-snake-733095730479.asia-south1.run.app' : 'ws://localhost:8787';
const HTTP = SERVER.replace(/^ws/, 'http');
const GIVE_UP_MS = 25_000; // the server holds a dropped seat for 20 s

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
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MEDAL = ['#FFD25B', '#C9D6E2', '#E0A070'];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const TEMPLATE = `

<section class="m-view" data-view="start">
  <h2>Multiplayer</h2>
  <button class="primary" data-act="create">Create room</button>
  <form class="m-row" data-act="watch">
    <label class="sr-only" for="m-code">Room code</label>
    <input id="m-code" maxlength="5" placeholder="Room code" autocomplete="off" spellcheck="false" required>
    <button>Join</button>
  </form>
  <button data-act="global"><img src="/assets/ui/trophy.svg" alt="">Global leaderboard</button>
  <button class="link" data-act="back">Back to single player</button>
</section>

<section class="m-view" data-view="lobby" hidden>
  <div class="m-code">
    <span>Room</span><b data-ref="code"></b>
    <button class="m-copy" data-act="copy" data-ref="copyBtn" aria-label="Copy room code">Copy</button>
  </div>
  <p class="m-muted" data-ref="countdown" aria-live="off"></p>
  <ul class="m-players" data-ref="lobbyPlayers"></ul>
  <p class="m-muted" data-ref="fullMsg" hidden>This room is full, so you're watching.</p>
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
  <div class="stage">
    <canvas data-ref="canvas" role="img" aria-label="Multiplayer Snake board. Steer with arrow keys or W A S D."></canvas>
    <p class="m-banner" data-ref="banner" hidden></p>
  </div>
  <ul class="m-board" data-ref="scoreboard" aria-label="Scoreboard"></ul>
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
  <button data-act="global"><img src="/assets/ui/trophy.svg" alt="">Global leaderboard</button>
  <button class="link" data-act="leave">Leave room</button>
</section>

<section class="m-view m-end" data-view="global" hidden>
  <img class="m-trophy" src="/assets/ui/trophy.svg" alt="">
  <h2>Global leaderboard</h2>
  <p class="m-muted">Most wins, then most points. Multiplayer matches of 15 seconds or more count.</p>
  <ol class="m-ranks" data-ref="globalList"></ol>
  <button class="link" data-act="closeGlobal">Back</button>
</section>

<p class="m-status" data-ref="status" role="status"></p>
<p class="sr-only" data-ref="announce" aria-live="polite"></p>`;

// mountMulti(container, { onExit }) → { destroy }
export function mountMulti(container, { onExit }) {
  const root = document.createElement('main');
  root.className = 'shell multi';
  root.innerHTML = TEMPLATE; // static markup only
  container.append(root);
  const ref = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((el) => [el.dataset.ref, el]));
  const ctx = ref.canvas.getContext('2d');
  const nameInput = root.querySelector('#m-name');
  const store = globalThis.chrome?.storage?.local;

  let ws = null;
  let me = null; // our id in the room
  let token = null; // lets a dropped connection resume the same seat
  let inRoom = false; // reconnect only while in a room
  let lostAt = 0;
  let attempt = 0;
  let retry = 0;
  let colors = Object.keys(HEX);
  let max = 6;
  let state = null;
  let view = 'start';
  let deadlineAt = 0;
  let clock = 0;
  let away = !document.hasFocus();
  let lastPhase = null;
  let aim = null; // { dir, at }: your latest steer, drawn on your head before the server's tick moves you
  let localKey;
  const pending = []; // ticks waiting for their slot on screen
  const lags = [];
  let fastest = Infinity;
  let margin = 60;
  let paceTimer = 0;
  let copiedTimer = 0;

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

  function show(next) {
    view = next;
    root.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== next));
  }

  function status(msg = '', warn = false) {
    ref.status.textContent = msg;
    ref.status.classList.toggle('warn', warn);
  }

  // A private random key per browser profile names your global leaderboard entry. Only its hash is ever shown.
  async function playerKey() {
    if (!store) return (localKey ??= crypto.randomUUID());
    let { playerKey: key } = await store.get('playerKey');
    if (!key) await store.set({ playerKey: (key = crypto.randomUUID()) });
    return key;
  }

  async function statsId() {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(await playerKey()));
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }

  function connect(first) {
    hangUp();
    if (!inRoom) status('Connecting… (the server may take a few seconds to wake up)');
    ws = new WebSocket(SERVER);
    ws.onopen = () => ws.send(JSON.stringify(first));
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      ws = null;
      if (inRoom) reconnect();
      else status("Couldn't reach the game server. Check your connection and try again.", true);
    };
  }

  function hangUp() {
    if (!ws) return;
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  // Back off 0.25 s → 4 s between tries; the seat survives on the server for 20 s.
  function reconnect() {
    lostAt ||= Date.now();
    if (Date.now() - lostAt > GIVE_UP_MS) return giveUp('Lost connection to the room. Check your internet and join again.');
    status('Connection lost. Reconnecting…', true);
    if (view === 'game') renderGame(state, state.players.find((p) => p.id === me));
    clearTimeout(retry);
    retry = setTimeout(() => connect({ t: 'resume', token }), Math.min(4000, 250 * 2 ** attempt++));
  }

  function onOnline() {
    if (inRoom && !ws) {
      clearTimeout(retry);
      connect({ t: 'resume', token });
    }
  }

  function giveUp(msg) {
    inRoom = false;
    lostAt = attempt = 0;
    clearTimeout(retry);
    hangUp();
    reset();
    status(msg, Boolean(msg));
  }

  function onMessage(msg) {
    if (msg.t === 'you') {
      ({ id: me, token, max } = msg);
      colors = msg.colors.filter((c) => HEX[c]);
    } else if (msg.t === 'state') {
      inRoom = true;
      if (lostAt || ref.status.textContent.startsWith('Connecting')) status();
      lostAt = attempt = 0;
      pace(msg);
    } else if (msg.t === 'error') status(msg.msg, true);
    else if (msg.t === 'expired') giveUp('You were disconnected too long and lost your seat.');
    else if (msg.t === 'closed') giveUp(msg.reason === 'empty' ? '' : msg.reason);
  }

  // Jitter buffer. The network delivers ticks 70–250 ms apart; drawn on arrival, the snake stutters.
  // Each tick is shown at its server send time + the fastest delivery seen + a margin that covers 98% of the
  // last 60 delays (one stall is ignored), so steps land on a steady 160 ms beat. Late beyond the margin: shown at once, margin grows.
  function pace(msg) {
    if (msg) {
      if (msg.phase !== 'playing' || msg.at == null) {
        pending.length = 0;
        lags.length = 0;
        fastest = Infinity;
        return render(msg);
      }
      const lag = Date.now() - msg.at; // network delay + clock offset; the offset cancels against `fastest`
      fastest = Math.min(fastest, lag);
      lags.push(lag);
      if (lags.length > 60) lags.shift();
      const sorted = lags.map((l) => l - fastest).sort((x, y) => x - y);
      margin = Math.min(200, sorted[Math.floor(sorted.length * 0.98)] + 10);
      pending.push(msg);
    }
    clearTimeout(paceTimer);
    while (pending.length) {
      const wait = pending[0].at + fastest + margin - Date.now();
      if (wait > 1 && pending.length < 4) {
        paceTimer = setTimeout(pace, wait);
        return;
      }
      render(pending.shift());
    }
  }

  function reset() {
    pending.length = 0;
    clearTimeout(paceTimer);
    state = null;
    me = token = null;
    lastPhase = null;
    aim = null;
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
    if (view === 'global' && !entering) return; // keep the global board open until the room moves on
    const mine = s.players.find((p) => p.id === me);
    const isHost = s.host === me;
    if (s.phase === 'lobby') renderLobby(s, mine, isHost);
    else if (s.phase === 'playing') renderGame(s, mine);
    else renderEnd(s, mine, isHost, entering);
    if (entering && s.phase === 'playing') {
      status();
      ref.announce.textContent = 'Game started';
    }
  }

  function tickClock() {
    if (!state || !deadlineAt) return;
    const left = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
    const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (state.phase === 'lobby') ref.countdown.textContent = `${state.players.length}/${max} players · auto-start in ${mmss} (needs 2+)`;
    if (state.phase === 'ended') ref.rematchMsg.textContent = `Room closes in ${mmss} unless the host starts a rematch.`;
  }

  function tags(li, p, s) {
    if (p.id === s.host) li.append(el('span', 'm-tag', 'host'));
    if (p.id === me) li.append(el('span', 'm-tag', 'you'));
    if (p.offline) li.append(el('span', 'm-tag', 'reconnecting'));
  }

  function renderLobby(s, mine, isHost) {
    show('lobby');
    ref.code.textContent = s.code;
    ref.lobbyPlayers.replaceChildren(
      ...s.players.map((p) => {
        const li = el('li');
        li.append(dot(p.color), el('span', 'm-name', p.name));
        tags(li, p, s);
        if (p.wins) li.append(el('span', 'm-wins', plural(p.wins, 'win')));
        return li;
      }),
    );
    if (!s.players.length) ref.lobbyPlayers.append(el('li', 'm-muted', 'No players yet'));

    const full = !mine && s.players.length >= max;
    ref.fullMsg.hidden = !full;
    ref.joinForm.hidden = Boolean(mine) || full;
    if (!ref.joinForm.hidden) {
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
    const snake = s.snakes.find((x) => x.id === me);
    if (aim && (snake?.dir === aim.dir || Date.now() - aim.at > 600)) aim = null;
    // Join order, not live rank: chips that swap places every tick read as jitter.
    ref.scoreboard.replaceChildren(
      ...s.players.filter((p) => p.inRound).map((p) => {
        const li = el('li', p.alive ? '' : 'out');
        li.append(dot(p.color), el('span', 'm-name', p.name), el('b', '', String(p.score)));
        if (!p.alive) li.append(el('span', 'm-tag', p.gone ? 'left' : 'out'));
        else if (p.offline) li.append(el('span', 'm-tag', 'reconnecting'));
        return li;
      }),
    );
    let banner = '';
    if (lostAt) banner = 'Connection lost. Reconnecting…';
    else if (!mine?.inRound) banner = 'Spectating: you can play next round';
    else if (!mine.alive) banner = "You're out, spectating";
    else if (away) banner = "You're away: your snake keeps moving!";
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
        li.append(medal, dot(p.color), el('span', 'm-name', p.name), el('span', 'm-score', p.gone ? 'left' : `${p.score} pts`), el('span', 'm-wins', plural(p.wins, 'win')));
        return li;
      }),
    );
    ref.rematchBtn.hidden = !isHost;
    if (entering) ref.announce.textContent = ref.title.textContent;
    tickClock();
  }

  async function showGlobal() {
    show('global');
    ref.globalList.replaceChildren(el('li', 'm-muted', 'Loading…'));
    let rows = null;
    try {
      const res = await fetch(`${HTTP}/leaderboard`);
      if (res.ok) ({ top: rows } = await res.json());
    } catch {
      // offline or server unreachable; handled below
    }
    if (view !== 'global') return;
    if (!rows) return ref.globalList.replaceChildren(el('li', 'm-muted', "Couldn't load the leaderboard. Check your connection."));
    if (!rows.length) return ref.globalList.replaceChildren(el('li', 'm-muted', 'No ranked matches yet. Go win one!'));
    const mine = await statsId();
    ref.globalList.replaceChildren(
      ...rows.map((p, i) => {
        const li = el('li', [i === 0 && 'champ', p.id === mine && 'you'].filter(Boolean).join(' '));
        const place = el('span', 'm-place', `#${i + 1}`);
        if (i < 3) place.style.color = MEDAL[i];
        li.append(place, el('span', 'm-name', p.id === mine ? `${p.name} (you)` : p.name), el('span', 'm-score', `${p.points ?? 0} pts`), el('span', 'm-wins', plural(p.wins ?? 0, 'win')));
        return li;
      }),
    );
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
      const dir = snake.id === me && aim ? aim.dir : snake.dir;
      const [ex, ey] = { right: [0.68, 0], left: [0.32, 0], up: [0, 0.32], down: [0, 0.68] }[dir];
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

  // Sends the turn and turns your head at once, so a key press shows before the network round trip.
  function steer(dir) {
    const snake = state?.phase === 'playing' && state.snakes.find((s) => s.id === me);
    if (!snake) return;
    const last = aim?.dir ?? snake.dir;
    if (dir === last || dir === OPPOSITE[last]) return;
    aim = { dir, at: Date.now() };
    send({ t: 'turn', dir });
    draw(state);
  }

  function onKey(e) {
    if (e.target.closest('input')) return;
    const dir = KEYS[e.key];
    if (!dir || state?.phase !== 'playing' || view !== 'game') return;
    e.preventDefault();
    steer(dir);
  }

  // The panel iframe allows clipboard-write; a site that blocks it falls back to the older copy command.
  async function copyCode() {
    const code = state?.code ?? '';
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const t = Object.assign(document.createElement('textarea'), { value: code });
      root.append(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      if (!ok) return status(`Couldn't copy. Select the code and press ${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}+C.`, true);
    }
    ref.copyBtn.textContent = 'Copied!';
    ref.announce.textContent = 'Room code copied';
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (ref.copyBtn.textContent = 'Copy'), 1500);
  }

  function leave() {
    send({ t: 'leave' });
    giveUp('');
  }

  function onClick(e) {
    const dir = e.target.closest('[data-dir]')?.dataset.dir;
    if (dir) return steer(dir);
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (act === 'create') connect({ t: 'create' });
    else if (act === 'back') onExit();
    else if (act === 'copy') copyCode();
    else if (act === 'start' || act === 'rematch') {
      status();
      send({ t: act });
    }
    else if (act === 'leave') leave();
    else if (act === 'global') showGlobal();
    else if (act === 'closeGlobal') {
      if (state) {
        lastPhase = null; // force the room view to redraw
        render(state);
      } else show('start');
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const act = e.target.dataset.act;
    if (act === 'watch') connect({ t: 'watch', code: root.querySelector('#m-code').value });
    else if (act === 'join') {
      const name = nameInput.value;
      const color = ref.swatches.querySelector('input:checked')?.value;
      status();
      store?.set({ playerName: name });
      send({ t: 'join', name, color, key: await playerKey() });
    }
  }

  const onBlur = () => {
    away = true;
    if (state?.phase === 'playing' && view === 'game') renderGame(state, state.players.find((p) => p.id === me));
  };
  const onFocus = () => (away = false);

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  clock = setInterval(tickClock, 1000);
  store?.get('playerName').then(({ playerName }) => (nameInput.value ||= playerName ?? ''));
  show('start');
  root.querySelector('[data-act="create"]').focus({ preventScroll: true });

  return {
    destroy() {
      clearInterval(clock);
      clearTimeout(retry);
      clearTimeout(paceTimer);
      clearTimeout(copiedTimer);
      send({ t: 'leave' }); // free the seat now instead of after the grace period
      hangUp();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      root.remove();
    },
  };
}
