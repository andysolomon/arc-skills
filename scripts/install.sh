#!/usr/bin/env bash
set -euo pipefail

MODE="symlink"
if [ "${1:-}" = "--copy" ]; then
  MODE="copy"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_GLOB="$ROOT_DIR/arc-*"
CLAUDE_DIR="${HOME}/.claude/skills"
CODEX_DIR="${HOME}/.codex/skills"

mkdir -p "$CLAUDE_DIR" "$CODEX_DIR"

# Names of the skills currently in this repo, space-delimited and padded
# (" name ") so membership tests match whole names exactly.
VALID=" "

for src in $SRC_GLOB; do
  [ -d "$src" ] || continue
  name="$(basename "$src")"
  VALID="$VALID$name "

  for target_root in "$CLAUDE_DIR" "$CODEX_DIR"; do
    target="$target_root/$name"

    if [ -e "$target" ] || [ -L "$target" ]; then
      rm -rf "$target"
    fi

    if [ "$MODE" = "copy" ]; then
      cp -R "$src" "$target"
      echo "copied: $target"
    else
      ln -s "$src" "$target"
      echo "linked: $target -> $src"
    fi
  done
done

# Prune stale installs: any arc-* entry in a target dir that no longer maps to a
# skill in this repo (renamed/removed). Broken symlinks are caught here too —
# their name won't be in VALID. Only arc-* entries are touched, so unrelated
# skills are left alone.
for target_root in "$CLAUDE_DIR" "$CODEX_DIR"; do
  for entry in "$target_root"/arc-*; do
    # Guard against the literal "arc-*" when the dir has no matching entries.
    [ -e "$entry" ] || [ -L "$entry" ] || continue
    name="$(basename "$entry")"
    case "$VALID" in
      *" $name "*) : ;;  # current skill — keep
      *) rm -rf "$entry"; echo "pruned: $entry" ;;
    esac
  done
done
