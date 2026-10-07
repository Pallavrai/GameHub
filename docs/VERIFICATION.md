# Verification record

Updated: 2026-10-07. Record actual evidence here; never infer that a planned behavior has passed.

## Assets

Asset and documentation preparation is complete. Checks below passed on 2026-10-07. They verify the prepared files and static gallery, not extension behavior.

| Check | Result | Evidence |
| --- | --- | --- |
| Runtime inventory | PASS | 22 native SVGs + 4 Chrome PNG icons + 2 AI PNG illustrations = 28 runtime files |
| Native source and sheet XML | PASS | All 23 SVG files parsed with an SVG root and viewBox; this includes one reference sheet |
| Chrome PNG dimensions | PASS | PNG format, RGBA; exactly 16×16, 32×32, 48×48, and 128×128 |
| AI illustration dimensions | PASS | Both PNGs are 1254×1254; cover is RGB, mascot is RGBA |
| Requested mascot transparency | PASS | Actual alpha channel, 1,066,445 fully transparent pixels of 1,572,516; visible subject checked on a dark background |
| Visual inspection | PASS | No baked labels/watermarks visible; full snake/apple compositions, legible pieces and controls, tiny toolbar icon inspected |
| Static gallery desktop | PASS | Installed Chrome in an isolated headless session, 1100×900 viewport; 14 image elements loaded; no page errors or horizontal overflow |
| Static gallery narrow viewport | PASS | 390×844 viewport; no horizontal overflow; artwork, tiles, and icon rows remain visible |
| Project-local Markdown links | PASS | Checked ten Markdown files; no broken relative Markdown links |

Visual evidence: [desktop gallery](verification/asset-gallery-desktop.png), [narrow gallery](verification/asset-gallery-mobile.png), and [native reference sheet](../assets/native-preview.png).

The default Playwright browser binary was unavailable. The gallery render used the existing installed Chrome with a fresh temporary automation profile instead; no browser download or installation was needed. This successful static render does not prove extension-origin iframe compatibility.

### Generation commands

```sh
node scripts/generate-vector-assets.mjs
node scripts/export-icons.mjs
```

The export command was run with `GAMEHUB_NODE_MODULES` pointing to the desktop's existing bundled `sharp` installation. A different agent can use a local installation as described in `../assets/README.md`; the runtime assets themselves need no tool dependencies.

### Selected artwork integrity

The two selected originals were copied into the project without resizing or editing:

| File | SHA-256 |
| --- | --- |
| `assets/art/snake-cover.png` | `94055d650538d5f48a93d11509f32ef63b2565b59639a55c05e582ab3721fdcd` |
| `assets/art/snake-mascot.png` | `b1815616d936b49a4d4a65bad9f98a752bdbc596b0f23b890504634fd933bec7` |

## Engine tests — 2026-10-07

`node --test tests/*.test.mjs` → 8 pass, 0 fail (Node 26.7). Covers start position, reversal and two-keys-per-tick rejection, growth and score, wall and self collision, vacating-tail move, full-board win, and speed curve. Uses an injected RNG.

## Chrome end-to-end — 2026-10-07

Command (paths are this machine's; see the header of `tests/e2e.mjs`):

```sh
PLAYWRIGHT_DIR=~/.npm/_npx/a8a7eec953f1f314 CHROME_PATH="$HOME/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" node tests/e2e.mjs
```

Environment: headless Chrome for Testing 153.0.8010.12, Playwright 1.63, 1280×800, local HTTP test page. Result: 28 PASS, 0 FAIL (rerun after v1.0.0 sound/Space changes).

**Harness differences from real use:** the test copy adds `host_permissions: <all_urls>` and stubs the popup's `chrome.tabs.query`, because automation cannot click the toolbar icon. The popup still runs its real inject → open → ready-ack code.

| Check | Result |
| --- | --- |
| Popup closes only after the frame's ready ack | PASS |
| Exactly one panel; extension-origin iframe loads | PASS |
| Ready state; stored best (50) shown | PASS |
| Sound muted by default; toggle saves `settings.muted` | PASS |
| Space starts from Ready | PASS |
| Start → playing; arrows/WASD in the frame never reach page `keydown` handlers | PASS |
| Page input typing, page key handlers, page button, page scroll work with panel open | PASS |
| Clicking the page pauses ("Paused while you're away"); canvas unchanged after 600 ms | PASS |
| Minimize to chip, restore, run kept | PASS |
| Drag moves exactly with pointer; drag clamps within 8 px of viewport | PASS |
| Repeat launch reuses the panel and keeps the run | PASS |
| Wall collision → "Game over"; best stays 50 after a 0-point run | PASS |
| Escape from Ready closes the panel | PASS |
| Page with `frame-src 'none'` CSP still loads the panel | PASS |
| `chrome://version` → "This page doesn't allow a game overlay." | PASS |
| "Open in separate window" opens a playable game window | PASS |

Screenshots: [ready](verification/panel-ready.png), [playing](verification/panel-playing.png), [game over](verification/panel-over.png), [popup](verification/popup.png), [restricted page](verification/popup-restricted.png).

Bugs found and fixed by this run: panel rendered off-screen (`all: initial !important` on `:host`), popup stayed silent if the tab lookup threw, separate-window click could close the popup before the window opened.

## Package — 2026-10-07

`./scripts/package.sh` → `dist/GameHub-1.0.0.zip` (160 KB). Unzipped contents are byte-identical to `extension/` plus `INSTALL.txt` (`diff -r`). The zip itself was not loaded in Chrome; the identical folder was.

## Manual — 2026-10-07

| Check | Result | Evidence |
| --- | --- | --- |
| Load unpacked in the user's Chrome; real toolbar click → Play → Snake playable | PASS | User report: "it loaded, snake works" |

## Not tested

| Scenario | Why it matters |
| --- | --- |
| Focus handoff details after a real toolbar launch (page focus restored on close) | Basic launch confirmed manually; focus specifics not reported |
| Switching browser windows / OS app switch while playing | Headless focus is emulated |
| 80–200% zoom, very short viewports | Panel clamps, but not inspected |
| Two tabs at once; best score race | Read-max-write race is accepted |
| Extension reload with a panel open; SPA route change; full navigation | Stale-context guard in `overlay.js` is unexercised |
| Built-in PDF viewer, Web Store, new-tab page, `file://` | Expected to hit the fallback |
| Heavy real sites, video playback, page top-layer dialogs | Only a plain test page was used |
| Offline after install | All code and assets are local; not run offline |
| Screen reader announcement of outcomes | `aria-live` present, not heard |
| Sound cues audible and not too loud | Headless run cannot hear audio |
