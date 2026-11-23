#!/usr/bin/env bash
# Proves the template still works from a clean copy, without an org: npm ci, the Jest
# tests, a deliberately wrong expectation that must fail, the style lint, the Apex syntax
# and format check, offline conversion to Metadata API format, and the token module
# against arc-design. Needs the network for npm ci.
#
#   bash tests/test-template.sh            uses a fresh temp folder and removes it after
#   KEEP=1 bash tests/test-template.sh     keeps the folder and prints its path
#
# Not covered here (needs an org): Apex tests, deploy validation. See SKILL.md step 8.
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

tar --exclude=node_modules --exclude=.sf -C "$SKILL_DIR/template" -cf - . | tar -C "$WORK" -xf -
cd "$WORK"
export SF_DISABLE_TELEMETRY=true

step "npm ci (from the lockfile)" npm ci --no-audit --no-fund
step "Jest tests (every state of accountList)" npm test
test_file=force-app/main/default/lwc/accountList/__tests__/accountList.test.js
cp "$test_file" "$WORK/.test.bak"
sed -i.tmp "s/toBe('Loading accounts…')/toBe('Loading nothing')/" "$test_file" && rm -f "$test_file.tmp"
step "a wrong expectation fails" bash -c '! npx sfdx-lwc-jest > .wrong.log 2>&1 && grep -q "Loading nothing" .wrong.log'
cp "$WORK/.test.bak" "$test_file"
step "style lint (tokens only, motion guarded)" npm run lint:styles
step "Apex parses and is formatted" npm run apex:check
step "source converts to Metadata API format" npm run source:check
step "token module matches arc-design (host exception)" node scripts/sync-tokens.mjs "$REPO_DIR/arc-design/tokens.css" --check

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
