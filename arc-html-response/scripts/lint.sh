#!/usr/bin/env bash
# Lint an HTML response page against the Postplan 0.0.4 contract and the
# skill's motion rules. Local and offline; run `postplan check` before upload.
#
# Usage: lint.sh <file.html> [more.html ...]
# Exit:  0 when no FAIL, 1 on any FAIL, 2 on bad usage.
#
# When the diagram-design skill is installed and the page has an <svg>, its
# self_check.py --offline also runs (accessible-SVG contract, content inside
# the viewBox). Point DIAGRAM_DESIGN_DIR at the skill, or set it to "none" to skip.

set -u

MAX_BYTES=$((512 * 1024))
Q="[\"']?"   # optional attribute quote

if [ $# -eq 0 ]; then
  echo "usage: $(basename "$0") <file.html> [more.html ...]" >&2
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
  local file=$1 fails=0 warns=0 bytes at dd out

  echo "$file"
  if [ ! -f "$file" ]; then
    echo "  FAIL no such file"
    return 1
  fi

  fail() { echo "  FAIL $1"; fails=$((fails + 1)); }
  warn() { echo "  WARN $1"; warns=$((warns + 1)); }

  bytes=$(wc -c < "$file" | tr -d ' ')
  [ "$bytes" -gt "$MAX_BYTES" ] && fail "size: $bytes bytes, budget is $MAX_BYTES (512 KiB)"

  # JavaScript in any form (Postplan rejects <script src>; CSP blocks the rest).
  at=$(doc_lines '<script' "$file");                                   [ -n "$at" ] && fail "<script> at line $at; draw it in SVG/CSS"
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
      # Its single-file rule rejects every remote URL. A page may link out and
      # load https images (Postplan allows both), so those findings are dropped.
      out=$(python3 "$dd/scripts/self_check.py" --offline "$file" 2>&1 |
        grep -E '^[[:space:]]*-' | grep -Ev 'remote reference on <(a|img)>: https://')
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
