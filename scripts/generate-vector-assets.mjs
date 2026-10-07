// Generates original, editable vector assets. Does not alter AI artwork.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = path.join(root, 'assets');
const svg = (size, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const files = new Map();

const mark = `<rect x="4" y="4" width="120" height="120" rx="30" fill="#10161F"/><path d="M38 35H90C101 35 107 45 110 58L117 86C120 100 108 108 98 98L84 84H44L30 98C20 108 8 100 11 86L18 58C21 45 27 35 38 35Z" fill="#89E66B"/><path d="M38 53V73M28 63H48" stroke="#10161F" stroke-width="8" stroke-linecap="round"/><circle cx="85" cy="55" r="6" fill="#10161F"/><circle cx="98" cy="68" r="6" fill="#10161F"/>`;
files.set('brand/gamehub-mark.svg', svg(128, 'GameHub gamepad mark', mark));

const head = `<path d="M0 4H18C26 4 32 8 32 16S26 28 18 28H0Z" fill="#89E66B"/><path d="M0 24H19C23 24 26 22 28 20" fill="none" stroke="#55B844" stroke-width="2"/><circle cx="21" cy="10" r="4" fill="#F2F7FA"/><circle cx="21" cy="22" r="4" fill="#F2F7FA"/><circle cx="23" cy="10" r="2" fill="#10161F"/><circle cx="23" cy="22" r="2" fill="#10161F"/>`;
const body = `<path d="M0 4H32V28H0Z" fill="#89E66B"/><path d="M0 25H32" stroke="#55B844" stroke-width="2"/><path d="M0 8H32" stroke="#B0F79B" stroke-width="2"/>`;
const corner = `<path d="M16 -12V16H44" fill="none" stroke="#89E66B" stroke-width="24" stroke-linejoin="round"/><path d="M6 0V16Q6 26 16 26H32" fill="none" stroke="#55B844" stroke-width="2"/>`;
const tail = `<path d="M32 4H24C15 4 9 9 2 16C9 23 15 28 24 28H32Z" fill="#89E66B"/><path d="M11 20C17 25 22 25 32 25" fill="none" stroke="#55B844" stroke-width="2"/>`;
const apple = `<path d="M16 8C15 5 16 3 18 2" fill="none" stroke="#77543A" stroke-width="3" stroke-linecap="round"/><path d="M18 6C21 1 27 3 26 6C24 9 21 9 18 6Z" fill="#89E66B"/><path d="M16 10C9 5 3 11 4 19C5 26 9 30 13 29C15 28 17 28 19 29C24 31 28 24 28 18C28 10 22 6 16 10Z" fill="#FF6B6B"/><path d="M9 13C7 15 7 18 8 20" fill="none" stroke="#FFC1B6" stroke-width="2" stroke-linecap="round"/>`;
files.set('snake/head-east.svg', svg(32, 'Snake head facing east', head));
files.set('snake/body-horizontal.svg', svg(32, 'Horizontal snake body', body));
files.set('snake/corner-ne.svg', svg(32, 'Snake corner connecting north and east', corner));
files.set('snake/tail-east.svg', svg(32, 'Snake tail connecting toward east', tail));
files.set('snake/apple.svg', svg(32, 'Apple food', apple));

const board = `<defs><pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#1D2B37" stroke-width="1"/></pattern></defs><rect width="320" height="320" fill="#111B24"/><rect width="320" height="320" fill="url(#grid)"/>`;
files.set('snake/board.svg', svg(320, 'Twenty by twenty Snake board', board));

const paths = {
  play: '<path d="M8 5L19 12L8 19Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5V19M16 5V19" stroke-width="4"/>',
  restart: '<path d="M4 11A8 8 0 1 1 6 18M4 5V11H10"/>',
  close: '<path d="M6 6L18 18M18 6L6 18"/>',
  minimize: '<path d="M5 16H19"/>',
  restore: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M5 9H19"/>',
  drag: '<path d="M8 6H8.01M16 6H16.01M8 12H8.01M16 12H16.01M8 18H8.01M16 18H16.01" stroke-width="3"/>',
  'arrow-up': '<path d="M5 14L12 7L19 14"/>',
  'arrow-right': '<path d="M10 5L17 12L10 19"/>',
  'arrow-down': '<path d="M5 10L12 17L19 10"/>',
  'arrow-left': '<path d="M14 5L7 12L14 19"/>',
  'sound-on': '<path d="M4 9H8L13 5V19L8 15H4ZM17 8Q21 12 17 16"/>',
  'sound-off': '<path d="M4 9H8L13 5V19L8 15H4ZM17 9L22 14M22 9L17 14"/>',
  trophy: '<path d="M8 4H16V9C16 13 14 15 12 15S8 13 8 9ZM8 6H4V8C4 11 6 12 8 12M16 6H20V8C20 11 18 12 16 12M12 15V20M8 20H16"/>',
  'external-window': '<rect x="4" y="8" width="12" height="12" rx="2"/><path d="M13 4H20V11M20 4L11 13"/>',
};
for (const [name, content] of Object.entries(paths)) {
  files.set(`ui/${name}.svg`, svg(24, name.replaceAll('-', ' '), `<g fill="none" stroke="currentColor" color="#F2F7FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</g>`));
}

for (const [relative, content] of files) {
  const destination = path.join(assets, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

// A vector-only inspection sheet; no generated raster image is edited here.
const nested = (x, y, size, contents) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 32 32">${contents}</svg>`;
const segments = [nested(380, 176, 48, tail), nested(428, 176, 48, body), nested(476, 176, 48, body), nested(524, 176, 48, head), nested(620, 176, 48, apple)];
let sheet = `<rect width="1000" height="600" rx="24" fill="#10161F"/><g font-family="system-ui,sans-serif" fill="#F2F7FA"><text x="36" y="52" font-size="27" font-weight="700">GameHub · Snake asset kit</text><text x="36" y="80" font-size="14" fill="#A9BACB">Original editable vectors · reference sheet, not playable gameplay</text><text x="36" y="280" font-size="17">Multi-game brand mark</text><text x="370" y="145" font-size="17">Connected pieces and food</text><text x="36" y="347" font-size="17">Controls</text><text x="370" y="285" font-size="14" fill="#A9BACB">32×32 sources · rotate in the renderer</text></g><svg x="58" y="112" width="144" height="144" viewBox="0 0 128 128">${mark}</svg><rect x="368" y="162" width="360" height="76" rx="12" fill="#111B24"/>${segments.join('')}`;
Object.entries(paths).forEach(([name, content], index) => {
  const x = 46 + (index % 8) * 119;
  const y = 372 + Math.floor(index / 8) * 100;
  sheet += `<rect x="${x - 10}" y="${y - 8}" width="46" height="46" rx="8" fill="#18232F"/><svg x="${x}" y="${y}" width="26" height="26" viewBox="0 0 24 24"><g fill="none" stroke="#F2F7FA" color="#F2F7FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg><text x="${x - 10}" y="${y + 59}" font-family="system-ui,sans-serif" font-size="10" fill="#A9BACB">${name}</text>`;
});
await writeFile(path.join(assets, 'native-preview.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><title>GameHub native asset reference</title>${sheet}</svg>\n`);
console.log(`Wrote ${files.size} native SVG assets and assets/native-preview.svg.`);
