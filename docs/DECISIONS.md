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
