#!/usr/bin/env bash
# Runs inventory.sh against a fixture repo with one of each kind of file and checks
# what it reports, including that dependency folders are skipped. No network.
#
#   bash tests/test-inventory.sh
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

mkdir -p cloudflare k8s infra .github/workflows node_modules/dep sf
cat > cloudflare/alchemy.run.ts <<'TS'
const worker = Cloudflare.Worker("api", {}); const db = Cloudflare.D1Database("db", {});
TS
cat > compose.yaml <<'YML'
services:
  web:
    image: nginx
  db:
    image: postgres:17
volumes:
  data: {}
YML
printf 'FROM node:24-slim\nRUN true\n' > Dockerfile
printf 'apiVersion: apps/v1\nkind: Deployment\n---\napiVersion: v1\nkind: Service\n' > k8s/app.yaml
printf 'provider "cloudflare" {}\nresource "cloudflare_record" "www" {}\n' > infra/main.tf
printf 'jobs:\n  ship:\n    steps:\n      - run: npm run deploy\n' > .github/workflows/ship.yml
printf '{"scripts":{"deploy":"alchemy deploy","test":"node t.js"}}\n' > package.json
printf '{"packageDirectories":[]}\n' > sf/sfdx-project.json
printf 'kind: Ignored\napiVersion: v1\n' > node_modules/dep/ignored.yaml
printf 'FROM scratch\n' > node_modules/dep/Dockerfile

out="$(bash "$SKILL_DIR/scripts/inventory.sh" "$WORK")"
pass=0; fail=0
expect() { # expect <label> <fixed string>
  if grep -qF -- "$2" <<<"$out"; then echo "PASS $1"; pass=$((pass + 1)); else echo "FAIL $1: missing: $2"; fail=$((fail + 1)); fi
}
refuse() { # refuse <label> <fixed string>
  if grep -qF -- "$2" <<<"$out"; then echo "FAIL $1: found: $2"; fail=$((fail + 1)); else echo "PASS $1"; pass=$((pass + 1)); fi
}
expect "Alchemy stack and its resources" 'resources: Cloudflare.D1Database Cloudflare.Worker'
expect "compose services, not volumes" 'services: web db '
expect "image base" 'from: node:24-slim'
expect "Kubernetes kinds" 'kinds: Deployment Service'
expect "Terraform providers and resources" 'cloudflare cloudflare_record'
expect "CI that deploys" 'CI workflow that deploys or releases'
expect "npm scripts that ship, not test" 'run/deploy scripts: deploy'
expect "Salesforce project" 'sf/sfdx-project.json'
refuse "node_modules skipped" 'node_modules'
refuse "test script not listed as shipping" 'deploy test'
empty="$(mktemp -d)"; trap 'rm -rf "$WORK" "$empty"' EXIT
if bash "$SKILL_DIR/scripts/inventory.sh" "$empty" | grep -qF 'nothing found'; then echo "PASS empty repo says nothing found"; pass=$((pass + 1)); else echo "FAIL empty repo"; fail=$((fail + 1)); fi

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
