// Injected on demand by the popup (activeTab). Classic script, isolated world, idempotent.
(() => {
  // An old copy from before an extension reload has a dead runtime; replace it.
  if (window.__gamehub?.alive()) return;
  window.__gamehub?.close();

  const W = 368;
  const H = 528;
  const MARGIN = 8;
  const FRAME_ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  const icon = (d) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const CSS = `
    :host { position: fixed !important; z-index: 2147483647 !important; display: block !important; margin: 0 !important; transform: none !important; }
    * { box-sizing: border-box; }
    .panel { display: flex; flex-direction: column; overflow: hidden; border: 1px solid #253747; border-radius: 16px;
      background: #10161f; box-shadow: 0 12px 32px rgb(0 0 0 / 0.45); font: 600 14px/1 system-ui, -apple-system, "Segoe UI", sans-serif; color: #f2f7fa; }
    .bar { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 6px 0 8px; border-bottom: 1px solid #253747;
      cursor: grab; user-select: none; touch-action: none; }
    .bar.dragging { cursor: grabbing; }
    .grip { display: flex; color: #a9bacb; }
    .title { flex: 1; }
    button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 32px; height: 32px; padding: 0 8px;
      border: 0; border-radius: 8px; background: transparent; color: #f2f7fa; font: inherit; cursor: pointer; }
    button:hover { background: #18232f; }
    button:focus-visible { outline: 2px solid #89e66b; outline-offset: 1px; }
    iframe { flex: 1; width: 100%; border: 0; background: #10161f; color-scheme: dark; }
    .chip { height: 40px; padding: 0 12px; border: 1px solid #253747; border-radius: 20px; background: #10161f; box-shadow: 0 6px 18px rgb(0 0 0 / 0.4); }
    .chip:hover { background: #18232f; }
    [hidden] { display: none !important; }
  `;

  let host, panel, frame, chip, title, gameId, prevFocus;
  let x = 0;
  let y = 0;

  function place(nx, ny) {
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    x = Math.max(MARGIN, Math.min(nx, innerWidth - w - MARGIN));
    y = Math.max(MARGIN, Math.min(ny, innerHeight - h - MARGIN));
    host.style.setProperty('left', `${x}px`, 'important');
    host.style.setProperty('top', `${y}px`, 'important');
  }

  function size() {
    panel.style.width = `${Math.min(W, innerWidth - 2 * MARGIN)}px`;
    panel.style.height = `${Math.min(H, innerHeight - 2 * MARGIN)}px`;
    place(x, y);
  }

  function build() {
    host = document.createElement('gamehub-panel');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="panel">
        <div class="bar">
          <span class="grip">${icon('<path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" stroke-width="3"/>')}</span>
          <span class="title"></span>
          <button class="min" aria-label="Minimize game">${icon('<path d="M5 16H19"/>')}</button>
          <button class="close" aria-label="Close game">${icon('<path d="M6 6L18 18M18 6L6 18"/>')}</button>
        </div>
        <iframe allow="clipboard-write"></iframe>
      </div>
      <button class="chip" hidden>${icon('<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M5 9H19"/>')}<span></span></button>`;
    panel = root.querySelector('.panel');
    frame = root.querySelector('iframe');
    chip = root.querySelector('.chip');
    title = root.querySelector('.title');
    const bar = root.querySelector('.bar');

    root.querySelector('.min').addEventListener('click', minimize);
    root.querySelector('.close').addEventListener('click', close);
    chip.addEventListener('click', restore);

    // Drag from the header only; pointer capture keeps the iframe from swallowing moves.
    let grab = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      grab = { dx: e.clientX - x, dy: e.clientY - y };
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('dragging');
    });
    bar.addEventListener('pointermove', (e) => grab && place(e.clientX - grab.dx, e.clientY - grab.dy));
    const drop = () => {
      grab = null;
      bar.classList.remove('dragging');
    };
    bar.addEventListener('pointerup', drop);
    bar.addEventListener('pointercancel', drop);

    window.addEventListener('resize', size);
    window.addEventListener('message', onMessage);
    document.documentElement.append(host);
    x = innerWidth;
    y = 16;
    size();
  }

  function onMessage(e) {
    if (e.source !== frame?.contentWindow || e.origin !== FRAME_ORIGIN) return;
    if (e.data?.gamehub === 'close') close();
  }

  // The game frame pauses itself on blur, which fires before this hides it.
  function minimize() {
    panel.hidden = true;
    chip.hidden = false;
    chip.querySelector('span').textContent = title.textContent;
    place(x, y);
  }

  function restore() {
    panel.hidden = false;
    chip.hidden = true;
    place(x, y);
  }

  function open(id, label) {
    if (host && gameId === id) {
      restore();
      return 'existing';
    }
    if (!host) {
      prevFocus = document.activeElement;
      build();
    }
    gameId = id;
    title.textContent = label;
    frame.title = `${label} game`;
    frame.src = chrome.runtime.getURL(`game/index.html?game=${encodeURIComponent(id)}`);
    restore();
    return 'opened';
  }

  function close() {
    if (!host) return;
    const hadFocus = document.activeElement === host;
    window.removeEventListener('resize', size);
    window.removeEventListener('message', onMessage);
    host.remove();
    host = panel = frame = chip = title = gameId = null;
    if (hadFocus && prevFocus?.isConnected) prevFocus.focus({ preventScroll: true });
    prevFocus = null;
  }

  window.__gamehub = { open, close, alive: () => Boolean(chrome.runtime?.id) };
})();
