// Chrome check for multiplayer Snake, plus "single-player needs no network". Not part of the shipped package.
// Usage: PLAYWRIGHT_DIR=<dir containing node_modules/playwright> CHROME_PATH=<Chrome for Testing binary> node tests/multiplayer-e2e.mjs
// Default target: the unpacked extension, which talks to the live server.
// Local target: GAME_URL=http://localhost:5173/game/index.html?game=snake with `python3 -m http.server 5173` in extension/
// and `PORT=8787 npm start` in server/. SHOTS=<dir> keeps the screenshots.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'node_modules/'));
const { chromium } = require('playwright');
const WebSocket = createRequire(new URL('../server/package.json', import.meta.url))('ws');

const EXT = new URL('../extension', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gamehub-mp-'));
const SHOTS = process.env.SHOTS ?? TMP;
const SERVER = /run\.app|localhost:8787/;
const ctx = await chromium.launchPersistentContext(`${TMP}/profile`, {
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let url = process.env.GAME_URL;
if (!url) {
  const p = await ctx.newPage();
  await p.goto('chrome://extensions');
  const id = await p.evaluate(async () => (await chrome.management.getAll()).find((e) => e.name === 'GameHub').id);
  url = `chrome-extension://${id}/game/index.html?game=snake`;
  await p.close();
}

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
const open = async (setup) => {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 368, height: 560 });
  await setup?.(page); // socket routes only apply to documents loaded after they are set
  await page.goto(url);
  return page;
};

// A plain socket that watches the room, so steering can be checked against the server's own state.
const observe = (code) =>
  new Promise((ok) => {
    const ws = new WebSocket(url.startsWith('chrome-extension') ? 'wss://gamehub-snake-733095730479.asia-south1.run.app' : 'ws://localhost:8787', { origin: 'http://localhost' });
    ws.last = null;
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.t === 'state') ws.last = m;
    });
    ws.on('open', () => ok(ws, ws.send(JSON.stringify({ t: 'watch', code }))));
  });
const dirOf = async (obs, name, want) => {
  for (let i = 0; i < 40; i++) {
    const p = obs.last?.players.find((x) => x.name === name);
    const dir = obs.last?.snakes.find((x) => x.id === p?.id)?.dir;
    if (dir === want) return dir;
    await new Promise((r) => setTimeout(r, 50));
  }
  return 'never';
};

try {
  // Single-player is fully offline: no requests to the game server, even with the network off.
  if (!process.env.GAME_URL) {
    await ctx.setOffline(true);
    const solo = await open();
    let hits = 0;
    solo.on('request', (r) => SERVER.test(r.url()) && hits++);
    solo.on('websocket', (w) => SERVER.test(w.url()) && hits++);
    await solo.click('#primary');
    await solo.waitForTimeout(800);
    check('single-player plays with the network off', (await solo.isHidden('#overlay')) && (await solo.isEnabled('#pause')));
    check('single-player makes no server requests', hits === 0, `${hits} requests`);
    await solo.click('#restart');
    await solo.click('#multi');
    await solo.click('[data-act=create]');
    await solo.waitForSelector('.m-status.warn');
    check('multiplayer offline says the server is unreachable', /Couldn't reach/.test(await solo.textContent('.m-status')));
    await solo.close();
    await ctx.setOffline(false);
  }

  const host = await open();
  const routes = []; // every guest socket passes through here so the test can cut it
  const guest = await open((page) => page.routeWebSocket(SERVER, (ws) => routes.push({ ws, server: ws.connectToServer() })));

  await host.click('#multi');
  await host.click('[data-view=start] [data-act=global]');
  await host.waitForFunction(() => !/Loading/.test(document.querySelector('[data-ref=globalList]').textContent), null, { timeout: 15000 });
  check('Global leaderboard opens from the multiplayer menu', await host.isVisible('[data-view=global]'));
  await host.click('[data-act=closeGlobal]');
  check('Back from it returns to the menu', await host.isVisible('[data-view=start]'));
  await host.click('[data-act=create]');
  await host.waitForSelector('[data-ref=code]:not(:empty)', { timeout: 30000 });
  const code = await host.textContent('[data-ref=code]');
  check('host creates a room', /^[A-Z0-9]{5}$/.test(code), code);
  await host.fill('#m-name', 'Host');
  await host.click('.m-join .primary');
  await host.click('[data-act=copy]');
  const copyMsg = await host.waitForFunction(() => document.querySelector('[data-act=copy]').textContent === 'Copied!' || document.querySelector('[data-ref=status]').textContent, null, { timeout: 3000 }).then((h) => h.jsonValue(), () => 'no response');
  check('Copy button confirms', copyMsg === true, String(copyMsg));

  await guest.click('#multi');
  await guest.fill('#m-code', code.toLowerCase());
  await guest.click('[data-act=watch] button');
  await guest.waitForSelector('.m-swatch');
  check("host's colour is disabled for the guest", await guest.isDisabled('.m-swatch input[value=green]'));
  await guest.fill('#m-name', 'Guest');
  await guest.click('.m-swatch:has(input[value=violet])');
  await guest.click('.m-join .primary');
  await host.waitForFunction(() => document.querySelectorAll('[data-ref=lobbyPlayers] li').length === 2);
  const seats = await host.textContent('[data-ref=countdown]');
  check('lobby shows seats used of the board cap', /^2\/6 players · auto-start in [0-5]:\d\d/.test(seats), seats);
  check('guest has no Start button', await guest.isHidden('[data-act=start]'));
  const guestDot = await host.$eval('[data-ref=lobbyPlayers] li:nth-child(2) .m-dot', (d) => d.style.background);
  check('picked colour is the one used', guestDot === 'rgb(181, 140, 255)', guestDot);
  const obs = await observe(code);
  await guest.screenshot({ path: `${SHOTS}/mp-join.png` });
  await host.screenshot({ path: `${SHOTS}/mp-lobby.png` });

  await host.click('[data-act=start]');
  await guest.waitForSelector('[data-view=game]:not([hidden])');
  await guest.click('[data-dir=up]');
  check('D-pad up steers', (await dirOf(obs, 'Guest', 'up')) === 'up');
  await guest.click('[data-dir=left]');
  check('D-pad left steers', (await dirOf(obs, 'Guest', 'left')) === 'left');
  await guest.click('[data-dir=down]');
  check('D-pad down steers', (await dirOf(obs, 'Guest', 'down')) === 'down');
  await guest.click('[data-dir=right]');
  check('D-pad right steers', (await dirOf(obs, 'Guest', 'right')) === 'right');
  await guest.keyboard.press('w'); // two quick taps inside one tick: both must count
  await guest.keyboard.press('ArrowRight');
  check('keyboard double tap: both turns apply', (await dirOf(obs, 'Guest', 'up')) === 'up' && (await dirOf(obs, 'Guest', 'right')) === 'right');
  await guest.waitForTimeout(300);
  check('scoreboard lists both players', (await guest.$$('[data-ref=scoreboard] li')).length === 2);
  await guest.screenshot({ path: `${SHOTS}/mp-playing.png` });

  // Cut the guest's connection mid-match; it must come back on its own with the same snake.
  const cut = routes.at(-1);
  cut.ws.close();
  cut.server.close();
  await guest.waitForSelector('.m-status.warn >> text=Reconnecting', { timeout: 3000 });
  check('a dropped connection shows Reconnecting', true);
  await guest.waitForFunction(() => !document.querySelector('[data-ref=status]').textContent, null, { timeout: 15000 });
  const alive = !(await guest.$('[data-ref=scoreboard] li.out'));
  check('auto-reconnect resumes the same snake', routes.length === 2 && alive && (await guest.isVisible('[data-view=game]')), `${routes.length} connections, alive=${alive}`);

  // Closing the guest's page drops it for good: after the 20 s grace its snake is out and the host wins.
  await guest.close();
  await host.waitForSelector('[data-ref=scoreboard] .m-tag >> text=reconnecting', { timeout: 5000 });
  check('host sees the dropped player as reconnecting', true);
  await host.waitForSelector('[data-view=end]:not([hidden])', { timeout: 30000 });
  check('host wins once the grace period ends', (await host.textContent('[data-ref=title]')) === 'Host rules the room!');
  await host.screenshot({ path: `${SHOTS}/mp-winner.png` });

  await host.click('[data-view=end] [data-act=global]');
  await host.waitForFunction(() => !/Loading/.test(document.querySelector('[data-ref=globalList]').textContent), null, { timeout: 15000 });
  const board = await host.textContent('[data-ref=globalList]');
  check('global leaderboard loads', !/Couldn't load/.test(board), board.slice(0, 90));
  await host.screenshot({ path: `${SHOTS}/mp-global.png` });
  await host.click('[data-act=closeGlobal]');
  check('Back returns to the room results', await host.isVisible('[data-view=end]'));

  await host.click('[data-act=rematch]');
  await host.waitForSelector('[data-view=lobby]:not([hidden])');
  check('Rematch reopens the lobby with a fresh countdown', /auto-start in [45]:\d\d/.test(await host.textContent('[data-ref=countdown]')));
  const late = await open();
  await late.click('#multi');
  await late.fill('#m-code', code);
  await late.click('[data-act=watch] button');
  await late.waitForSelector('.m-swatch');
  await late.fill('#m-name', 'Late');
  await late.click('.m-join .primary');
  await host.waitForFunction(() => document.querySelectorAll('[data-ref=lobbyPlayers] li').length === 2);
  await host.click('[data-view=lobby] [data-act=leave]');
  check('Leave room returns to the menu', await host.isVisible('[data-view=start]'));
  await late.waitForSelector('[data-act=start]:not([hidden])');
  check('host role passes to the next player', true);
  await late.click('[data-view=lobby] [data-act=leave]');
  obs.close();
  await host.click('[data-act=back]');
  check('back to single player', (await host.textContent('#primary')) === 'Play single');
} catch (e) {
  check('run finished', false, e.message.split('\n')[0]);
} finally {
  console.log(results.join('\n'));
  console.log(`screenshots: ${SHOTS}`);
  await ctx.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
}
