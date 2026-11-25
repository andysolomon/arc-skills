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

expect() { # expect <0|1> <name> [output-substring]; LINT_FLAGS adds flags such as --scripted
  local want=$1 name=$2 needle=${3:-} out code
  out=$(bash "$lint" ${LINT_FLAGS:-} "$work/$name.html" 2>&1); code=$?
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

page leftover-keyframes '@keyframes rise{from{opacity:0}} .still{animation:none!important}' '<p>x</p>'
expect 0 leftover-keyframes PASS

page guarded-motion '@media (prefers-reduced-motion: no-preference){.b{animation:grow 1s backwards}} @keyframes grow{from{transform:scaleX(0)}}' '<p>x</p>'
expect 0 guarded-motion PASS

page scroll-driven '@media (prefers-reduced-motion: no-preference){section{animation:r linear both;animation-timeline:view()}} @keyframes r{from{opacity:0}}' '<p>x</p>'
expect 1 scroll-driven 'scroll-driven'

page prose-mentions-css '' '<p>Avoid <code>animation-timeline</code> and <code>@import</code> on these pages.</p>'
expect 0 prose-mentions-css PASS

page em-dash '' '<p>One — two</p>'
expect 0 em-dash 'WARN em dash'

page transition-all '.b{transition:all .2s}' '<p>x</p>'
expect 0 transition-all 'WARN transition: all'

page ease-in '.b{transition:opacity .2s ease-in}' '<p>x</p>'
expect 0 ease-in 'WARN ease-in'

page ease-in-out-ok '.b{transition:transform .3s ease-in-out}' '<p>x</p>'
expect 0 ease-in-out-ok '(0 warning(s)'

head -c 600000 /dev/zero | tr '\0' 'a' > "$work/big-body.txt"
page too-big '' "<p>$(cat "$work/big-body.txt")</p>"
expect 1 too-big 'size:'

# The scripted rung (--scripted): one plain inline script that keeps nothing and sends nothing.
BTN='<button type="button" id="b" hidden>Next</button>'
page sc-ok '' "$BTN<script>const b=document.getElementById('b');b.hidden=false;b.addEventListener('click',()=>{b.textContent='Done'})</script>"
LINT_FLAGS=--scripted expect 0 sc-ok '(0 warning(s)'
LINT_FLAGS= expect 1 sc-ok 'lint it with --scripted'

page sc-two "" "$BTN<script>1</script><script>2</script>"
LINT_FLAGS=--scripted expect 1 sc-two 'a scripted page has one'

page sc-src '' "$BTN<script src=\"https://cdn.jsdelivr.net/npm/x@1.0.0\"></script>"
LINT_FLAGS=--scripted expect 1 sc-src '<script src>'

page sc-module '' "$BTN<script type=\"module\">1</script>"
LINT_FLAGS=--scripted expect 1 sc-module 'with attributes'

page sc-fetch '' "$BTN<script>
fetch('/api/votes')
</script>"
LINT_FLAGS=--scripted expect 1 sc-fetch 'network call'

page sc-socket '' "$BTN<script>new WebSocket('wss://x.test')</script>"
LINT_FLAGS=--scripted expect 1 sc-socket 'network call'

page sc-storage '' "$BTN<script>localStorage.setItem('k','v')</script>"
LINT_FLAGS=--scripted expect 1 sc-storage 'keeps nothing'

page sc-eval '' "$BTN<script>eval('1')</script>"
LINT_FLAGS=--scripted expect 1 sc-eval 'from a string'

page sc-innerhtml '' "$BTN<script>document.body.innerHTML='<p>x</p>'</script>"
LINT_FLAGS=--scripted expect 1 sc-innerhtml 'from a string'

page sc-parent '' "$BTN<script>window.parent.postMessage('x','*')</script>"
LINT_FLAGS=--scripted expect 1 sc-parent 'outside its frame'

page sc-animate '' "$BTN<script>document.body.animate([{opacity:0}],200)</script>"
LINT_FLAGS=--scripted expect 1 sc-animate 'motion stays CSS'

page sc-handler '' "<button onclick=\"go()\">Go</button><script>function go(){}</script>"
LINT_FLAGS=--scripted expect 1 sc-handler 'on*= handler'

page sc-no-hidden '' "<button type=\"button\" id=\"b\">Next</button><script>1</script>"
LINT_FLAGS=--scripted expect 0 sc-no-hidden 'WARN nothing starts hidden'

page sc-prose '' "$BTN<p>The page never calls fetch( or localStorage.</p><script>1</script>"
LINT_FLAGS=--scripted expect 0 sc-prose '(0 warning(s)'

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
# A scripted page with a diagram: self_check allows no script but its own, so it reads the page with the script cut out.
printf 'import sys\nif "<script" in open(sys.argv[-1], encoding="utf-8").read():\n    print("  - script finding")\n    sys.exit(1)\nprint("OK")\n' > "$stub/scripts/self_check.py"
page sc-svg '' "$BTN$SVG_OK<script>const b=document.getElementById('b');b.hidden=false;b.addEventListener('click',()=>{b.textContent='Done'})</script>"
DIAGRAM_DESIGN_DIR="$stub" LINT_FLAGS=--scripted expect 0 sc-svg '(0 warning(s)'
# A captured still's icons are all aria-hidden: self_check (which wants an accessible SVG) is skipped.
page still-icons '' '<figure class="stage"><div class="stage-frame" role="img" aria-label="A still"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M0 0h24"/></svg></div></figure>'
DIAGRAM_DESIGN_DIR="$stub" expect 0 still-icons PASS

# The worst-case page (template + kit with worst data) builds and passes the lint.
if node "$skill/tests/worst-case.mjs" "$work/worst.html" >/dev/null && bash "$lint" "$work/worst.html" >/dev/null 2>&1; then
  echo "ok      worst-case page passes lint"; pass=$((pass + 1))
else echo "not ok  worst-case page passes lint"; bash "$lint" "$work/worst.html" | sed 's/^/        /'; fail=$((fail + 1)); fi

# The skill's own pages must pass: the static ones as pages, the scripted kit with --scripted.
for f in template components scripted; do
  flags=; [ "$f" = scripted ] && flags=--scripted
  out=$(bash "$lint" $flags "$skill/$f.html" 2>&1)
  if [ $? -eq 0 ]; then echo "ok      $f.html passes lint $flags"; pass=$((pass + 1))
  else echo "not ok  $f.html fails lint $flags"; echo "$out" | sed 's/^/        /'; fail=$((fail + 1)); fi
done

echo "--- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
