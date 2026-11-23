#!/usr/bin/env bash
# Adds the arc-realtime overlay to an app made from arc-web-production's template: copies
# overlay/, installs the two pinned packages the mock needs, and adds the realtime test and
# stylesheet to the package scripts.
#
#   bash scripts/apply-overlay.sh <app-dir>
#
# The overlay replaces eight template files (overlay-base.sha256 lists them). If the app has
# changed any of them, this stops before it writes anything and lists them: merge those by
# hand instead. Every addition in an overlay file is marked with a comment that starts
# "arc-realtime".
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:?usage: apply-overlay.sh <app-dir>}"
WS=8.23.0         # the mock's WebSocket server; see SKILL.md, Pins
WS_TYPES=8.18.2

[ -f "$APP/package.json" ] && [ -f "$APP/src/main.ts" ] || { echo "$APP is not an app made from arc-web-production's template"; exit 1; }

# Refuse to overwrite a template file the app has changed. A file that already is the
# overlay's copy is fine, so applying twice is safe.
changed=()
while read -r sum file; do
  [ -f "$APP/$file" ] || continue
  [ "$(sha256sum "$APP/$file" | cut -d' ' -f1)" = "$sum" ] || cmp -s "$APP/$file" "$SKILL_DIR/overlay/$file" || changed+=("$file")
done < "$SKILL_DIR/overlay-base.sha256"
if [ "${#changed[@]}" -gt 0 ]; then
  echo "These files differ from the template the overlay was built on, so they were not replaced:"
  printf '  %s\n' "${changed[@]}"
  echo "Nothing was written. Copy the overlay's new files, then merge the marked additions"
  echo "(grep -n arc-realtime $SKILL_DIR/overlay/<file>) into each file above by hand."
  exit 1
fi

cp -R "$SKILL_DIR/overlay/." "$APP/"
cd "$APP"
npm install --save-exact --save-dev --no-audit --no-fund "ws@$WS" "@types/ws@$WS_TYPES"
# Add to the scripts instead of replacing them, so another level's additions stay.
node -e '
  const fs = require("node:fs")
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
  const add = (name, step) => { if (!pkg.scripts[name].includes(step)) pkg.scripts[name] += " && " + step }
  add("test", "node test/realtime.test.ts")
  add("lint:styles", "node scripts/check-styles.mjs src/realtime.css")
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n")
'
echo "arc-realtime overlay applied to $APP. Next: npm run check"
