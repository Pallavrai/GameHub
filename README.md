# GameHub

Play a quick game of Snake while a website loads, uploads, or processes. Click the GameHub icon, press **Play**, and a small game panel opens over the page — the website keeps working underneath.

<p align="center"><img src="docs/screenshots/playing.png" alt="Snake game panel during play" width="368"></p>

## Screenshots

| Game menu | Ready | Playing |
| :---: | :---: | :---: |
| <img src="docs/screenshots/menu.png" alt="GameHub toolbar menu with the Snake card and Play button" width="240"> | <img src="docs/screenshots/ready.png" alt="Snake panel showing Ready when you are and a Start button" width="240"> | <img src="docs/screenshots/playing.png" alt="Snake moving on the board with an apple" width="240"> |

| Game over | Pages that block overlays |
| :---: | :---: |
| <img src="docs/screenshots/game-over.png" alt="Game over screen with a Play again button" width="240"> | <img src="docs/screenshots/restricted.png" alt="Menu explaining the page does not allow an overlay, with an Open in separate window button" width="240"> |

## Download

**[⬇ Download GameHub-1.2.2.zip](https://github.com/Pallavrai/GameHub/releases/latest/download/GameHub-1.2.2.zip)** · [all releases](https://github.com/Pallavrai/GameHub/releases)

GameHub is not on the Chrome Web Store, so Chrome installs it in Developer mode (takes a minute).

## Install

1. Download and unzip `GameHub-1.2.2.zip`. Move the `GameHub-1.2.2` folder somewhere permanent — Chrome loads it from that folder, so don't delete it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right switch).
4. Click **Load unpacked** and select the `GameHub-1.2.2` folder.
5. Click the puzzle-piece icon in the toolbar and pin **GameHub**.

Works in Chrome and other Chromium browsers (Edge, Brave, Arc) that support loading unpacked extensions.

## Play

1. Open any normal website.
2. Click the GameHub icon → **Play**.
3. Press **Play single** (or Space), or **Play multiplayer** to play friends online.

| Key | Action |
| --- | --- |
| Arrow keys / W A S D | Steer |
| Space | Start, pause, resume |
| Esc | Pause; press again to close |

- Drag the panel by its header; **–** minimizes it to a small chip, **×** closes it.
- Clicking the website or switching tabs pauses the game automatically. Nothing resumes until you press Resume.
- Your best score is saved on your computer. Sound is off by default; use the speaker button to turn it on.

## Multiplayer

1. **Play multiplayer** → **Create room**. Share the 5-letter room code.
2. Friends choose **Play multiplayer**, enter the code, and pick a name and a snake colour. Colours already taken are crossed out. A room holds up to 6 players (the board's limit); anyone after that can watch.
3. The host presses **Start**. If they forget, the game starts automatically after 5 minutes once 2 or more players have joined.

Rules:
- The edges wrap around.
- Run into any snake's body (yours or someone else's) and you're out; you watch the rest of the match.
- Two heads meeting face to face (head-on) knock out both snakes. If they were the last two, they share #1.
- Hitting another head from the side knocks out only the snake that did the hitting: the one that most recently turned onto that collision course.
- The last snake alive rules the room's leaderboard, and the host can start a rematch.
- Clicking away from the game does **not** pause it; your snake keeps moving.
- If your connection drops, GameHub reconnects by itself. Your seat is kept for 20 seconds.

**Global leaderboard**: most wins, then most points, across all multiplayer matches that last 15 seconds or more. Open it from the multiplayer menu or the results screen. Your entry is tied to this Chrome profile, not to your name. A match where one browser holds two seats isn't counted.

Single-player is unchanged and never needs the internet.

## Good to know

- **Some pages can't show the panel**: the new-tab page, `chrome://` pages, and the Chrome Web Store block extensions. GameHub offers **Open in separate window** there instead.
- **Reloading or leaving the page closes the game.** Open it again from the icon.
- **Updating**: download the new zip, replace the folder, then click the reload icon on GameHub's card in `chrome://extensions`.
- Chrome may show a "Developer mode extensions" notice on startup; that is normal for extensions installed this way.

## Privacy

GameHub has no account, ads, or analytics. Single-player makes no network requests. Multiplayer connects to the GameHub game server (Google Cloud Run, Mumbai) and sends your room code, chosen name, colour, steering, and a random ID created on your computer. The global leaderboard stores only your latest name, wins, and points, filed under a one-way hash of that ID. Rooms themselves are forgotten when they close. It only touches a page when you click Play on it (`activeTab`), and it never reads the page's content. Permissions: `activeTab`, `scripting`, `storage`.

## For developers

```text
extension/        the extension Chrome loads (no build step)
tests/            engine tests and a Chrome end-to-end harness
scripts/          asset generators and the release packager
assets/           master artwork and sources
server/           multiplayer WebSocket server (Node, deployed to Cloud Run)
docs/             plan, decisions, design, verification records
```

```sh
node --test tests/*.test.mjs     # game rule tests
(cd server && npm test)          # multiplayer rules and server tests
node tests/multiplayer-e2e.mjs   # Chrome check (needs PLAYWRIGHT_DIR, CHROME_PATH; see file header)
./scripts/package.sh             # builds dist/GameHub-<version>.zip
```

Start with [AGENTS.md](AGENTS.md), [PLAN.md](PLAN.md), and [docs/HANDOFF.md](docs/HANDOFF.md). Test evidence and known untested scenarios are in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## License

No license is granted. You may download and use the extension; the source code is © Pallav Rai, all rights reserved.
