#!/usr/bin/env bash
# Mirror the canonical Aizome palette to MishkaHub (see theme.css header).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)/apps/web/src/theme.css"
DST="/Users/mack/Documents/Dev/MishkaHub/apps/web/src/theme.css"
cp "$SRC" "$DST"
echo "synced: $SRC -> $DST"
diff -q "$SRC" "$DST" && echo "in step ✓"
