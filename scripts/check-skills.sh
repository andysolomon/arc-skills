#!/usr/bin/env bash
# Checks that every skill folder in this repo installs as an open agent skill.
# The skills CLI (npx skills) silently skips a skill whose SKILL.md frontmatter a
# strict YAML parser rejects (for example an unquoted ": " in the description), so
# this compares what it finds against the skill folders here. Needs the network once
# to fetch the CLI.
#
#   bash scripts/check-skills.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
expected="$(cd "$ROOT_DIR" && for d in arc-* *-mode; do if [ -f "$d/SKILL.md" ]; then echo "$d"; fi; done | sort)"
found="$(cd "$HOME" && DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 npx -y skills add "$ROOT_DIR" --list 2>&1 \
  | sed 's/\x1b\[[0-9;]*m//g' | sed -n 's/^│    \([a-z][a-z0-9-]*\)$/\1/p' | sort)"

missing="$(comm -23 <(echo "$expected") <(echo "$found"))"
if [ -n "$missing" ]; then
  echo "FAIL the skills CLI does not find these skills (check their SKILL.md frontmatter is valid YAML):"
  echo "$missing" | sed 's/^/  /'
  exit 1
fi
echo "PASS all $(echo "$expected" | wc -l | tr -d ' ') skills install as open agent skills"
