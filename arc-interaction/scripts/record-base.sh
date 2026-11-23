#!/usr/bin/env bash
# Records the template files the overlay replaces, as they are now, in overlay-base.sha256.
# Run it only after merging the template's change into the overlay's copy of each file.
#
#   bash scripts/record-base.sh [template-dir]
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="${1:-$SKILL_DIR/../arc-web-production/template}"
files=()
while IFS= read -r file; do
  [ -f "$TEMPLATE_DIR/$file" ] && files+=("$file")
done < <(cd "$SKILL_DIR/overlay" && find . -type f | sed 's|^\./||' | sort)
(cd "$TEMPLATE_DIR" && sha256sum "${files[@]}") > "$SKILL_DIR/overlay-base.sha256.new"
mv "$SKILL_DIR/overlay-base.sha256.new" "$SKILL_DIR/overlay-base.sha256"
echo "recorded ${#files[@]} replaced template files"
