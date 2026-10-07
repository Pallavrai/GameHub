# Instructions for coding agents

## Read before changing anything

1. Read `README.md`, `PLAN.md`, `docs/PROJECT_MEMORY.md`, and `docs/HANDOFF.md`.
2. Read `docs/DECISIONS.md` and `docs/DESIGN.md` before architecture or UI changes.
3. Read `assets/README.md` before regenerating or replacing artwork.
4. Check the actual files. A documented future file is not evidence of an implementation.

## User's communication instructions

- Never start with agreement. The first sentence must challenge an assumption, identify a missing consideration, or ask a question exposing a gap.
- Before a claim, use `[Certain]` for hard evidence, `[Likely]` for a strong inference, or `[Guessing]` when filling gaps. If most of a reply is guessing, say so first.
- Never use "Great question", "You're absolutely right", "That makes a lot of sense", "Absolutely", or "Definitely".
- When disagreeing, use: "I disagree because [reason]. Here's what I'd do instead [alternative]. The risk in your approach is [specific downside]."
- Lead with an uncomfortable truth when one is relevant. Skip warm-up paragraphs.
- Hold a supported position unless the user supplies new information.

## Product rules

- Preserve the flow: toolbar click → small game menu → select Snake → floating game panel.
- Protect the website's normal operation: no page backdrop, scroll lock, navigation, reload, global keyboard interception, or page-content replacement.
- Pause on focus loss, tab hiding, and minimization. Resume only after an explicit player action.
- Use an extension-origin iframe for gameplay and an isolated content script for the panel wrapper. Prototype real Chrome focus and iframe loading behavior first.
- Use Manifest V3. Start with `activeTab`, `scripting`, and `storage` only. Do not add persistent host access or the `tabs` permission without a concrete requirement.
- Bundle executable code locally. No remote game code, CDN imports, `eval`, or inline scripts.
- Snake comes first; add new games through the registry and game interface in `PLAN.md`.
- Label proposed behavior as proposed until verified in a loaded extension.

## Keep project memory local

- Update `docs/PROJECT_MEMORY.md` when requirements or assumptions change.
- Append dated decisions to `docs/DECISIONS.md`, including the reason and any superseded decision.
- Update `docs/HANDOFF.md` and `docs/VERIFICATION.md` at the end of meaningful work.
- Keep assets and generation prompts inside this repository. Do not store required context only in personal/global agent memory.
- Do not overwrite artwork without preserving its source or recording the replacement.
- Never mark an unchecked browser behavior as passing. Use precise pass/fail/not-tested states.

## Current task boundary

The user's first requested deliverable is all assets for the initial Snake game plus a plan saved in the project folder. Extension implementation is the next stage. These instructions do not require a particular coding agent, framework, hosted backend, or agent delegation.
