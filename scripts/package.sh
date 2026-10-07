#!/bin/sh
# Builds dist/GameHub-<version>.zip: the extension folder plus install steps for people you share it with.
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./extension/manifest.json').version")
NAME="GameHub-$VERSION"
STAGE=$(mktemp -d)
cp -R extension "$STAGE/$NAME"
cat > "$STAGE/$NAME/INSTALL.txt" <<TXT
GameHub $VERSION — install in Chrome

1. Unzip this file. Keep the "$NAME" folder somewhere permanent (Chrome loads it from there).
2. Open chrome://extensions and turn on "Developer mode" (top-right).
3. Click "Load unpacked" and select the "$NAME" folder.
4. Pin GameHub from the puzzle-piece menu.
5. Open any normal website, click the GameHub icon, press Play.

Controls: arrows/WASD steer, Space play/pause, Esc twice closes.
Chrome pages (new tab, chrome://, Web Store) block overlays; use "Open in separate window" there.
TXT
mkdir -p dist
rm -f "dist/$NAME.zip"
(cd "$STAGE" && zip -qr -X "$OLDPWD/dist/$NAME.zip" "$NAME" -x '*.DS_Store')
rm -rf "$STAGE"
echo "dist/$NAME.zip"
