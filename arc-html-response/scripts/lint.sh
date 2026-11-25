#!/usr/bin/env bash
# Lint an HTML response page against the Postplan 0.0.4 contract and the
# skill's motion rules. Local and offline; run `postplan check` before upload.
#
# Usage: lint.sh [--scripted] <file.html> [more.html ...]
# Exit:  0 when no FAIL, 1 on any FAIL, 2 on bad usage.
#
# --scripted checks a page on level 1's scripted rung instead: one plain inline
# <script> is allowed, with no network, no storage, no eval and no animation
# API, so the page still keeps nothing and sends nothing.
#
# When the diagram-design skill is installed and the page has an <svg>, its
# self_check.py --offline also runs (accessible-SVG contract, content inside
# the viewBox). Point DIAGRAM_DESIGN_DIR at the skill, or set it to "none" to skip.

set -u

MAX_BYTES=$((512 * 1024))
Q="[\"']?"   # optional attribute quote

SCRIPTED=0
if [ "${1:-}" = "--scripted" ]; then SCRIPTED=1; shift; fi

if [ $# -eq 0 ]; then
  echo "usage: $(basename "$0") [--scripted] <file.html> [more.html ...]" >&2
  exit 2
fi

# Line numbers (first 5, comma separated) matching an ERE, case-insensitive.
doc_lines() { grep -Eni -- "$1" "$2" | cut -d: -f1 | head -5 | paste -sd, -; }

# Same, but only inside <style>...</style> blocks, so prose that mentions a
# CSS feature does not trip a CSS rule. Pattern must be lowercase.
css_lines() {
  awk -v re="$1" '
    /<style/ { s = 1 }
    s && tolower($0) ~ re { print NR }
    /<\/style>/ { s = 0 }
  ' "$2" | head -5 | paste -sd, -
}

# Same, but only the text between <script> and </script>, even when a script
# shares its line with prose. Pattern must be lowercase.
script_lines() {
  awk -v re="$1" '
    {
      l = tolower($0); hit = 0
      while (l != "") {
        if (!s) {
          i = index(l, "<script"); if (!i) break
          l = substr(l, i); j = index(l, ">"); if (!j) { l = ""; s = 1; break }
          l = substr(l, j + 1); s = 1
        }
        k = index(l, "</script")
        seg = k ? substr(l, 1, k - 1) : l
        if (seg ~ re) hit = 1
        if (!k) break
        s = 0; l = substr(l, k + 8)
      }
      if (hit) print NR
    }
  ' "$2" | head -5 | paste -sd, -
}

# SVGs (first 5, by line of the opening tag) that are not aria-hidden and lack
# a <title> or a <desc>. Screen readers otherwise announce a blank image.
svg_unnamed() {
  awk '
    /<svg/ { open = NR; hidden = ($0 ~ /aria-hidden="true"/); t = 0; d = 0 }
    open && /<title/ { t = 1 }
    open && /<desc/  { d = 1 }
    /<\/svg>/ { if (open && !hidden && !(t && d)) print open; open = 0 }
  ' "$1" | head -5 | paste -sd, -
}

# Directory of an installed diagram-design skill, or nothing.
diagram_design_dir() {
  local d
  if [ -n "${DIAGRAM_DESIGN_DIR:-}" ]; then
    [ -f "$DIAGRAM_DESIGN_DIR/scripts/self_check.py" ] && echo "$DIAGRAM_DESIGN_DIR"
    return
  fi
  for d in "$HOME/.claude/skills/diagram-design" "$HOME/.codex/skills/diagram-design" "$HOME/.agents/skills/diagram-design"; do
    [ -f "$d/scripts/self_check.py" ] && { echo "$d"; return; }
  done
}

lint_file() {
  local file=$1 fails=0 warns=0 bytes at dd out target tmp

  echo "$file"
  if [ ! -f "$file" ]; then
    echo "  FAIL no such file"
    return 1
  fi

  fail() { echo "  FAIL $1"; fails=$((fails + 1)); }
  warn() { echo "  WARN $1"; warns=$((warns + 1)); }

  bytes=$(wc -c < "$file" | tr -d ' ')
  [ "$bytes" -gt "$MAX_BYTES" ] && fail "size: $bytes bytes, budget is $MAX_BYTES (512 KiB)"

  if [ "$SCRIPTED" -eq 0 ]; then
    # JavaScript in any form (Postplan rejects <script src>; CSP blocks the rest).
    at=$(doc_lines '<script' "$file");                                 [ -n "$at" ] && fail "<script> at line $at; draw it in SVG/CSS, or build a scripted page and lint it with --scripted"
  else
    # The scripted rung: one plain inline script that keeps nothing and sends nothing.
    n=$(grep -Eoi '<script' "$file" | wc -l | tr -d ' ')
    [ "$n" -eq 0 ] && warn "no <script>; a page without one is a static page, lint it without --scripted"
    [ "$n" -gt 1 ] && fail "$n <script> tags; a scripted page has one"
    at=$(doc_lines '<script[[:space:]][^>]*src[[:space:]]*=' "$file");   [ -n "$at" ] && fail "<script src> at line $at; inline the script (Postplan rejects src, and pages load nothing)"
    at=$(doc_lines '<script[[:space:]]' "$file");                        [ -n "$at" ] && fail "<script> with attributes at line $at; use a plain <script>"
    at=$(script_lines 'fetch[[:space:]]*\\(|xmlhttprequest|websocket|eventsource|sendbeacon|import[[:space:]]*\\(|rtcpeerconnection' "$file")
    [ -n "$at" ] && fail "network call at line $at; a scripted page sends nothing (that is a level 2 app)"
    at=$(script_lines 'localstorage|sessionstorage|indexeddb|document\\.cookie|caches\\.' "$file")
    [ -n "$at" ] && fail "storage at line $at; a scripted page keeps nothing (that is a level 2 app)"
    at=$(script_lines 'eval[[:space:]]*\\(|new[[:space:]]+function|innerhtml|outerhtml|insertadjacenthtml|document\\.write' "$file")
    [ -n "$at" ] && fail "code or markup from a string at line $at; build nodes with createElement and textContent"
    at=$(script_lines 'window\\.(open|top|parent|opener)|postmessage' "$file")
    [ -n "$at" ] && fail "reaches outside its frame at line $at; a scripted page talks to nothing"
    at=$(script_lines '\\.animate[[:space:]]*\\(' "$file")
    [ -n "$at" ] && fail "animate() at line $at; motion stays CSS on a page, so toggle a class or attribute"
    grep -Eqi '<[a-z][^>]*[[:space:]]hidden([[:space:]>=]|$)' "$file" || warn "nothing starts hidden; controls the script wires up should start hidden, so the page reads without the script"
  fi
  at=$(doc_lines '<[a-z][^>]*[[:space:]]on[a-z]+[[:space:]]*=' "$file"); [ -n "$at" ] && fail "on*= handler at line $at"
  at=$(doc_lines "(href|src)=$Q[[:space:]]*javascript:" "$file");      [ -n "$at" ] && fail "javascript: URL at line $at"

  # Blocked tags and external resources.
  at=$(doc_lines '<link[[:space:]>/]' "$file");                         [ -n "$at" ] && fail "<link> is blocked, line $at; inline the CSS"
  at=$(doc_lines '<(form|iframe|embed|object|applet|base)[[:space:]>/]' "$file"); [ -n "$at" ] && fail "blocked tag at line $at"
  at=$(doc_lines "http-equiv=${Q}refresh" "$file");                     [ -n "$at" ] && fail "meta refresh at line $at"
  at=$(doc_lines "(href|src)=${Q}file:" "$file");                       [ -n "$at" ] && fail "file: URL at line $at"
  at=$(grep -Eino "<img[^>]*src=$Q[^\"' >]+" "$file" | grep -Eiv "src=$Q(https:|data:)" | cut -d: -f1 | head -5 | paste -sd, -)
  [ -n "$at" ] && fail "image not from https: or data: at line $at; local images do not load"
  at=$(css_lines '@import' "$file");                                    [ -n "$at" ] && fail "@import at line $at; external CSS does not load"
  at=$(css_lines '@font-face' "$file");                                 [ -n "$at" ] && fail "@font-face at line $at; use system font stacks"

  # Privacy: Postplan pages are public to anyone with the link.
  at=$(doc_lines '(/home/|/Users/|/tmp/|/private/var/)' "$file");      [ -n "$at" ] && fail "local path at line $at; use repo-relative paths"

  # Motion rules.
  # An animation in use (not `animation:none`) needs a reduced-motion guard somewhere.
  # Unused @keyframes left over from the template are harmless.
  if [ -n "$(css_lines 'animation(-name)?[[:space:]]*:[[:space:]]*[^n;}]' "$file")" ] && [ -z "$(css_lines 'prefers-reduced-motion' "$file")" ]; then
    fail "animation without a prefers-reduced-motion guard"
  fi
  at=$(css_lines 'animation-timeline' "$file");                         [ -n "$at" ] && fail "scroll-driven animation at line $at; content stays hidden in T3's frame"

  # Diagrams and charts.
  at=$(svg_unnamed "$file");                                            [ -n "$at" ] && fail "<svg> at line $at needs a <title> and a <desc> (or aria-hidden=\"true\" if decorative)"
  # Only pages with an accessible SVG (a diagram or chart) go to self_check: a captured
  # still's icons are all aria-hidden, and self_check rejects a page with no accessible SVG.
  if grep -Eoi '<svg[^>]*>' "$file" | grep -qviE "aria-hidden=${Q}true" && command -v python3 >/dev/null 2>&1; then
    dd=$(diagram_design_dir)
    if [ -n "$dd" ]; then
      # self_check allows no script but its own motion controller, so it reads a
      # scripted page with the script cut out. The checks above cover the script.
      target=$file; tmp=
      if [ "$SCRIPTED" -eq 1 ]; then
        tmp=$(mktemp -d); target="$tmp/page.html"
        python3 -c 'import re, sys; sys.stdout.write(re.sub(r"(?is)<script\b.*?</script\s*>", "", open(sys.argv[1], encoding="utf-8").read()))' "$file" > "$target"
      fi
      # Its single-file rule rejects every remote URL. A page may link out and
      # load https images (Postplan allows both), so those findings are dropped.
      out=$(python3 "$dd/scripts/self_check.py" --offline "$target" 2>&1 |
        grep -E '^[[:space:]]*-' | grep -Ev 'remote reference on <(a|img)>: https://')
      [ -n "$tmp" ] && rm -rf "$tmp"
      if [ -n "$out" ]; then
        fail "diagram-design self_check:"
        printf '%s\n' "$out" | head -8 | sed 's/^[[:space:]]*/       /'
      fi
    fi
  fi

  # Motion taste (warnings): list exact properties, and never ease-in on UI
  # (it starts slow, delaying the moment the reader is watching).
  at=$(css_lines 'transition(-property)?[[:space:]]*:([^;}]*[ ,])?[[:space:]]*all([ ;,}]|$)' "$file"); [ -n "$at" ] && warn "transition: all at line $at; list the exact properties"
  at=$(css_lines 'ease-in([^-]|$)' "$file");                          [ -n "$at" ] && warn "ease-in at line $at; use ease-out (or the template's --ease)"

  # House style and metadata.
  grep -Eqi '<title>[^<]+</title>' "$file"     || warn "no <title>"
  grep -Eqi "name=${Q}viewport" "$file"        || warn "no viewport meta"
  at=$(grep -n '—' "$file" | cut -d: -f1 | head -5 | paste -sd, -); [ -n "$at" ] && warn "em dash at line $at; house style avoids them"

  if [ "$fails" -eq 0 ]; then
    echo "  PASS ($warns warning(s), $bytes bytes)"
    return 0
  fi
  return 1
}

failed=0
for f in "$@"; do
  lint_file "$f" || failed=1
done
exit "$failed"
