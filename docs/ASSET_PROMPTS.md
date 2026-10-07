# Asset generation prompts

Generated: 2026-10-07. Mode: built-in image_gen tool, not the API/CLI fallback. No API key or third-party artwork was needed.

The selected images were copied unchanged into the repository. The paths below are portable and do not depend on an agent's personal image-generation folder.

## Snake menu cover

- Destination: `../assets/art/snake-cover.png`
- Requested transparency: false.
- Generation job: `exec-96100c6e-2465-45a8-bb9d-b872270d2284`.
- Purpose: decorative menu artwork; never use as a gameplay tile or collision mask.

```text
Use case: stylized-concept
Asset type: Snake game cover artwork for the small menu in a Chrome mini-game extension named GameHub.
Primary request: An original, polished illustration of the classic Snake game: one friendly green snake formed from thick rounded square segments, seen almost top-down, making a readable S-shaped turn toward one red apple.
Scene/backdrop: A quiet dark charcoal square playing field with a very faint square grid. The grid stays subordinate to the snake.
Style/medium: Clean arcade illustration with softly rounded geometry, subtle depth and restrained highlights; clear enough to recognize at 120 pixels.
Composition/framing: Square image, large central snake and apple, comfortable margins on every side so a rounded card crop does not cut them off. The snake is one continuous connected body with a single head and single tapering tail. No UI is drawn into the image.
Lighting/mood: Friendly, calm, playful.
Constraints: No text, numbers, letters, logo, interface labels, watermark, border, screenshots, photorealism, extra creatures, decorative objects, or busy textures. The image must be a finished standalone artwork.
```

## Snake start/pause mascot

- Destination: `../assets/art/snake-mascot.png`
- Requested transparency: true.
- Generation job: `exec-cf366999-b4d5-411e-bc12-cbc0ae54b932`.
- Purpose: optional decorative Ready/Paused artwork.

```text
Use case: stylized-concept
Asset type: Transparent Snake character illustration for the start and paused state of a compact Chrome mini-game.
Primary request: One original friendly green snake made of chunky rounded square segments curled into an S, with a single cheerful head and one tapering tail, beside one small red apple.
Scene/backdrop: Truly transparent background, with no scene or floor.
Style/medium: Clean arcade illustration, softly rounded geometric forms, subtle depth, restrained highlights, visually readable at small sizes.
Composition/framing: Square canvas. Keep the full snake and apple centered inside generous transparent margins. One continuous connected snake body; no disconnected pieces. No soft glow extending into the transparent margins.
Lighting/mood: Friendly, calm and playful.
Constraints: Actual alpha transparency; no white backdrop, checkerboard baked into the image, floor, cast shadow, text, numbers, letters, logos, watermark, border, interface, extra creatures or decorative objects.
```

## Native vectors and icon exports

Brand mark, gameplay sprites, board, and all controls are original code-created SVGs from `../scripts/generate-vector-assets.mjs`. Four Chrome PNG icon sizes and the native inspection sheet are rasterized from those vectors by `../scripts/export-icons.mjs` using sharp. AI artwork is not modified by either script.

## Provenance and replacement

These files are generated project assets, not assets downloaded from a stock library. No third-party attribution requirement was introduced by an imported sprite pack. This record is provenance, not a legal guarantee of exclusivity or trademark clearance.

If replacing selected AI artwork, preserve a versioned sibling and update the inventory and verification record. Generate from these prompts or inspect the existing image before an image-tool edit; do not silently replace the character or bake UI text into the art.

