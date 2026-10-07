import { games } from '../games/registry.js';

const $ = (id) => document.getElementById(id);
const embedded = window.parent !== window;
const entry = games.find((g) => g.id === new URLSearchParams(location.search).get('game'));

const COPY = {
  ready: ['Ready when you are', 'Start'],
  paused: ['Paused', 'Resume'],
  away: ["Paused while you're away", 'Resume'],
  over: ['Game over', 'Play again'],
  won: ['Board cleared!', 'Play again'],
};

let state = 'ready';
let score = 0;
let best = 0;
let game;
let muted = true;
let audio;

// Short synthesized cues; no audio files. AudioContext starts after the player's click.
function beep(freqs, dur) {
  if (muted) return;
  audio ??= new AudioContext();
  const t = audio.currentTime;
  freqs.forEach((f, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.05, t + i * dur);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (i + 1) * dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + i * dur);
    osc.stop(t + (i + 1) * dur);
  });
}

function showSound() {
  $('sound').setAttribute('aria-pressed', String(!muted));
  $('sound').querySelector('img').src = `/assets/ui/${muted ? 'sound-off' : 'sound-on'}.svg`;
}

function toggleSound() {
  muted = !muted;
  showSound();
  beep([880], 0.06);
  globalThis.chrome?.storage?.local.set({ settings: { muted } });
}

function setState(next) {
  state = next;
  const copy = COPY[next];
  $('overlay').hidden = !copy;
  if (copy) {
    const [msg, label] = copy;
    $('message').textContent = next === 'over' || next === 'won' ? `${msg} · ${score} points` : msg;
    $('primary').textContent = label;
  }
  const resumable = next === 'paused' || next === 'away';
  $('pause').disabled = next !== 'playing' && !resumable;
  $('pause').querySelector('span').textContent = resumable ? 'Resume' : 'Pause';
  $('pause').querySelector('img').src = `/assets/ui/${resumable ? 'play' : 'pause'}.svg`;
  document.title = `${entry.title} · GameHub`;
}

function play() {
  if (state === 'over' || state === 'won') game.restart();
  if (state === 'ready' || state === 'over' || state === 'won') game.start();
  else game.resume();
  setState('playing');
  $('stage').focus({ preventScroll: true }); // keep Space off the buttons
}

function pause(reason = 'paused') {
  if (state !== 'playing') return;
  game.pause();
  setState(reason);
}

function restart() {
  game.restart();
  setState('ready');
}

function close() {
  game?.destroy();
  if (embedded) window.parent.postMessage({ gamehub: 'close' }, '*');
  else window.close();
}

// ponytail: read-max-write, two tabs ending a run in the same instant can race; route through a worker if that ever matters.
async function saveBest() {
  if (!globalThis.chrome?.storage) return;
  const key = `best:${entry.id}`;
  const { [key]: stored = 0 } = await chrome.storage.local.get(key);
  best = Math.max(best, stored, score);
  if (best > stored) await chrome.storage.local.set({ [key]: best });
  $('best').textContent = best;
}

function onEnd(result) {
  beep(result === 'won' ? [523, 659, 784] : [330, 220], 0.12);
  setState(result);
  $('announce').textContent = $('message').textContent;
  saveBest();
}

function onKey(e) {
  if (e.key === 'Escape') {
    if (state === 'playing') pause();
    else close();
  } else if (e.key === ' ' && !e.target.closest('button')) {
    e.preventDefault();
    if (state === 'playing') pause();
    else play();
  }
}

async function init() {
  if (!entry) {
    $('message').textContent = 'Unknown game.';
    return;
  }
  const mod = await entry.load();
  game = mod.mount($('game'), {
    controls: $('dpad'),
    onScore: (s) => {
      if (s > score) beep([880], 0.06);
      score = s;
      $('score').textContent = s;
    },
    onEnd,
  });
  $('primary').disabled = false;
  $('primary').addEventListener('click', play);
  $('pause').addEventListener('click', () => (state === 'playing' ? pause() : play()));
  $('restart').addEventListener('click', restart);
  $('sound').addEventListener('click', toggleSound);
  const { settings } = (await globalThis.chrome?.storage?.local.get('settings')) ?? {};
  muted = settings?.muted ?? true;
  showSound();
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', () => pause('away'));
  document.addEventListener('visibilitychange', () => document.hidden && pause('away'));
  setState('ready');
  saveBest();
  // Tells the launcher popup the panel really loaded; it may already be closed.
  globalThis.chrome?.runtime?.sendMessage({ type: 'gamehub:ready', game: entry.id }).catch(() => {});
}

init();
