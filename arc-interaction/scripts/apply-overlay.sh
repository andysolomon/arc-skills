#!/usr/bin/env bash
# Adds the arc-interaction overlay to an app made from arc-web-production's template:
# copies overlay/, installs the two pinned packages, and adds the package scripts.
#
#   bash scripts/apply-overlay.sh <app-dir>
#
# The overlay replaces nine template files. If the app has changed any of them, this stops
# before it writes anything and lists them: merge those by hand instead. Every addition in
# an overlay file is marked with a comment that starts "arc-interaction".
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:?usage: apply-overlay.sh <app-dir>}"
MOTION=14.14.0     # the version the Mount test ran against; see SKILL.md, Pins
HAIRLINE=0.5.1

[ -f "$APP/package.json" ] && [ -f "$APP/src/main.ts" ] || { echo "$APP is not an app made from arc-web-production's template"; exit 1; }

# Refuse to overwrite a template file the app has changed.
changed=()
while read -r sum file; do
  [ -f "$APP/$file" ] || continue
  [ "$(sha256sum "$APP/$file" | cut -d' ' -f1)" = "$sum" ] || changed+=("$file")
done < "$SKILL_DIR/overlay-base.sha256"
if [ "${#changed[@]}" -gt 0 ]; then
  echo "These files differ from the template the overlay was built on, so they were not replaced:"
  printf '  %s\n' "${changed[@]}"
  echo "Nothing was written. Copy the overlay's new files, then merge the marked additions"
  echo "(grep -n arc-interaction $SKILL_DIR/overlay/<file>) into each file above by hand."
  exit 1
fi

cp -R "$SKILL_DIR/overlay/." "$APP/"
cd "$APP"
npm install --save-exact --no-audit --no-fund "motion@$MOTION" "@lucasmarkes/hairline@$HAIRLINE"
npm pkg set \
  "scripts.test=node test/app.test.ts && node test/commands.test.ts && node test/interaction.test.ts" \
  "scripts.lint:styles=node scripts/check-styles.mjs && node scripts/check-styles.mjs src/interaction.css" \
  "scripts.lint:interaction=node scripts/check-interaction.mjs" \
  "scripts.check=npm run typecheck && npm test && npm run lint:styles && npm run lint:interaction" \
  "scripts.preview=vite preview" \
  "scripts.browser:check=node scripts/browser-check.mjs"
echo "arc-interaction overlay applied to $APP. Next: npm run check"
