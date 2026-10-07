# Agent handoff

Updated: 2026-10-07. Stage: v1.0.0 complete and packaged; basic real-Chrome launch confirmed by the user; remaining manual checks pending.

## Read first

`../AGENTS.md` → `../PLAN.md` → `PROJECT_MEMORY.md` → `DECISIONS.md` → `DESIGN.md` → `../assets/README.md` → `VERIFICATION.md`.

## Completed

- Stage 0 (assets and plan): see `VERIFICATION.md` § Assets.
- Loadable MV3 extension in `../extension/` (32 files, 260 KB, no build step):
  - `manifest.json` — `activeTab`, `scripting`, `storage`; only `game/index.html` is web-accessible.
  - `popup/` — game menu from the registry; injects the overlay, waits up to 4 s for the frame's ready ack, closes on success; restricted-page message plus "Open in separate window".
  - `content/overlay.js` — idempotent, closed Shadow DOM panel: drag (header, pointer capture, viewport clamp), minimize chip, close, resize clamp, focus restore. Accepts only `{gamehub:'close'}` from its own frame origin.
  - `game/` — shell: states Ready / Playing / Paused / Away / Game over / Board cleared, blur and visibility pause, Space and Escape handling, best score.
  - `games/registry.js` and `games/snake/` — pure engine (`engine.js`) and canvas renderer with sprite rotation and solid-colour fallback (`index.js`).
- v1.0.0 additions: opt-in synthesized sound (muted by default, saved), Space starts from Ready/Game over, `scripts/package.sh` builds `dist/GameHub-<version>.zip` with `INSTALL.txt`.
- Tests: `tests/snake-engine.test.mjs` (8 rule tests) and `tests/e2e.mjs` (28 Chrome checks). Both pass; see `VERIFICATION.md`.

## Published

- Public repo: https://github.com/Pallavrai/GameHub (no license; all rights reserved by the owner's choice).
- Release v1.0.0 with `GameHub-1.0.0.zip`: https://github.com/Pallavrai/GameHub/releases/tag/v1.0.0. The README download link uses `releases/latest/download/GameHub-1.0.0.zip`; update it when the zip name changes.
- To release a new version: bump `extension/manifest.json`, run `./scripts/package.sh`, then `gh release create v<version> dist/GameHub-<version>.zip`.

## Deviations from PLAN.md

No service worker, read-max-write best score, fewer files. Reasons are in `DECISIONS.md` (2026-10-07 entries after the asset decisions).

## Next task

1. Remaining manual checks (list in `VERIFICATION.md` § Not tested). The real toolbar launch itself is confirmed.
2. Fix anything those checks expose.
3. Web Store publication is deferred scope (needs a developer account, listing graphics, privacy disclosure). Shared zips require Developer mode on the recipient's Chrome.

## Load it

`chrome://extensions` → Developer mode → Load unpacked → select `extension/`.

## 2026-10-07 multiplayer (v1.2.0)

- `server/`: `rules.js` holds the pure rules (wrap, body hits, head-on vs side hits, 3-turn input queue, 6-player cap from the board size). `index.js` handles rooms, sessions with resume tokens and a 20 s grace, host-only start/rematch, the 160 ms tick, the origin check, pings and `GET /leaderboard`. `stats.js` is the global leaderboard: Firestore on Cloud Run, in memory elsewhere. Tests: `cd server && npm test` (13 pass).
- Live: Cloud Run `gamehub-snake` in **asia-south1**, `wss://gamehub-snake-733095730479.asia-south1.run.app`, with Firestore `(default)` in asia-south1. The `us-central1` service still runs v1.1.0 code for v1.1.0 clients; deletion command is in `server/README.md`. All GCP details and the safe live-test procedure are there too.
- `extension/games/snake/multi.js`: lobby (code, seats used of the cap, colour swatches, countdown), auto-reconnect (backoff 0.25→4 s, gives up after 25 s, retries when the browser comes back online), the head turns on key press before the server tick, live scoreboard with "reconnecting" tags, results, and the global leaderboard view. Player identity is a random `playerKey` in `chrome.storage.local`; the last used name is `playerName`.
- Single-player never loads `multi.js` and makes no requests (checked with the network off).
- `tests/multiplayer-e2e.mjs`: Chrome check against the live server (default) or a localhost copy (`GAME_URL`).
- Next: a two-machine match with real people; delete the us-central1 service once v1.1.0 is gone; consider a budget alert. When the GCP free trial ends, Google stops the service unless the billing account is upgraded.
