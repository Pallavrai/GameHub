# Design specification

Stage: proposed Snake MVP. Updated: 2026-10-07.

## Visual direction

Quiet arcade: a dark panel, a legible green snake, coral food, rounded geometry, and restrained artwork. The panel should feel like a small tool over a website. No screen-sized decoration or flashing effects.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Background | `#10161F` | Popup and panel |
| Surface | `#18232F` | Cards and controls |
| Board | `#111B24` | Board background |
| Border / grid | `#253747` / `#1D2B37` | Dividers and quiet grid |
| Text | `#F2F7FA` | Main labels |
| Muted text | `#A9BACB` | Controls hint and supporting copy |
| Accent | `#89E66B` | Snake, primary buttons, focus |
| Accent dark | `#55B844` | Snake depth accents |
| Food | `#FF6B6B` | Apple and small game-over accent |
| Stem | `#77543A` | Apple stem |
| Radius | 16px panel; 12px cards; 8px controls | Compact rounded forms |
| Font | System UI stack | No remote font or extra font asset |
| Spacing | 4 / 8 / 12 / 16 / 24px | Consistent compact layout |

Use dark text on green primary buttons. Check real text/background contrast during implementation. Do not rely on color alone to distinguish Ready, Paused, Game over, or Win.

## Launcher

- Approximately 300px wide, content height around 320px for one game.
- Header: GameHub mark and name; a short “Play while you wait” subtitle.
- One Snake card with square cover artwork cropped into a compact thumbnail, title, short description, and a clearly labelled Play button.
- Keep all text and buttons as real HTML. The artwork contains no baked labels.
- Loading/error state remains in the launcher until panel readiness is confirmed.
- Restricted-page copy: “This page doesn't allow a game overlay.” Action: “Open in separate window”.
- No fake playable cards for unimplemented games. The registry permits later additions.

## Panel

- Default outer width 368px and height about 500px, including wrapper header; clamp dimensions to the viewport with a minimum 8px margin.
- On a normal viewport, 320px board with a 20×20 grid: 16 CSS pixels per cell. At smaller sizes, scale the canvas while keeping the logical grid fixed.
- Wrapper header: drag handle, game title, Minimize, Close. The game iframe contains the board, score row, status, and game controls.
- Score row: Score and Best. Support wider values without horizontal overflow.
- Below the board: Pause/Resume, Restart, optional mute control, direction buttons, and a one-line keyboard hint.
- Visible button hit areas at least 32×32px for desktop use, with 40×40px direction buttons when space permits. Keep a visible keyboard focus ring.
- At very short viewport heights, allow the panel's own controls region to scroll; do not lock or scroll the website to make the panel fit.
- Minimized state: compact GameHub/Snake restore chip; always pause before hiding.
- Movement uses direct manipulation, not animated following. Respect reduced-motion preferences for UI transitions.

## States and copy

| State | Visible message | Main action |
| --- | --- | --- |
| Ready | “Ready when you are” | Start |
| Playing | Score and small controls hint | Pause |
| Manual pause | “Paused” | Resume |
| Focus-loss pause | “Paused while you're away” | Resume |
| Game over | “Game over” and final score | Play again |
| Full-board win | “Board cleared!” | Play again |
| Asset unavailable | Plain vector/procedural fallback | Game remains playable |

Use the transparent mascot on the Ready or Paused overlay if it remains readable. Do not cover live gameplay with decorative illustrations. Game-over and win states reuse the same assets and real text; no separate art is required.

## Input behavior

- Arrow keys and WASD steer only in the focused game iframe.
- Space pauses/resumes only in the focused game. Do not override Space on another focused interactive control.
- Start, Pause/Resume, Restart, direction controls, Minimize, Restore, and Close have accessible labels.
- Escape pauses, then closes on a second press while paused. Use the same behavior in a separate game window, with close handled by the shell.
- Focus loss or document hiding pauses. Returning focus does not resume automatically.
- No focus trap. The page remains keyboard-accessible.
- Score and outcome are real text beside the canvas; announce outcomes rather than every movement tick. Canvas has an accessible name and a short controls description.

## Snake rendering

See `../assets/README.md` for each piece's orientation. Keep game sprites flat and crisp. The decorative AI illustrations can have soft depth, but gameplay silhouettes use exact 32×32 source geometry scaled to the cell size.

Preload piece images before Start is available. If an image fails, render simple solid shapes instead of blocking play. Use integer-aligned CSS cell sizes when possible and a device-pixel-ratio-aware canvas backing store.

## Audio

Silent by default. A later opt-in setting can synthesize a short apple cue and a short end cue with Web Audio, initialized after a player gesture. No audio files, background music, or autoplay requirement.
