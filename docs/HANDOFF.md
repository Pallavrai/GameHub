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

## 2026-10-07 multiplayer (v1.1.0)

- `server/`: `rules.js` holds the pure rules (wrap, collisions, head-on, food per live snake). `index.js` handles rooms, the lobby timer, host-only start/rematch, the origin check and pings. Tests: `cd server && npm test` (7 pass). Deploy command: `server/README.md`.
- Live at `wss://gamehub-snake-733095730479.us-central1.run.app`: Cloud Run service `gamehub-snake` in project `project-b323005a-fcb3-45ee-b4d`, region us-central1, min 0 / max 1 instance. The default compute service account was granted `roles/run.builder` in that project only, because source deploys failed without it.
- `extension/games/snake/multi.js`: create/join room, lobby (code, copy, player list, colour swatches with taken colours disabled, countdown), live scoreboard, away/out/spectating banners, winner leaderboard. `game/shell.js` swaps it in from the Ready overlay's "Play multiplayer" button.
- On a localhost page, `multi.js` uses `ws://localhost:8787`. Port 8080 belongs to the user's Adminer container.
- Vercel was evaluated and rejected; see `DECISIONS.md`.
- Next: test with two people on different machines; consider auto-reconnect if Cloud Run drops sockets after the 1 h request timeout.
