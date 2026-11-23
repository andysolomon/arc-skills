#!/usr/bin/env bash
# Proves the template still works from a clean copy: install, typecheck, tests, build,
# static render, and the page lint. Needs the network (npm install).
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

step "npm install" npm install --no-audit --no-fund
step "typecheck (app and Worker)" npm run typecheck
step "tests (Story, Scene, update)" npm test
step "vite build" npm run build
step "static render has no script" npm run static
if [ -f "$REPO_DIR/arc-html-response/scripts/lint.sh" ]; then
  step "static page passes the page lint" bash "$REPO_DIR/arc-html-response/scripts/lint.sh" "$WORK/dist/static.html"
fi
if [ -f "$REPO_DIR/arc-design/scripts/check-tokens.mjs" ]; then
  step "tokens match arc-design" node "$REPO_DIR/arc-design/scripts/check-tokens.mjs" "$WORK/src/tokens.css"
fi
step "styles use tokens only (no hex colours)" bash -c '! grep -nE "#[0-9a-fA-F]{3,8}\b" src/styles.css'

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
