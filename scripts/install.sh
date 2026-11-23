#!/usr/bin/env bash
# Local installer for working on these skills. It installs them the open agent skills
# way, like `npx skills add`, but links each one to this checkout so edits are live:
#
#   ~/.agents/skills/<name>  -> <this checkout>/<name>   the universal folder (Codex, Pi,
#                                                         Cline, Warp, Zed and others read it)
#   ~/.claude/skills/<name>  -> ../../.agents/skills/<name>   Claude Code
#
# For a normal install, use the skills CLI instead (see README): it also links the
# harnesses with their own folders (Cursor, OpenCode, Copilot, Gemini CLI, ...) and
# updates with `npx skills update`. Use one or the other: `npx skills update` replaces
# these links with copies.
set -euo pipefail

MODE="symlink"
if [ "${1:-}" = "--copy" ]; then
  MODE="copy"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_GLOB="$ROOT_DIR/arc-* $ROOT_DIR/*-mode"
AGENTS_DIR="${HOME}/.agents/skills"
CLAUDE_DIR="${HOME}/.claude/skills"
OLD_CODEX_DIR="${HOME}/.codex/skills"

mkdir -p "$AGENTS_DIR" "$CLAUDE_DIR"

# Names of the skills currently in this repo, space-delimited and padded
# (" name ") so membership tests match whole names exactly.
VALID=" "

for src in $SRC_GLOB; do
  [ -f "$src/SKILL.md" ] || continue
  name="$(basename "$src")"
  VALID="$VALID$name "

  canonical="$AGENTS_DIR/$name"
  if [ -e "$canonical" ] || [ -L "$canonical" ]; then
    rm -rf "$canonical"
  fi
  if [ "$MODE" = "copy" ]; then
    cp -R "$src" "$canonical"
    echo "copied: $canonical"
  else
    ln -s "$src" "$canonical"
    echo "linked: $canonical -> $src"
  fi

  claude="$CLAUDE_DIR/$name"
  if [ -e "$claude" ] || [ -L "$claude" ]; then
    rm -rf "$claude"
  fi
  ln -s "../../.agents/skills/$name" "$claude"
  echo "linked: $claude -> ../../.agents/skills/$name"
done

# Earlier versions of this script linked skills into ~/.codex/skills. Codex now reads
# ~/.agents/skills, so remove those old links (only links that point into this checkout).
if [ -d "$OLD_CODEX_DIR" ]; then
  for entry in "$OLD_CODEX_DIR"/arc-* "$OLD_CODEX_DIR"/*-mode; do
    [ -L "$entry" ] || continue
    case "$(readlink "$entry")" in
      "$ROOT_DIR"/*) rm "$entry"; echo "removed old link: $entry" ;;
    esac
  done
fi

# diagram-design profile: lets any project select the arc-html-response skin
# with a `.diagram-design` marker (`profile: arc-postplan`). Profiles live in the
# home library, never inside a skill install. This repo's copy is the source.
PROFILE_SRC="$ROOT_DIR/arc-html-response/diagram-profile.md"
PROFILE_DIR="${HOME}/.diagram-design/profiles"
if [ -f "$PROFILE_SRC" ]; then
  mkdir -p "$PROFILE_DIR"
  if ! cmp -s "$PROFILE_SRC" "$PROFILE_DIR/arc-postplan.md"; then
    cp "$PROFILE_SRC" "$PROFILE_DIR/arc-postplan.md"
    echo "profile: $PROFILE_DIR/arc-postplan.md"
  fi
fi

# Prune stale installs: any arc-* entry in a target dir that no longer maps to a
# skill in this repo (renamed/removed). Broken symlinks are caught here too —
# their name won't be in VALID. Only arc-* entries are touched, so unrelated
# skills are left alone.
for target_root in "$AGENTS_DIR" "$CLAUDE_DIR"; do
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
