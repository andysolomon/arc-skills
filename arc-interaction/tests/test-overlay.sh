#!/usr/bin/env bash
# Proves the overlay still works on the CURRENT template: copies the template to a temp
# folder, runs npm ci, applies the overlay (files, the two exact pins, the package scripts),
# then runs typecheck, tests, both lints, the build, the static render, the API check
# against the mock, and the real-browser check. Needs the network.
#
#   bash tests/test-overlay.sh             uses a fresh temp folder and removes it after
#   KEEP=1 bash tests/test-overlay.sh      keeps the folder and prints its path
#   CHROME_PATH=/path/to/chrome ...        the browser for the last step; else chromium or
#                                          google-chrome on PATH; with none, that step is SKIP
#   TEMPLATE_DIR, OVERLAY_SKILL_DIR        test another template or a changed copy of this skill
set -euo pipefail

SKILL_DIR="${OVERLAY_SKILL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="${TEMPLATE_DIR:-$REPO_DIR/arc-web-production/template}"
PLAYWRIGHT_CORE=1.65.1
WORK="$(mktemp -d)"
mock=""; web=""
cleanup() {
  [ -n "$mock" ] && kill "$mock" 2>/dev/null || true
  [ -n "$web" ] && kill "$web" 2>/dev/null || true
  if [ "${KEEP:-}" = 1 ]; then echo "kept: $WORK"; else rm -rf "$WORK"; fi
}
trap cleanup EXIT

pass=0; fail=0
step() { # step <label> <command...>
  local label="$1"; shift
  if "$@" > "$WORK/.step.log" 2>&1; then echo "PASS $label"; pass=$((pass + 1))
  else echo "FAIL $label"; tail -20 "$WORK/.step.log" | sed 's/^/  /'; fail=$((fail + 1)); fi
}
free_port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
wait_for() { for _ in $(seq 1 50); do curl -sf "$1" >/dev/null 2>&1 && return 0; sleep 0.3; done; return 1; }

cp -R "$TEMPLATE_DIR/." "$WORK/"
cd "$WORK"

step "npm ci (the template's lockfile)" npm ci --no-audit --no-fund
# A replaced file that changed in the template means the overlay's copy is missing that change.
step "the nine template files the overlay replaces are unchanged since it copied them" \
  bash -c "cd '$TEMPLATE_DIR' && sha256sum -c '$SKILL_DIR/overlay-base.sha256'"
step "apply the overlay (files, exact pins, package scripts)" bash "$SKILL_DIR/scripts/apply-overlay.sh" "$WORK"
step "motion and hairline are pinned exactly, and React is not installed" node -e '
  const d = require("./package.json").dependencies;
  for (const name of ["motion", "@lucasmarkes/hairline"]) if (!/^\d+\.\d+\.\d+$/.test(d[name] ?? "")) { console.log(name + " is not an exact pin: " + d[name]); process.exit(1) }
  for (const name of ["react", "react-dom"]) if (require("fs").existsSync("node_modules/" + name)) { console.log(name + " is installed"); process.exit(1) }'
step "typecheck (app and Worker)" npm run typecheck
step "tests (Story, Scene with Mounts, Commands, gesture logic)" npm test
step "style lint (styles.css, fonts.css, interaction.css)" npm run lint:styles
step "interaction lint (Motion in one file, spring numbers in one file, transform and opacity only)" npm run lint:interaction
step "vite build" npm run build
step "static render still works with the changed Model" npm run static
if [ -f "$REPO_DIR/arc-design/tokens.css" ]; then
  step "tokens copy is still byte-identical" cmp "$REPO_DIR/arc-design/tokens.css" "$WORK/src/tokens.css"
fi

# The mock, with no notes: the browser check writes its own.
port=$(free_port)
PORT=$port node scripts/mock-api.ts > "$WORK/.mock.log" 2>&1 &
mock=$!
wait_for "http://127.0.0.1:$port/api/notes" || true
step "API check against the mock (save and removal are idempotent)" node scripts/api-check.ts "http://127.0.0.1:$port"

# The real-browser check, against the BUILT app served by vite preview.
browser="${CHROME_PATH:-}"
if [ -z "$browser" ]; then
  for name in chromium google-chrome google-chrome-stable; do
    if command -v "$name" >/dev/null 2>&1; then browser="$(command -v "$name")"; break; fi
  done
fi
label="real browser (row follows the pointer, flick removes, slow drag springs back, neighbours move, reduced motion, figure and theme, touch)"
if [ -z "$browser" ]; then
  echo "SKIP $label: no browser"
else
  step "install playwright-core $PLAYWRIGHT_CORE (dev, exact)" npm install --save-dev --save-exact --no-audit --no-fund "playwright-core@$PLAYWRIGHT_CORE"
  webport=$(free_port)
  API_URL="http://127.0.0.1:$port" node node_modules/vite/bin/vite.js preview --port "$webport" --strictPort > "$WORK/.web.log" 2>&1 &
  web=$!
  wait_for "http://127.0.0.1:$webport/" || true
  export CHROME_PATH="$browser"
  step "$label" node scripts/browser-check.mjs "http://127.0.0.1:$webport"
fi

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
