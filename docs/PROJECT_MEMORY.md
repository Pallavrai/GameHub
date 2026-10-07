# Project memory

Updated: 2026-10-07, Asia/Kolkata.

## User intent

Create a Chrome extension for playing short games while waiting for website tasks. The required interaction is extension click → little game menu → select a game → game opens over the website. Keep the website usable. Snake is the first game; more games will follow.

The immediate request is: “First generate all the assets and store plan file in the project folder.” The user allows ChatGPT-generated assets and wants project memory in local `.md` files so a different coding agent can continue.

## Confirmed facts

- The project folder was empty when this task began.
- The workspace name is `GameHub`; it is used as a provisional product name.
- No existing extension, package configuration, design system, or repository-local AGENTS.md was present.
- The user's advisor-style communication instructions are preserved in `../AGENTS.md`.
- Browser platform sources checked during planning are linked from `../PLAN.md`.

## Working assumptions

These are planning defaults, not user-confirmed choices:

- Plain JavaScript and Canvas 2D, Manifest V3, no backend.
- Dark arcade design, green snake, coral apple, quiet decoration.
- Popup launcher plus movable page panel, not an actual modal blocking the page.
- Pause whenever the player returns to the website; keep the run only while the current panel is mounted.
- Local scores/settings and sound off by default.
- Separate-window fallback when an on-page overlay cannot load.
- Only real playable games appear in the registry/menu.

## Boundaries that matter

- “Any website” cannot include guaranteed injection into browser-owned/restricted pages.
- A popup cannot remain open after focus leaves it. The game needs its own lifetime.
- A page overlay cannot guarantee OS always-on-top behavior or survive full navigation.
- Website operations should continue, but the panel covers its own small area and keyboard focus belongs to one surface at a time.
- Styling isolation is not a security guarantee. A hostile website can remove an injected wrapper.
- Generated artwork is decoration. Editable deterministic sprites control the game's readable geometry.

## Maintenance

Keep new requirements here, rationale in `DECISIONS.md`, active status in `HANDOFF.md`, and test evidence in `VERIFICATION.md`. Do not record plans as completed behavior. Preserve exact commands, paths relative to this project, and meaningful failure evidence when implementation begins.

## 2026-10-07 completed deliverable

The asset-and-plan stage is complete. Runtime assets: 22 native SVGs, four Chrome PNG icon sizes, and two 1254×1254 AI-generated PNG illustrations. The mascot has real alpha transparency. The asset guide, exact generation prompts, native source generators, local gallery, and verification screenshots are in the project. No extension source was implemented during this first stage. Begin the browser prototype from phase 1 of `../PLAN.md` next.

## 2026-10-07 implementation

The user asked to continue building. Phases 1–3 of `../PLAN.md` are implemented in `../extension/` with automated Chrome checks. Working assumptions above are still unconfirmed by the user; the implementation follows them. Status lives in `HANDOFF.md`.
