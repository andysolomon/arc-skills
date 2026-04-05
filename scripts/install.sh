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

for src in $SRC_GLOB; do
  [ -d "$src" ] || continue
  name="$(basename "$src")"

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
