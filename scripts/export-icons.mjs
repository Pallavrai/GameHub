// Rasterizes the original SVG sources. Never edits generated artwork.
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let sharp;
try {
  const options = process.env.GAMEHUB_NODE_MODULES
    ? { paths: [process.env.GAMEHUB_NODE_MODULES] }
    : undefined;
  sharp = require(require.resolve('sharp', options));
} catch {
  console.error('sharp is needed for SVG-to-PNG export. See assets/README.md.');
  process.exit(1);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'assets/icons');
await mkdir(output, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(path.join(root, 'assets/brand/gamehub-mark.svg'), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(output, `icon-${size}.png`));
}
await sharp(path.join(root, 'assets/native-preview.svg'))
  .png()
  .toFile(path.join(root, 'assets/native-preview.png'));
console.log('Exported 4 Chrome PNG icons and assets/native-preview.png.');
