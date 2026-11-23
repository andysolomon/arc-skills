#!/usr/bin/env bash
# Proves the overlay still works on the CURRENT arc-web-production template: a clean copy of
# the template, npm ci, the overlay applied by scripts/apply-overlay.sh (which installs the
# exact-pinned extra packages), then typecheck, tests, style lint, build, the API check
# (HTTP and socket) against the mock and against the real Worker on local workerd, and the
# two-person check in a real browser against both. Needs the network for npm. Deploys nothing.
#
#   bash tests/test-overlay.sh            uses a fresh temp folder and removes it after
#   KEEP=1 bash tests/test-overlay.sh     keeps the folder and prints its path
#   CHROME_PATH=/path/to/chrome ...       the browser to use; else chromium or google-chrome on PATH
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$SKILL_DIR/.." && pwd)"
TEMPLATE="$REPO_DIR/arc-web-production/template"
WORK="$(mktemp -d)"

# Exact pin for the browser steps, installed in the temp copy only. The mock's pins are in
# scripts/apply-overlay.sh. Keep both in step with SKILL.md's Pins section.
PLAYWRIGHT=playwright-core@1.65.1

mock=""; vite=""; cfdev=""; wport=""
listening() { ss -ltn 2>/dev/null | grep -q "[:.]$1 "; }
closed() { for _ in $(seq 1 60); do listening "$1" || return 0; sleep 0.5; done; return 1; }
# cf:dev runs workerd in its own session, so killing npm alone leaves the port held. SIGINT
# to npm's process group is what Ctrl-C does: alchemy then stops workerd itself.
stop_cfdev() {
  [ -n "$cfdev" ] || return 0
  kill -INT -- "-$cfdev" 2>/dev/null || kill -INT "$cfdev" 2>/dev/null || true
  cfdev=""
  closed "$wport"
}
cleanup() {
  [ -n "$mock" ] && kill "$mock" 2>/dev/null || true
  [ -n "$vite" ] && kill "$vite" 2>/dev/null || true
  stop_cfdev || true
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
up() { for _ in $(seq 1 "${2:-60}"); do curl -sf "$1" >/dev/null 2>&1 && return 0; sleep 0.5; done; return 1; }

# The overlay replaces the template files listed in overlay-base.sha256. If the template
# changed one of them, the overlay's copy is out of date: merge the template's change into
# overlay/<file>, then refresh the sums with
#   files=$(awk '{print $2}' arc-realtime/overlay-base.sha256)
#   (cd arc-web-production/template && sha256sum $files) > arc-realtime/overlay-base.sha256
step "replaced template files are the ones the overlay was built on" bash -c "cd '$TEMPLATE' && sha256sum -c '$SKILL_DIR/overlay-base.sha256'"

cp -R "$TEMPLATE/." "$WORK/"
cd "$WORK"

step "npm ci (the template's lockfile)" npm ci --no-audit --no-fund
step "apply-overlay.sh (overlay files, ws and @types/ws pinned, package scripts)" bash "$SKILL_DIR/scripts/apply-overlay.sh" "$WORK"
step "apply-overlay.sh a second time changes nothing" bash -c "cp package.json .package.before && bash '$SKILL_DIR/scripts/apply-overlay.sh' '$WORK' && cmp package.json .package.before && rm .package.before"
step "typecheck (app and Worker)" npm run typecheck
step "tests (template tests, then Story, Scene, stream and Command tests for the socket)" npm test
# The tests can fail: a wrong screen text in a temporary copy must be caught.
sed 's/toHaveText("Offline")/toHaveText("Online")/' test/realtime.test.ts > test/.wrong.test.ts
step "a wrong expectation fails" bash -c '! node test/.wrong.test.ts'
rm -f test/.wrong.test.ts
step "style lint (styles.css, fonts.css and realtime.css)" bash -c "npm run lint:styles | grep -q 'src/realtime.css uses tokens only'"
step "vite build" npm run build
step "tokens copy is byte-identical" cmp "$REPO_DIR/arc-design/tokens.css" "$WORK/src/tokens.css"

# A browser, in the order the brief names. None found: the browser steps are skipped.
browser="${CHROME_PATH:-}"
if [ -z "$browser" ]; then
  for name in chromium google-chrome google-chrome-stable; do
    if command -v "$name" >/dev/null 2>&1; then browser="$(command -v "$name")"; break; fi
  done
fi
if [ -n "$browser" ]; then step "$PLAYWRIGHT for the browser steps" npm install --save-exact --save-dev --no-audit --no-fund "$PLAYWRIGHT"; fi

# Against the mock: the API check on the mock itself, the browser through Vite's proxy.
mport=$(free_port); vport=$(free_port)
PORT=$mport node scripts/mock-api.ts > "$WORK/.mock.log" 2>&1 &
mock=$!
up "http://127.0.0.1:$mport/api/notes" || true
step "API check against the mock (HTTP and socket)" node scripts/api-check.ts "http://127.0.0.1:$mport"
if [ -n "$browser" ]; then
  WEB_PORT=$vport API_URL="http://127.0.0.1:$mport" node node_modules/vite/bin/vite.js > "$WORK/.vite.log" 2>&1 &
  vite=$!
  up "http://127.0.0.1:$vport/" || true
  step "browser, mock: two people, a live note, presence, a data channel, a reconnect" env CHROME_PATH="$browser" node test/two-people.browser.mjs "http://127.0.0.1:$vport"
  kill "$vite" 2>/dev/null || true; vite=""
else
  echo "SKIP browser, mock: no browser"
fi
kill "$mock" 2>/dev/null || true; mock=""

# Against the real Worker on local workerd: the built app and the Durable Object on one origin.
wport=$(free_port)
set -m # the job gets its own process group, so it can be sent Ctrl-C as a whole
PORT=$wport npm run cf:dev > "$WORK/.cfdev.log" 2>&1 &
cfdev=$!
set +m
if up "http://127.0.0.1:$wport/api/notes" 180; then
  step "API check against the Worker on local workerd (HTTP and socket)" node scripts/api-check.ts "http://127.0.0.1:$wport"
  if [ -n "$browser" ]; then
    step "browser, workerd: two people, a live note, presence, a data channel, a reconnect" env CHROME_PATH="$browser" node test/two-people.browser.mjs "http://127.0.0.1:$wport"
  else
    echo "SKIP browser, workerd: no browser"
  fi
else
  step "cf:dev starts on local workerd" bash -c "tail -20 '$WORK/.cfdev.log'; exit 1"
fi
step "cf:dev stops on SIGINT and its port closes" stop_cfdev

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
