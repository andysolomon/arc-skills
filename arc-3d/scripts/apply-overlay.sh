#!/usr/bin/env bash
# Adds the scene to an app built from arc-web-production's template: copies the overlay,
# installs the pinned packages and adds the npm scripts. Run it after `npm ci`.
#
#   bash scripts/apply-overlay.sh <app-dir>
#
# The pins and the scripts live here and nowhere else. SKILL.md's Pins section says why
# each version was chosen.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$SKILL_DIR/../arc-web-production/template"
APP="${1:?usage: apply-overlay.sh <app-dir>}"
[ -f "$APP/package.json" ] || { echo "no package.json in $APP" >&2; exit 2; }

THREE=0.187.0
TYPES_THREE=0.187.0

# entry.ts is the one template file the overlay replaces. If the app has already changed
# its own, leave it alone and say what to add.
entry=replace
if [ -f "$TEMPLATE/src/entry.ts" ] && ! cmp -s "$TEMPLATE/src/entry.ts" "$APP/src/entry.ts"; then entry=keep; fi
if [ "$entry" = keep ]; then
  (cd "$SKILL_DIR/overlay" && find . -type f ! -path ./src/entry.ts -print0 | while IFS= read -r -d '' f; do mkdir -p "$APP/$(dirname "$f")"; cp "$f" "$APP/$f"; done)
  echo "kept your src/entry.ts. Make two edits in it: import the program from ./app.ts instead of ./main.ts, and add: import \"./scene/scene.css\""
else
  cp -R "$SKILL_DIR/overlay/." "$APP/"
fi

cd "$APP"
npm install --save-exact --no-audit --no-fund "three@$THREE"
npm install --save-exact --save-dev --no-audit --no-fund "@types/three@$TYPES_THREE"
npm pkg set \
  "scripts.test=node test/app.test.ts && node test/commands.test.ts && node test/scene.test.ts" \
  "scripts.lint:styles=node scripts/check-styles.mjs && node scripts/check-styles.mjs src/scene/scene.css" \
  "scripts.lint:scene=node scripts/check-scene.mjs" \
  "scripts.check=npm run typecheck && npm test && npm run lint:styles && npm run lint:scene" \
  "scripts.test:browser=node test/scene.browser.mjs"
echo "applied arc-3d: three $THREE, @types/three $TYPES_THREE, scripts test, lint:styles, lint:scene, check, test:browser"
