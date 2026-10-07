# Asset inventory

Prepared for the initial Snake MVP. The runtime set includes a generic GameHub mark, Chrome icons, Snake pieces, a board, menu/start artwork, and every planned control icon. Future games and Chrome Web Store listing graphics are outside this first set.

## Runtime assets

| File | Size / format | Use |
| --- | --- | --- |
| `brand/gamehub-mark.svg` | 128×128 SVG | Editable generic gamepad brand source; launcher/header |
| `icons/icon-16.png` | 16×16 PNG | Toolbar / favicon |
| `icons/icon-32.png` | 32×32 PNG | Toolbar at higher pixel density |
| `icons/icon-48.png` | 48×48 PNG | Extension management |
| `icons/icon-128.png` | 128×128 PNG | Extension install / manifest |
| `snake/head-east.svg` | 32×32 transparent SVG | Head pointing right; body connection at west edge |
| `snake/body-horizontal.svg` | 32×32 transparent SVG | Straight west–east body segment |
| `snake/corner-ne.svg` | 32×32 transparent SVG | Body corner connecting north and east |
| `snake/tail-east.svg` | 32×32 transparent SVG | Tail tip points west; connection to next body cell is east |
| `snake/apple.svg` | 32×32 transparent SVG | Food, distinct from the snake |
| `snake/board.svg` | 320×320 SVG | Quiet 20×20 grid, 16px source cell size |
| `art/snake-cover.png` | 1254×1254 AI-generated RGB PNG | Square menu artwork; no baked UI/text |
| `art/snake-mascot.png` | 1254×1254 AI-generated RGBA PNG | Ready/Paused decorative character |
| `ui/*.svg` | 24×24 SVG, 15 icons | Listed below |

Controls: `play`, `pause`, `restart`, `close`, `minimize`, `restore`, `drag`, `arrow-up`, `arrow-right`, `arrow-down`, `arrow-left`, `sound-on`, `sound-off`, `trophy`, and `external-window`.

All native SVGs are original code-created assets. Generated raster art uses the built-in image generator. The full prompts and provenance belong in `../docs/ASSET_PROMPTS.md`. No third-party sprites or downloaded font are needed.

## Orientation contract

- Head: east = 0°, south = 90°, west = 180°, north = 270°.
- Body: west–east = 0°; north–south = 90°.
- Corner: north/east = 0°, east/south = 90°, south/west = 180°, west/north = 270°.
- Tail: rotate to point its **connection toward the next body cell**, not toward the tapered tip. Connection east = 0°, south = 90°, west = 180°, north = 270°.
- Rotations are clockwise around the tile center in screen coordinates.
- Head/body/tail connectors span source coordinates 4–28 on the connecting edge. Draw adjacent pieces on exact cell boundaries. Cosmetic highlights may change at turns, but the silhouette remains connected.
- Food never determines collision bounds; every sprite occupies one logical grid cell.

Sprites can be drawn as images in Canvas 2D after preload. The board can be drawn procedurally for crisp device-pixel-ratio scaling; its SVG is the exact design reference. UI icons can use inline SVG to inherit `currentColor`. External image SVGs use their supplied light default color.

## Reference assets

`native-preview.svg` and `native-preview.png` are inspection sheets, not runtime sprites or working gameplay. `preview.html` is a local static asset gallery, not an extension or a playable game.

## Regeneration

Run from the project root:

```sh
node scripts/generate-vector-assets.mjs
node scripts/export-icons.mjs
```

The vector generator overwrites only its own native SVG outputs. The export tool overwrites the four derived Chrome icon PNGs and the native preview PNG. Neither modifies AI artwork.

`export-icons.mjs` needs the `sharp` package. A portable local setup, when no dependency setup exists yet, is:

```sh
npm install --no-save --package-lock=false sharp
node scripts/export-icons.mjs
```

Alternatively set `GAMEHUB_NODE_MODULES` to a directory containing an existing `sharp` installation. No API key is needed for these vector/icon tools. The source generators are preserved so another agent can reproduce native assets without ChatGPT image generation.

AI artwork regeneration requires an image generation tool using the saved prompts. Preserve originals and create a versioned sibling if replacing a chosen image.

## Packaging and asset failure

Runtime files are copied into `extension/assets/` (only the ones the code references; the two art PNGs are 256px `sips -Z 256` copies). Reference only packaged local files; never point a manifest or runtime UI at an agent's personal image folder. Keep prompts, master previews, scripts, and documentation out of the distributed runtime package.

Use vector/procedural fallback visuals if decorative images cannot load. No raster art is essential to playing Snake. Audio is intentionally optional and synthesized; no missing sound files are implied by this inventory.

## Inspection status

Complete for the planned Snake MVP: 28 runtime asset files (22 SVGs, four Chrome icon PNGs, and two AI illustration PNGs), plus the two native reference-sheet files and the static gallery. Native sources, generated art, Chrome icon sizes, alpha transparency, gallery rendering, and local documentation links were checked. See `../docs/VERIFICATION.md` for evidence and the browser checks still required during implementation.
