#!/usr/bin/env bash
# Lists where things run, from files in a repo and (with --machine) from this machine.
# Read-only: it reads files and asks local tools for status; it changes nothing and
# calls no cloud API. Every line it prints is an observation, so the architecture can
# start from facts rather than memory.
#
#   bash inventory.sh [repo-dir] [--machine]
set -uo pipefail

ROOT="."; MACHINE=0
for arg in "$@"; do
  case "$arg" in
    --machine) MACHINE=1 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) ROOT="$arg" ;;
  esac
done
[ -d "$ROOT" ] || { echo "not a directory: $ROOT" >&2; exit 2; }
ROOT="$(cd "$ROOT" && pwd)"

# every file under ROOT except dependency, build and state folders
files() {
  find "$ROOT" \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .alchemy \
    -o -name .terraform -o -name .sf -o -name .sfdx -o -name .venv -o -name vendor -o -name .next \) -prune \
    -o -type f -print 2>/dev/null | sed "s|^$ROOT/||" | sort
}
ALL="$(files)"
match() { grep -E "$1" <<<"$ALL" || true; }
say() { printf -- '- `%s`: %s\n' "$1" "$2"; }
found=0
section() { printf '\n### %s\n' "$1"; }

echo "## Repo: $ROOT"

hits="$(match '(^|/)alchemy\.run\.(ts|js|mjs)$')"
if [ -n "$hits" ]; then section "Alchemy stacks"; while read -r f; do
  kinds="$(grep -oE '(Cloudflare|AWS|Aws|Neon|PlanetScale|Stripe|GitHub|Docker)\.[A-Z][A-Za-z0-9]+' "$ROOT/$f" | sort -u | tr '\n' ' ')"
  say "$f" "Alchemy stack${kinds:+; resources: $kinds}"; found=1; done <<<"$hits"; fi

hits="$(match '(^|/)wrangler\.(toml|json|jsonc)$')"
if [ -n "$hits" ]; then section "Cloudflare (Wrangler)"; while read -r f; do say "$f" "Wrangler config"; found=1; done <<<"$hits"; fi

hits="$(match '(^|/)(docker-)?compose(\.[A-Za-z0-9_-]+)?\.ya?ml$')"
if [ -n "$hits" ]; then section "Docker Compose"; while read -r f; do
  services="$(awk '/^services:/{s=1;next} s&&/^[^ #]/{s=0} s&&/^  [A-Za-z0-9_.-]+:/{gsub(/[ :]/,"");printf "%s ",$0}' "$ROOT/$f")"
  say "$f" "compose file${services:+; services: $services}"; found=1; done <<<"$hits"; fi

hits="$(match '(^|/)(Dockerfile|Containerfile)(\.[A-Za-z0-9_-]+)?$')"
if [ -n "$hits" ]; then section "Container images"; while read -r f; do
  base="$(grep -iE '^FROM ' "$ROOT/$f" | awk '{print $2}' | tr '\n' ' ')"
  say "$f" "image build${base:+; from: $base}"; found=1; done <<<"$hits"; fi

hits="$(match '\.tf$')"
if [ -n "$hits" ]; then section "Terraform"; while read -r f; do
  providers="$(grep -oE '^(provider|resource) "[a-z0-9_]+"' "$ROOT/$f" | awk '{print $2}' | tr -d '"' | sort -u | tr '\n' ' ')"
  say "$f" "Terraform${providers:+; $providers}"; found=1; done <<<"$hits"; fi

hits="$(match '\.ya?ml$' | while read -r f; do
  grep -qE '^apiVersion:' "$ROOT/$f" 2>/dev/null && grep -qE '^kind:' "$ROOT/$f" 2>/dev/null && echo "$f"; done)"
if [ -n "$hits" ]; then section "Kubernetes manifests"; while read -r f; do
  kinds="$(grep -E '^kind:' "$ROOT/$f" | awk '{print $2}' | sort -u | tr '\n' ' ')"
  say "$f" "kinds: $kinds"; found=1; done <<<"$hits"; fi

hits="$(match '(^|/)Chart\.yaml$')"
if [ -n "$hits" ]; then section "Helm charts"; while read -r f; do say "$f" "Helm chart"; found=1; done <<<"$hits"; fi

hits="$(match '(^|/)(fly\.toml|vercel\.json|netlify\.toml|render\.yaml|Procfile|app\.yaml|serverless\.ya?ml|railway\.json)$')"
if [ -n "$hits" ]; then section "Other hosting configs"; while read -r f; do say "$f" "$(basename "$f") config"; found=1; done <<<"$hits"; fi

hits="$( { match '(^|/)\.lakebed/'; match '(^|/)lakebed\.(config\.)?(ts|js|json)$'; } | sed -E 's|(^\|/)\.lakebed/.*|\1.lakebed/|' | sort -u)"
if [ -n "$hits" ]; then section "Lakebed"; while read -r f; do say "$f" "Lakebed capsule (expires unless claimed)"; found=1; done <<<"$hits"; fi

hits="$(match '(^|/)sfdx-project\.json$')"
if [ -n "$hits" ]; then section "Salesforce"; while read -r f; do say "$f" "Salesforce DX project (runs inside an org)"; found=1; done <<<"$hits"; fi

hits="$(match '^\.github/workflows/.*\.ya?ml$|(^|/)\.gitlab-ci\.yml$')"
if [ -n "$hits" ]; then section "CI"; while read -r f; do
  if grep -qiE 'deploy|publish|release|apply' "$ROOT/$f"; then say "$f" "CI workflow that deploys or releases"; else say "$f" "CI workflow (no deploy step found)"; fi
  found=1; done <<<"$hits"; fi

hits="$(match '(^|/)package\.json$')"
if [ -n "$hits" ]; then
  out="$(while read -r f; do
    s="$(node -e 'const p=require(process.argv[1]);const s=p.scripts||{};console.log(Object.entries(s).filter(([k,v])=>/deploy|serve|start|destroy|wrangler|alchemy|lakebed|docker|tailscale|kubectl|sf /.test(k+" "+v)).map(([k])=>k).join(" "))' "$ROOT/$f" 2>/dev/null)"
    [ -n "$s" ] && say "$f" "run/deploy scripts: $s"
  done <<<"$hits")"
  if [ -n "$out" ]; then section "npm scripts that run or ship"; echo "$out"; found=1; fi
fi

[ "$found" = 1 ] || echo "- nothing found that says where this runs (no stack, compose, manifest or hosting config)"

if [ "$MACHINE" = 1 ]; then
  echo; echo "## Machine: $(uname -n)"
  section "Listening TCP ports"
  if command -v ss >/dev/null; then ss -ltnpH 2>/dev/null | awk '{p=$6; sub(/.*\(\("/,"",p); sub(/".*/,"",p); printf "- `%s`%s\n", $4, (p!=""&&p!=$6?" ("p")":"")}' | sort -u
  elif command -v lsof >/dev/null; then lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{printf "- `%s` (%s)\n",$9,$1}' | sort -u
  else echo "- unknown: neither ss nor lsof is installed"; fi

  section "Tailscale serve"
  if command -v tailscale >/dev/null; then
    out="$(tailscale serve status 2>&1)"; echo "$out" | sed 's/^/    /'
  else echo "- tailscale is not installed"; fi

  section "Docker containers"
  if command -v docker >/dev/null; then
    out="$(docker ps --format '- `{{.Names}}`: {{.Image}} {{.Ports}}' 2>&1)" || out="- unknown: $(head -1 <<<"$out")"
    echo "${out:-- none running}"
  else echo "- docker is not installed"; fi

  section "Kubernetes context"
  if command -v kubectl >/dev/null; then
    ctx="$(kubectl config current-context 2>/dev/null)"
    if [ -n "$ctx" ]; then echo "- current context \`$ctx\` (not contacted)"; else echo "- no current context"; fi
  else echo "- kubectl is not installed"; fi
fi
