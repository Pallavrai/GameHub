import { games } from '../games/registry.js';

const READY_TIMEOUT = 4000;
const $ = (id) => document.getElementById(id);
let chosen;

$('games').innerHTML = games
  .map(
    (g) => `<article class="card">
      <img src="${g.cover}" alt="">
      <h2>${g.title}</h2>
      <p>${g.description}</p>
      <button class="play" data-id="${g.id}" aria-label="Play ${g.title}">Play</button>
    </article>`,
  )
  .join('');

$('games').addEventListener('click', (e) => {
  const id = e.target.closest('[data-id]')?.dataset.id;
  const game = games.find((g) => g.id === id);
  if (game) launch(game, e.target.closest('button'));
});

$('window').addEventListener('click', async () => {
  await chrome.windows.create({
    url: chrome.runtime.getURL(`game/index.html?game=${chosen.id}`),
    type: 'popup',
    width: 400,
    height: 560,
  });
  window.close();
});

function waitReady(tabId, gameId) {
  return new Promise((resolve) => {
    const done = (ok) => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(listen);
      resolve(ok);
    };
    const listen = (msg, sender) => {
      if (sender.id === chrome.runtime.id && sender.tab?.id === tabId && msg?.type === 'gamehub:ready' && msg.game === gameId) done(true);
    };
    const timer = setTimeout(() => done(false), READY_TIMEOUT);
    chrome.runtime.onMessage.addListener(listen);
  });
}

function fail(text) {
  $('status').textContent = text;
  $('problem').hidden = false;
  $('window').focus();
}

async function launch(game, button) {
  chosen = game;
  button.disabled = true;
  button.textContent = 'Opening…';
  $('problem').hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const target = { tabId: tab.id };
    await chrome.scripting.executeScript({ target, files: ['content/overlay.js'] });
    const ready = waitReady(tab.id, game.id);
    const [{ result }] = await chrome.scripting.executeScript({
      target,
      func: (id, title) => window.__gamehub.open(id, title),
      args: [game.id, game.title],
    });
    if (result === 'existing' || (await ready)) return window.close();
    await chrome.scripting.executeScript({ target, func: () => window.__gamehub?.close() });
    fail("The game couldn't load on this page.");
  } catch {
    fail("This page doesn't allow a game overlay.");
  } finally {
    button.disabled = false;
    button.textContent = 'Play';
  }
}
