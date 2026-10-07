# Decision log

Decisions below are proposed implementation choices until validated by the phase-1 Chrome prototype. User requirements are recorded separately in `PROJECT_MEMORY.md`.

## 2026-10-07 — Toolbar popup launches; panel hosts gameplay

Chrome closes the toolbar popup on focus loss. Use the popup for the requested game menu and keep gameplay in an independent injected panel. This allows the website to receive focus without destroying the run. Evidence: [Chrome popup documentation](https://developer.chrome.com/docs/extensions/develop/ui/add-popup).

## 2026-10-07 — Non-modal, movable panel

Do not use a dimming backdrop or lock page scrolling. Default placement is upper-right; support drag, minimize, restore, and close. Pausing on focus loss gives the player time to finish a website action without losing Snake to an unattended collision.

## 2026-10-07 — Extension-origin iframe inside a Shadow DOM wrapper

Shadow DOM helps contain wrapper styles; a separate iframe gives gameplay its own document and key event path. This is expected to reduce collisions with host-site shortcuts. Validate strict CSP loading, keyboard separation, frame readiness, and focus transfer before committing to the renderer. Fall back to a separate game window when needed.

## 2026-10-07 — Minimal page access

Use user-invoked `activeTab`, `scripting`, and `storage`; no persistent access to every website for the initial release. Offer a fallback rather than promise injection into restricted tabs. Evidence: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting).

## 2026-10-07 — Plain JavaScript, Canvas, and a game registry

Snake needs a small deterministic engine and renderer. Start without a framework or a game engine. Shared launcher, shell, and lifecycle services accommodate future bundled game modules. Add tooling only when it solves a measured requirement.

## 2026-10-07 — Separate decorative AI art from gameplay assets

Use built-in image generation for Snake menu/start illustrations. Use editable native SVGs for the actual head, body, corner, tail, apple, board, and controls. Tile geometry stays exact and reproducible; artwork can be replaced without changing rules.

## 2026-10-07 — Native brand source and PNG exports

Use a simple generic gamepad mark so branding is not permanently tied to Snake. Preserve its editable SVG source and export Chrome PNG icons at 16/32/48/128px. Chrome does not support SVG/WebP for manifest icons. Evidence: [Chrome icon documentation](https://developer.chrome.com/docs/extensions/reference/manifest/icons).

## 2026-10-07 — Local-first and silent by default

Keep scores and preferences locally. No account, analytics, online leaderboard, downloaded font, or remote game code. Optional synthesized sound is muted initially; no audio files are required for this asset set.

## 2026-10-07 — Documentation is the cross-agent memory

The user explicitly asked to keep project memory in this folder's Markdown. `AGENTS.md` is the entry point; `PLAN.md`, `PROJECT_MEMORY.md`, `HANDOFF.md`, `DESIGN.md`, asset provenance, and verification records provide portable context. Do not depend on personal agent memory.

## 2026-10-07 — No service worker for the MVP (supersedes the worker step in PLAN §4)

The popup holds the `activeTab` grant, injects `content/overlay.js` itself, and listens for the game frame's `gamehub:ready` message (checking `sender.id`, `sender.tab.id`, and game ID). A worker added a hop without solving a problem. Add one when a launch must outlive the popup (keyboard shortcut, context menu) or score writes need serializing.

## 2026-10-07 — Best score uses read-max-write (supersedes "serialized worker write path")

`chrome.storage.local` is read, compared, and written only when higher. Two tabs ending runs in the same instant can still race; the window is milliseconds. Marked `ponytail:` in `game/shell.js` with the upgrade path.

## 2026-10-07 — Fewer source files than PLAN §5

Snake renderer and input live in `games/snake/index.js`; storage and messages live in `game/shell.js`. No `shared/` folder, no build step, no package.json. Split files when a second game needs to share them.

## 2026-10-07 — Packaged art is downsized

`extension/assets/art/*.png` are 256px copies made with macOS `sips -Z 256` from the 1254px masters in `assets/art/` (masters unchanged). The package is 260 KB instead of 2.5 MB.

## 2026-10-07 — Wrapper CSS: no `all: initial !important` on `:host`

It resets `left`/`top` with `!important` and beats the inline position, so the panel rendered below the page. `:host` now pins only position, z-index, display, margin, and transform; `left`/`top` are set inline with `important` priority.

## 2026-10-07 — v1.0.0 completion choices

- Sound: square-wave Web Audio cues (eat, game over, win), muted by default, saved as `settings.muted` in `chrome.storage.local`. The AudioContext is created only after a player click. No audio files.
- Space starts a game from Ready and Game over as well as toggling pause, so a run can be played from the keyboard alone.
- Sharing: `scripts/package.sh` zips `extension/` with an `INSTALL.txt`. `dist/` is git-ignored because it is rebuilt from source.

## 2026-10-07 — Online multiplayer Snake (supersedes "no backend / no network" for multiplayer only)

User request: the Snake menu offers Play single / Play multiplayer. Multiplayer uses a room code; the host starts the match, with a 5-minute auto-start in case the host forgets; joiners pick a name and a colour, and taken colours are disabled. Edges wrap. Hitting any snake (another snake or your own) kills you and you spectate. Head-on crashes kill both snakes. If the last two crash head-on, they share #1 and nobody gets a win (the user specified this). The last snake alive wins and is shown on a per-room leaderboard with a win tally.

- **Authoritative server** (`server/`, Node + `ws`): clients only send turns, and the server decides moves and deaths, so browsers can't disagree about who died. Single-player stays fully local.
- **Host: GCP Cloud Run**, in project `project-b323005a-fcb3-45ee-b4d` ("My First Project"), not `pactsage`, so the user's existing app is not touched. The free-trial billing account is the only billing used. Vercel was rejected because its functions can't hold WebSockets.
- **`--max-instances 1`**: rooms live in memory, so a second instance would split rooms. `ponytail:` comment in `server/index.js`, upgrade path: Redis.
- **Cost guard**: `--min-instances 0`, rooms close 5 min after a match with no rematch, lobbies close after 5 min with fewer than 2 players, and a 30 s ping drops dead sockets. An open socket keeps the instance billed, so idle rooms must end.
- **Focus loss in multiplayer**: the snake keeps moving, and an "away" banner is shown. The user chose this; single-player still pauses.
- **Leaderboard is per room** (user choice). No database, no accounts.
- **Origin check**: only `chrome-extension://<id>` and `http://localhost` pages may connect. It filters random websites; it is not authentication.
- No new extension permissions. Extension pages may open WebSockets under the default MV3 CSP.

## 2026-10-07 — Vercel rejected for the game server

The user asked to use Vercel instead of GCP if possible, to stay free. Vercel's WebSocket docs (Beta) say new connections are not guaranteed to reach the same function instance, and rooms must live in an external store. Function duration limits also close sockets. The in-memory authoritative room with its tick loop would break (players with the same code landing on different instances). Cloud Run with max 1 instance fits, and its always-free monthly allowance covers this scale.

## 2026-10-07 — v1.2.0 multiplayer changes (user requests)

- **Server moved to asia-south1 (Mumbai)** to fix input lag. Measured app-level round trip from the owner's Mac: us-central1 302 ms median, asia-south1 42 ms. Every turn makes that trip, so it was the lag. The us-central1 service stays up, unchanged, for v1.1.0 clients. Cloud Run's free compute tier has no region restriction; its 1 GB free egress covers North America only, so Mumbai egress costs a few cents per GB.
- **Slower tick: 130 → 160 ms** (user: "too fast"). Single-player speed is unchanged, because the request was about the multiplayer game.
- **Turn queue of 3** (was 1 pending turn). A second quick tap inside one tick used to be dropped, which felt like lag. The queue is validated against the last queued direction, so taps still can't reverse the snake. The client also turns your snake's head on key press, before the server's tick.
- **Collision rule clarified by the user** (supersedes "two heads in one cell both die"): head-on (opposite directions, same cell or swapping places) knocks out both; ramming a body, including a neck the head just left, knocks out only the rammer. Two heads entering one cell from the side are symmetric on a grid, so the "hitter" is defined as the snake that turned onto its current course most recently. Turns on the same tick are a mutual crash and knock out both.
- **Player cap = floor(board size / 4) = 6** (one 4-row spawn lane each), not the 8 colours.
- **Auto-reconnect**: each connection gets a session with a private resume token. A dropped player keeps their seat, host role and snake for 20 s (`GRACE_MS`); the snake keeps moving, matching the "away" rule. Cloud Run's 1 h socket limit is handled by the same reconnect.
- **Global leaderboard** (supersedes "per room only"): Firestore `(default)` in asia-south1, `players/{sha256(playerKey)[0:32]} = { name, wins, points }`, ordered by wins then points through a composite index. A random per-profile key avoids accounts, and the hash keeps it private. `GET /leaderboard` is served from a 30 s cache, so public reads can't drive up Firestore reads. Only matches of 15 s or more count, which stops instant-forfeit farming. A match where one browser holds two seats isn't counted. Known limit: two Chrome profiles can still farm slowly; fixing that needs real accounts.
- IAM in the game's project only: `roles/datastore.user` for the runtime service account.

## 2026-10-07 — v1.2.1 fixes (user reports)

- **Old us-central1 service deleted** on the owner's request; v1.1.0 multiplayer stops working.
- **Copy button**: the panel iframe had `allow=""`, which blocks clipboard writes from the embedded game, and the failure was silent. Now `allow="clipboard-write"`, an `execCommand('copy')` fallback for sites whose Permissions-Policy blocks it, and a visible "Copied!".
- **Jerky movement**: measured state arrivals on the live server ranged 73–248 ms against a 160 ms tick. Drawing on arrival made the snake double-step or stall. The client now spaces in-game states at least 0.75 × tick apart and catches up at once if more than two are waiting. Measured on screen: minimum 120 ms, median 161 ms. A late packet still shows as a short pause; hiding that needs a playout buffer, which adds delay to every move, so it wasn't done.
- **No layout jumps**: the scoreboard moved below the board and keeps join order (live rank reshuffled chips every tick). Status text moved to the bottom; during a match the reconnect notice uses the on-board banner.
- **Turn queue 3 → 2**: a third buffered press replayed stale turns well after the key press, which felt like sudden movement.
