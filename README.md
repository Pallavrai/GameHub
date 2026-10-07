# GameHub

A Chrome extension for short games while a website is loading or a task is running. Click the extension, choose a game, and play in a small movable panel over the current page. Snake is the first game.

## Current stage

Snake v1.0.0 is complete in `extension/`, checked by automated tests in Chrome for Testing and a real toolbar launch. Remaining manual checks are listed see [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Install (unpacked)

1. Open `chrome://extensions` and turn on Developer mode.
2. Load unpacked → choose the `extension/` folder.
3. Pin GameHub, open any normal website, click the icon, press Play.

## Share it

```sh
./scripts/package.sh
```

Creates `dist/GameHub-<version>.zip` (git-ignored) containing the extension and `INSTALL.txt`. Recipients unzip it and use Load unpacked; there is no one-click install outside the Chrome Web Store.

## Tests

```sh
node --test tests/*.test.mjs
```

`tests/e2e.mjs` drives the extension in Chrome for Testing; its header lists the required environment variables.

## Start here

| File | Purpose |
| --- | --- |
| [PLAN.md](PLAN.md) | Build order, architecture, scope, and acceptance criteria |
| [AGENTS.md](AGENTS.md) | Instructions for any coding agent working in this folder |
| [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md) | User request, assumptions, and durable project context |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Technical decisions and their reasons |
| [docs/DESIGN.md](docs/DESIGN.md) | Visual system, layouts, and Snake rules |
| [assets/README.md](assets/README.md) | Asset inventory and usage instructions |
| [docs/ASSET_PROMPTS.md](docs/ASSET_PROMPTS.md) | Reproducible image-generation prompts and provenance |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Current status and the next agent's starting point |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Asset checks, test results, and what is still untested |

All durable project context belongs in this repository's Markdown files. Do not require another agent to read chat history or an external memory service.

## Platform limit

Chrome's toolbar popup closes when it loses focus. It is the launcher, while the game lives in a separate on-page panel. Some browser-owned tabs do not permit injected overlays; offer a separate game window on those tabs. An on-page panel is not an operating-system always-on-top window. See [the implementation plan](PLAN.md) for details and official references.

## Asset preparation

Editable SVG sources cover branding, Snake pieces, the board, and controls. Chrome manifest icons are supplied as PNGs at 16, 32, 48, and 128 pixels. AI artwork is decorative; it is not used for collision detection or tile geometry.

Native vector assets are regenerated with `node scripts/generate-vector-assets.mjs`. PNG icon exports use `node scripts/export-icons.mjs` with the `sharp` package available. See [the asset guide](assets/README.md) for the portable dependency setup.
