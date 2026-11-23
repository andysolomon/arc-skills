#!/usr/bin/env bash
# Proves the overlay still works on the CURRENT arc-web-production template: copy the
# template, npm ci, apply the overlay (files, pinned packages, scripts), then typecheck,
# tests, both lints, the build, and the scene in a real browser. Needs the network.
#
#   bash tests/test-overlay.sh            uses a fresh temp folder and removes it after
#   KEEP=1 bash tests/test-overlay.sh     keeps the folder and prints its path
#   CHROME_PATH=/path/to/chromium ...     which browser the browser step drives
#
# On this machine /tmp has a quota, so run it with TMPDIR set to a folder with room.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$SKILL_DIR/.." && pwd)"
PLAYWRIGHT_CORE=1.65.1
WORK="$(mktemp -d)"
mock=""; web=""
cleanup() {
  [ -n "$mock" ] && kill "$mock" 2>/dev/null || true
  [ -n "$web" ] && kill "$web" 2>/dev/null || true
  [ "${KEEP:-}" = 1 ] && echo "kept: $WORK" || rm -rf "$WORK"
}
trap cleanup EXIT

pass=0; fail=0
step() { # step <label> <command...>
  local label="$1"; shift
  if "$@" > "$WORK/.step.log" 2>&1; then echo "PASS $label"; pass=$((pass + 1))
  else echo "FAIL $label"; tail -20 "$WORK/.step.log" | sed 's/^/  /'; fail=$((fail + 1)); fi
}
free_port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

cp -R "$REPO_DIR/arc-web-production/template/." "$WORK/"
cd "$WORK"

step "npm ci (the template's lockfile)" npm ci --no-audit --no-fund
step "apply the overlay (files, three pinned exactly, scripts)" bash "$SKILL_DIR/scripts/apply-overlay.sh" "$WORK"
step "the overlay replaces one template file (src/entry.ts)" bash -c '
  cd "$1/overlay" && replaced=$(find . -type f | while read -r f; do [ -e "$2/$f" ] && echo "$f"; done | sort | tr "\n" " ")
  echo "replaced: $replaced"; [ "$replaced" = "./src/entry.ts " ]' _ "$SKILL_DIR" "$REPO_DIR/arc-web-production/template"
step "typecheck (app, scene and Worker)" npm run typecheck
step "tests (the template's, plus Story and Scene tests for the scene)" npm test
step "style lint (tokens only, in styles.css and scene.css)" npm run lint:styles
step "scene lint (no colour literal, three.js only in scene.ts, exact pins)" npm run lint:scene
step "the scene lint can fail (a hex colour in scene code)" bash -c '
  cp src/scene/scene.ts .scene.ts.bak; trap "mv .scene.ts.bak src/scene/scene.ts" EXIT
  echo "const stray = \"#ff0000\"" >> src/scene/scene.ts
  ! node scripts/check-scene.mjs'
step "a Scene test can fail (a wrong screen text)" bash -c '
  cp test/scene.test.ts .scene.test.ts.bak; trap "mv .scene.test.ts.bak test/scene.test.ts" EXIT
  sed -i "s/Loading the chart…\")/Loading the graph…\")/" test/scene.test.ts
  ! node test/scene.test.ts'
step "vite build" npm run build
step "three.js is its own chunk, loaded on demand" bash -c '
  ls dist/assets/scene-*.js && ! grep -l "WebGLRenderer" dist/assets/index-*.js'
if [ -f "$REPO_DIR/arc-design/scripts/check-tokens.mjs" ]; then
  step "tokens match arc-design" node "$REPO_DIR/arc-design/scripts/check-tokens.mjs" "$WORK/src/tokens.css"
fi

# The scene in a real browser: the mock API and the built app, each on a free port.
browser="${CHROME_PATH:-}"
if [ -z "$browser" ]; then
  for name in chromium google-chrome google-chrome-stable; do
    if command -v "$name" > /dev/null 2>&1; then browser="$(command -v "$name")"; break; fi
  done
fi
label="browser: the scene draws in token colours, follows the Model, stops, falls back and disposes"
if [ -z "$browser" ]; then
  echo "SKIP $label: no browser"
else
  step "install playwright-core $PLAYWRIGHT_CORE (in the temp copy only)" npm install --save-exact --save-dev --no-audit --no-fund "playwright-core@$PLAYWRIGHT_CORE"
  api_port=$(free_port)
  PORT=$api_port node scripts/mock-api.ts > "$WORK/.mock.log" 2>&1 &
  mock=$!
  web_port=$(free_port)
  API_URL="http://127.0.0.1:$api_port" node node_modules/vite/bin/vite.js preview --port "$web_port" --strictPort > "$WORK/.web.log" 2>&1 &
  web=$!
  for _ in $(seq 1 50); do curl -sf "http://127.0.0.1:$web_port/api/notes" > /dev/null 2>&1 && break; sleep 0.3; done
  before=$pass
  step "$label" env CHROME_PATH="$browser" node test/scene.browser.mjs "http://127.0.0.1:$web_port"
  if [ "$pass" -gt "$before" ]; then grep -E '^(ok|SKIP|---) ' "$WORK/.step.log" | sed 's/^/  /'; fi
  # The browser test can fail too: point it at a page where the bar colour is wrong.
  step "the browser test can fail (a wrong --c1 in the test's copy of the tokens)" bash -c '
    cp src/tokens.css .tokens.css.bak; trap "mv .tokens.css.bak src/tokens.css" EXIT
    sed -i "0,/--c1:#ff2e93/s//--c1:#00ff00/" src/tokens.css
    ! env CHROME_PATH="$1" node test/scene.browser.mjs "$2"' _ "$browser" "http://127.0.0.1:$web_port"
fi

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
