// Chrome end-to-end check for the unpacked extension. Not part of the shipped package.
// Usage: PLAYWRIGHT_DIR=<dir containing node_modules/playwright> CHROME_PATH=<Chrome for Testing binary> node tests/e2e.mjs
// Branded Chrome ignores --load-extension; use Chrome for Testing or Chromium.
// Automation cannot click the toolbar, so a temp copy adds <all_urls> and the popup's tab lookup is stubbed.
// The real activeTab grant path still needs a manual check.
import { createRequire } from 'node:module';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'node_modules/'));
const { chromium } = require('playwright');

const S = fs.mkdtempSync(path.join(os.tmpdir(), 'gamehub-e2e-'));
fs.cpSync(new URL('../extension', import.meta.url).pathname, `${S}/ext`, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(`${S}/ext/manifest.json`));
manifest.host_permissions = ['<all_urls>'];
fs.writeFileSync(`${S}/ext/manifest.json`, JSON.stringify(manifest));
const EXT = fs.realpathSync(`${S}/ext`);
// Unpacked extension ID: sha256(path), first 32 hex digits mapped 0-f → a-p.
const id = [...crypto.createHash('sha256').update(EXT).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

const PAGE = `<!doctype html><title>Host</title><style>body{height:3000px;font:16px sans-serif}</style>
<input id=field><button id=btn onclick="this.dataset.n=(+this.dataset.n||0)+1">count</button>
<script>window.keys=[];addEventListener('keydown',e=>keys.push(e.key));</script>`;
const server = http.createServer((req, res) => {
  const headers = { 'content-type': 'text/html' };
  if (req.url.startsWith('/csp')) headers['content-security-policy'] = "default-src 'self'; frame-src 'none'; script-src 'unsafe-inline'";
  res.writeHead(200, headers).end(PAGE);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const ctx = await chromium.launchPersistentContext(`${S}/profile-${Date.now()}`, {
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: { width: 1280, height: 800 },
});

async function popupLaunch(urlPart, click = '.play') {
  const popup = await ctx.newPage();
  await popup.addInitScript((urlPart) => {
    const q = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = async () => (await q({})).filter((t) => t.url?.includes(urlPart)).slice(0, 1);
  }, urlPart);
  await popup.goto(`chrome-extension://${id}/popup/index.html`);
  const closed = popup.waitForEvent('close', { timeout: 6000 }).then(() => true, () => false);
  await popup.click(click);
  return { popup, closed: await closed };
}

const seed = await ctx.newPage();
await seed.goto(`chrome-extension://${id}/popup/index.html`);
await seed.evaluate(() => chrome.storage.local.set({ 'best:snake': 50 }));
await seed.close();
const host = await ctx.newPage();
await host.goto(`${base}/plain`);
let { closed } = await popupLaunch('/plain');
check('popup closes only after ready ack', closed);
await host.bringToFront();
check('exactly one panel', (await host.locator('gamehub-panel').count()) === 1);
const frame = host.frameLocator('gamehub-panel iframe');
const f = () => host.frames().find((fr) => fr.url().startsWith('chrome-extension://'));
await host.waitForTimeout(300);
check('extension iframe loaded', !!f(), f()?.url());
check('ready state', (await f().textContent('#message')) === 'Ready when you are');
check('stored best shown', (await f().textContent('#best')) === '50');
await host.screenshot({ path: `${S}/panel-ready.png` });

check('sound muted by default', (await f().getAttribute('#sound', 'aria-pressed')) === 'false');
await f().click('#sound');
check('sound toggle saves setting', (await f().getAttribute('#sound', 'aria-pressed')) === 'true' && (await f().evaluate(() => chrome.storage.local.get('settings'))).settings?.muted === false);
await f().click('#sound');
await f().focus('#stage');
await host.keyboard.press(' ');
await host.waitForTimeout(200);
check('Space starts from Ready', await f().locator('#overlay').isHidden());
await host.keyboard.press('ArrowDown');
await host.keyboard.press('w');
await host.waitForTimeout(700);
await host.keyboard.press('ArrowLeft');
await host.waitForTimeout(450);
await host.locator('gamehub-panel').screenshot({ path: `${S}/panel-playing.png` });
check('game keys do not reach website handlers', (await host.evaluate(() => keys.length)) === 0);

await host.click('#field');
await host.keyboard.type('hi');
check('website input works while panel open', (await host.inputValue('#field')) === 'hi');
check('website key handlers see website typing', (await host.evaluate(() => keys.join(''))) === 'hi');
check('focus loss pauses', (await f().textContent('#message')) === "Paused while you're away");
await host.click('#btn');
check('website button works', (await host.getAttribute('#btn', 'data-n')) === '1');
await host.mouse.wheel(0, 400);
await host.waitForTimeout(200);
check('website scrolls', (await host.evaluate(() => scrollY)) > 0);
const snap1 = await f().evaluate(() => document.querySelector('canvas').toDataURL());
await host.waitForTimeout(600);
check('no ticks while paused', snap1 === (await f().evaluate(() => document.querySelector('canvas').toDataURL())));

// minimize / restore via shadow (closed) — click by coordinates
const box = await host.locator('gamehub-panel').boundingBox();
await host.mouse.click(box.x + box.width - 64, box.y + 20); // minimize
await host.waitForTimeout(100);
const chipBox = await host.locator('gamehub-panel').boundingBox();
check('minimize shrinks to chip', chipBox.height < 60, JSON.stringify(chipBox));
await host.mouse.click(chipBox.x + 10, chipBox.y + 10); // restore
await host.waitForTimeout(100);
check('restore brings panel back', (await host.locator('gamehub-panel').boundingBox()).height > 400);
check('run kept after minimize', (await f().textContent('#message')) === "Paused while you're away");

// drag
const b0 = await host.locator('gamehub-panel').boundingBox();
await host.mouse.move(b0.x + 60, b0.y + 20);
await host.mouse.down();
await host.mouse.move(b0.x - 300, b0.y + 120, { steps: 5 });
await host.mouse.up();
const b1 = await host.locator('gamehub-panel').boundingBox();
check('drag moves panel', Math.round(b1.x) === Math.round(b0.x - 360) && Math.round(b1.y) === Math.round(b0.y + 100), `${b0.x},${b0.y} -> ${b1.x},${b1.y}`);
await host.mouse.move(b1.x + 60, b1.y + 20);
await host.mouse.down();
await host.mouse.move(5000, 5000, { steps: 3 });
await host.mouse.up();
const b2 = await host.locator('gamehub-panel').boundingBox();
check('drag clamps to viewport', b2.x + b2.width <= 1280 - 8 + 1 && b2.y + b2.height <= 800 - 8 + 1, JSON.stringify(b2));

// repeat launch keeps one panel and the run
({ closed } = await popupLaunch('/plain'));
await host.bringToFront();
check('repeat launch reuses panel', (await host.locator('gamehub-panel').count()) === 1 && closed);
check('repeat launch keeps run', (await f().textContent('#message')) === "Paused while you're away");

// resume then die on a wall
await f().click('#primary');
await host.waitForTimeout(4000);
const msg = await f().textContent('#message');
check('wall ends run with game over', msg.startsWith('Game over'), msg);
check('best never decreases', (await f().textContent('#best')) === '50' && (await f().evaluate(() => chrome.storage.local.get('best:snake')))['best:snake'] === 50);
await host.screenshot({ path: `${S}/panel-over.png` });

// Escape twice closes (game focused, paused state → close)
await f().click('#restart');
await f().focus('#stage');
await host.keyboard.press('Escape');
await host.waitForTimeout(200);
check('Escape from ready closes panel', (await host.locator('gamehub-panel').count()) === 0);

// strict CSP page
const csp = await ctx.newPage();
await csp.goto(`${base}/csp`);
({ closed } = await popupLaunch('/csp'));
const cspFrame = csp.frames().find((fr) => fr.url().startsWith('chrome-extension://'));
check('strict-CSP page (frame-src none) loads panel', closed && !!cspFrame, closed ? 'loaded' : 'fallback shown');
await csp.close();

// restricted page
const r = await ctx.newPage();
await r.goto('chrome://version');
const { popup } = await (async () => {
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    const q = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = async () => { const me = await chrome.tabs.getCurrent(); return (await q({})).filter((t) => t.id !== me.id && !t.url).sort((a, b) => b.id - a.id).slice(0, 1); };
  });
  await p.goto(`chrome-extension://${id}/popup/index.html`);
  await p.click('.play');
  await p.waitForTimeout(800);
  return { popup: p };
})();
check('restricted page shows explanation', (await popup.textContent('#status')) === "This page doesn't allow a game overlay.");
await popup.screenshot({ path: `${S}/popup-restricted.png` });
const winPromise = ctx.waitForEvent("page", { timeout: 8000 });
await popup.click('#window');
const win = await winPromise;
await win.waitForLoadState();
await win.waitForTimeout(300);
check('separate window opens playable game', (await win.textContent('#message')) === 'Ready when you are', win.url());

const pp = await ctx.newPage();
await pp.goto(`chrome-extension://${id}/popup/index.html`);
await pp.setViewportSize({ width: 300, height: 260 });
await pp.screenshot({ path: `${S}/popup.png`, fullPage: true });

console.log(results.join('\n'));
console.log(`screenshots: ${S}`);
await ctx.close();
server.close();
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
