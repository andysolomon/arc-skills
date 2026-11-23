#!/usr/bin/env bash
# Runs what CI runs (.github/workflows/ci.yml), on this machine.
#
#   bash scripts/ci.sh             everything
#   bash scripts/ci.sh checks      the fast checks: skills install, tokens, evals files, page and inventory tests
#   bash scripts/ci.sh templates   the template and overlay tests (each runs npm ci; needs the network)
#
# The template tests use mktemp, so set TMPDIR to a disk with a few GB free when /tmp is small.
# Not run here or in CI: the eval cases themselves and the fresh-agent gates. Both need a model.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
what="${1:-all}"
pass=0; fail=0
step() { # step <label> <command...>
  local label="$1"; shift
  local log; log="$(mktemp)"
  if "$@" > "$log" 2>&1; then echo "PASS $label"; pass=$((pass + 1))
  else echo "FAIL $label"; tail -25 "$log" | sed 's/^/  /'; fail=$((fail + 1)); fi
  rm -f "$log"
}

CHECKS=(
  "skills install as open agent skills|bash scripts/check-skills.sh"
  "token copies match arc-design|node arc-design/scripts/check-tokens.mjs"
  "component kit tokens match arc-design|node arc-design/scripts/check-tokens.mjs arc-html-response/components.html"
  "Salesforce token module matches arc-design|node arc-salesforce-engineering/template/scripts/sync-tokens.mjs arc-design/tokens.css --check"
  "evals files are well formed|node scripts/check-evals.mjs"
  "page lint tests|bash arc-html-response/tests/test-lint.sh"
  "page chart tests|bash arc-html-response/tests/test-chart.sh"
  "page capture tests|bash arc-html-response/tests/test-capture.sh"
  "architecture inventory test|bash arc-system-architecture/tests/test-inventory.sh"
)
TEMPLATES=(
  "arc-web-production template|bash arc-web-production/tests/test-template.sh"
  "arc-salesforce-engineering template|bash arc-salesforce-engineering/tests/test-template.sh"
  "arc-interaction overlay|bash arc-interaction/tests/test-overlay.sh"
  "arc-realtime overlay|bash arc-realtime/tests/test-overlay.sh"
  "arc-3d overlay|bash arc-3d/tests/test-overlay.sh"
)
run() { local entry; for entry in "$@"; do step "${entry%%|*}" bash -c "${entry#*|}"; done; }

case "$what" in
  checks) run "${CHECKS[@]}" ;;
  templates) run "${TEMPLATES[@]}" ;;
  all) run "${CHECKS[@]}"; run "${TEMPLATES[@]}" ;;
  *) echo "usage: bash scripts/ci.sh [checks|templates]"; exit 2 ;;
esac
echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
