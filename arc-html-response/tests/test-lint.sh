#!/usr/bin/env bash
# Tests for scripts/lint.sh. Run: bash arc-html-response/tests/test-lint.sh
set -u

here=$(cd "$(dirname "$0")" && pwd)
skill=$(dirname "$here")
lint="$skill/scripts/lint.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

pass=0 fail=0

# Keep the base cases independent of whether diagram-design is installed.
export DIAGRAM_DESIGN_DIR=none

page() { # page <name> <head-extra> <body>
  cat > "$work/$1.html" <<EOF
<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test Page</title><style>body{color:#fff}$2</style></head>
<body>$3</body></html>
EOF
}

expect() { # expect <0|1> <name> [output-substring]
  local want=$1 name=$2 needle=${3:-} out code
  out=$(bash "$lint" "$work/$name.html" 2>&1); code=$?
  if [ "$code" -ne "$want" ]; then
    echo "not ok  $name: exit $code, want $want"; echo "$out" | sed 's/^/        /'; fail=$((fail + 1)); return
  fi
  if [ -n "$needle" ] && ! grep -qF -- "$needle" <<<"$out"; then
    echo "not ok  $name: output lacks '$needle'"; echo "$out" | sed 's/^/        /'; fail=$((fail + 1)); return
  fi
  echo "ok      $name"; pass=$((pass + 1))
}

SVG_OK='<svg viewBox="0 0 10 10" role="img" aria-labelledby="dot-title dot-desc"><title id="dot-title">Dot</title><desc id="dot-desc">One dot.</desc><circle cx="5" cy="5" r="4"/></svg>'
page clean '' "<p>Hello</p>$SVG_OK"
expect 0 clean PASS

page svg-no-desc '' '<svg viewBox="0 0 10 10" role="img"><title>Dot</title><circle cx="5" cy="5" r="4"/></svg>'
expect 1 svg-no-desc 'needs a <title> and a <desc>'

page svg-decorative '' '<svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4"/></svg>'
expect 0 svg-decorative PASS

page inline-script '' '<script>alert(1)</script>'
expect 1 inline-script '<script>'

page cdn-script '' '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>'
expect 1 cdn-script '<script>'

page handler '' '<p onclick="x()">x</p>'
expect 1 handler 'on*= handler'

page js-url '' '<a href="javascript:void(0)">x</a>'
expect 1 js-url 'javascript: URL'

page link-tag '' '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">'
expect 1 link-tag '<link>'

page font-face '@font-face{font-family:X;src:url(https://x.test/x.woff2)}' '<p>x</p>'
expect 1 font-face '@font-face'

page form-tag '' '<form><input></form>'
expect 1 form-tag 'blocked tag'

page input-ok '' '<input type="radio" id="a"><label for="a">A</label>'
expect 0 input-ok PASS

page local-path '' '<p>Saved to /home/someone/project/report.html</p>'
expect 1 local-path 'local path'

page local-img '' '<img src="chart.png" alt="">'
expect 1 local-img 'image not from https'

page remote-img '' '<img src="https://example.com/a.png" alt=""><img src="data:image/png;base64,AA" alt="">'
expect 0 remote-img PASS

page unguarded-motion '@keyframes grow{from{transform:scaleX(0)}} .b{animation:grow 1s}' '<p>x</p>'
expect 1 unguarded-motion 'prefers-reduced-motion'

page guarded-motion '@media (prefers-reduced-motion: no-preference){.b{animation:grow 1s backwards}} @keyframes grow{from{transform:scaleX(0)}}' '<p>x</p>'
expect 0 guarded-motion PASS

page scroll-driven '@media (prefers-reduced-motion: no-preference){section{animation:r linear both;animation-timeline:view()}} @keyframes r{from{opacity:0}}' '<p>x</p>'
expect 1 scroll-driven 'scroll-driven'

page prose-mentions-css '' '<p>Avoid <code>animation-timeline</code> and <code>@import</code> on these pages.</p>'
expect 0 prose-mentions-css PASS

page em-dash '' '<p>One — two</p>'
expect 0 em-dash 'WARN em dash'

head -c 600000 /dev/zero | tr '\0' 'a' > "$work/big-body.txt"
page too-big '' "<p>$(cat "$work/big-body.txt")</p>"
expect 1 too-big 'size:'

# diagram-design's self_check runs when the skill is found, and its failure fails the lint.
stub="$work/dd-stub"; mkdir -p "$stub/scripts"
printf 'import sys\nprint("FAIL x")\nprint("  - stub finding")\nsys.exit(1)\n' > "$stub/scripts/self_check.py"
DIAGRAM_DESIGN_DIR="$stub" expect 1 clean 'stub finding'
printf 'import sys\nprint("OK")\n' > "$stub/scripts/self_check.py"
DIAGRAM_DESIGN_DIR="$stub" expect 0 clean PASS
printf 'import sys\nprint("FAIL x")\nprint("  - remote reference on <a>: https://example.com")\nsys.exit(1)\n' > "$stub/scripts/self_check.py"
DIAGRAM_DESIGN_DIR="$stub" expect 0 clean PASS
page no-svg '' '<p>No diagram here</p>'
printf 'import sys\nprint("  - stub finding")\nsys.exit(1)\n' > "$stub/scripts/self_check.py"
DIAGRAM_DESIGN_DIR="$stub" expect 0 no-svg PASS

# The skill's own pages must pass.
for f in template components; do
  out=$(bash "$lint" "$skill/$f.html" 2>&1)
  if [ $? -eq 0 ]; then echo "ok      $f.html passes lint"; pass=$((pass + 1))
  else echo "not ok  $f.html fails lint"; echo "$out" | sed 's/^/        /'; fail=$((fail + 1)); fi
done

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
