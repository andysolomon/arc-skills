#!/usr/bin/env bash
# Proves the template still works from a clean copy: npm ci, typecheck, tests, style lint,
# build, static render, the page lint, and the API check against the mock. Needs the network.
#
#   bash tests/test-template.sh            uses a fresh temp folder and removes it after
#   KEEP=1 bash tests/test-template.sh     keeps the folder and prints its path
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$SKILL_DIR/.." && pwd)"
WORK="$(mktemp -d)"
trap '[ "${KEEP:-}" = 1 ] && echo "kept: $WORK" || rm -rf "$WORK"' EXIT

pass=0; fail=0
step() { # step <label> <command...>
  local label="$1"; shift
  if "$@" > "$WORK/.step.log" 2>&1; then echo "PASS $label"; pass=$((pass + 1))
  else echo "FAIL $label"; tail -20 "$WORK/.step.log" | sed 's/^/  /'; fail=$((fail + 1)); fi
}

cp -R "$SKILL_DIR/template/." "$WORK/"
cd "$WORK"

step "npm ci (from the lockfile)" npm ci --no-audit --no-fund
step "typecheck (app and Worker)" npm run typecheck
step "tests (Story, Scene, update, Commands)" npm test
step "style lint (tokens only, motion guarded)" npm run lint:styles
step "vite build" npm run build
step "build ships the Geist files" bash -c 'ls dist/assets/Geist-Variable-*.woff2 dist/assets/GeistMono-Variable-*.woff2'
step "static render has no script" npm run static
if [ -f "$REPO_DIR/arc-html-response/scripts/lint.sh" ]; then
  step "static page passes the page lint" bash "$REPO_DIR/arc-html-response/scripts/lint.sh" "$WORK/dist/static.html"
fi
if [ -f "$REPO_DIR/arc-design/scripts/check-tokens.mjs" ]; then
  step "tokens match arc-design" node "$REPO_DIR/arc-design/scripts/check-tokens.mjs" "$WORK/src/tokens.css"
fi
step "tokens copy is byte-identical" cmp "$REPO_DIR/arc-design/tokens.css" "$WORK/src/tokens.css"

# API check against the mock, on a free port
port=$(node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
PORT=$port node scripts/mock-api.ts > "$WORK/.mock.log" 2>&1 &
mock=$!
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$port/api/notes" >/dev/null 2>&1 && break; sleep 0.3; done
step "API check against the mock" node scripts/api-check.ts "http://127.0.0.1:$port"
kill "$mock" 2>/dev/null || true

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
