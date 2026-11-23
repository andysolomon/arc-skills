#!/usr/bin/env bash
# Tests for scripts/frames.mjs and the input checks of scripts/stage.mjs and scripts/hairline.mjs.
# Run: bash arc-html-response/tests/test-capture.sh
# stage.mjs's capture itself needs Chrome and an installed stageshow, so it runs in the
# release gate (tests/fresh-agent.md), not here.
set -u

here=$(cd "$(dirname "$0")" && pwd)
skill=$(dirname "$here")
frames="$skill/scripts/frames.mjs"
stage="$skill/scripts/stage.mjs"
hairline="$skill/scripts/hairline.mjs"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
pass=0 fail=0

ok()  { echo "ok      $1"; pass=$((pass + 1)); }
bad() { echo "not ok  $1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | head -8 | sed 's/^/        /'; fail=$((fail + 1)); }
has() { if grep -qF -- "$2" <<<"$3"; then ok "$1"; else bad "$1" "$3"; fi; }
code() { # code <name> <want> <cmd...>
  local name=$1 want=$2; shift 2
  local out; out=$("$@" 2>&1); local got=$?
  if [ "$got" -eq "$want" ]; then ok "$name"; else bad "$name: exit $got, want $want" "$out"; fi
}

# frames.mjs: one frame per --at time plus the poster, each a srcdoc copy of the page.
node "$frames" "$skill/components.html" --at 0,250 --select .bars --out "$work/kit.frames.html" 2>/dev/null
sheet=$(cat "$work/kit.frames.html")
n=$(grep -o '<iframe ' <<<"$sheet" | wc -l | tr -d ' ')
[ "$n" -eq 3 ] && ok "two times plus the poster make three frames" || bad "frame count is $n, want 3"
has "frames are labelled in ms" '<b>250 ms</b>' "$sheet"
has "the last frame is the poster" '<b>poster (all settled)</b>' "$sheet"
has "the poster finishes every finite animation" 'finite ? timing.endTime : 0' "$sheet"
has "frames scroll to --select" '&quot;.bars&quot;' "$sheet"
has "the page is escaped into srcdoc" 'srcdoc="&lt;!doctype html&gt;' "$sheet"
has "the sheet says it is preview only" 'for preview only' "$sheet"
node "$frames" "$skill/template.html" 2>/dev/null
[ -f "$skill/template.frames.html" ] && ok "default output sits next to the page" || bad "no template.frames.html next to the page"
rm -f "$skill/template.frames.html"
code "frames: a bad time exits 2" 2 node "$frames" "$skill/template.html" --at 0,soon --out "$work/x.html"
code "frames: a missing page exits 2" 2 node "$frames" "$work/none.html"
code "frames: an out-of-range width exits 2" 2 node "$frames" "$skill/template.html" --width 9000 --out "$work/x.html"
code "frames: --help exits 0" 0 node "$frames" --help

# stage.mjs: bad input is refused before any browser starts.
code "stage: --help exits 0" 0 node "$stage" --help
code "stage: no arguments exits 2" 2 node "$stage"
code "stage: a missing --label exits 2" 2 node "$stage" --stageshow "$work" --url http://127.0.0.1:1/ --slug s --out "$work/s"
code "stage: a bad slug exits 2" 2 node "$stage" --stageshow "$work" --url http://127.0.0.1:1/ --slug "Bad Slug" --label l --out "$work/s"
code "stage: a bad theme exits 2" 2 node "$stage" --stageshow "$work" --url http://127.0.0.1:1/ --slug s --label l --theme sepia --out "$work/s"
code "stage: a folder that isn't stageshow exits 2" 2 node "$stage" --stageshow "$work" --url http://127.0.0.1:1/ --slug s --label l --out "$work/s"
echo '{"name":"x"}' > "$work/package.json"
out=$(node "$stage" --stageshow "$work" --url http://127.0.0.1:1/ --slug s --label l --out "$work/s" 2>&1)
has "stage: missing playwright-core says to npm install" 'run npm install there first' "$out"

# hairline.mjs: bad input is refused before any browser starts.
code "hairline: --help exits 0" 0 node "$hairline" --help
code "hairline: no arguments exits 2" 2 node "$hairline"
code "hairline: a missing --desc exits 2" 2 node "$hairline" --page "$work/p.html" --slug s --title t --out "$work/s.svg"
code "hairline: a bad slug exits 2" 2 node "$hairline" --page "$work/p.html" --slug "Bad Slug" --title t --desc d --out "$work/s.svg"
code "hairline: --at outside the viewBox exits 2" 2 node "$hairline" --page "$work/p.html" --slug s --title t --desc d --at 500,10 --out "$work/s.svg"
code "hairline: a missing page exits 2" 2 node "$hairline" --page "$work/none.html" --slug s --title t --desc d --out "$work/s.svg"
echo '<!doctype html><p>not a figure</p>' > "$work/p.html"
out=$(node "$hairline" --page "$work/p.html" --slug s --title t --desc d --out "$work/s.svg" 2>&1)
has "hairline: a page that isn't Hairline is refused" 'is not a Hairline page' "$out"

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
