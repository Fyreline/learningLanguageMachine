#!/usr/bin/env bash
# Mirror the canonical Aizome palette to MishkaHub + Japan 2026 (see theme.css header).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)/apps/web/src/theme.css"
DST_MISHKA="/Users/mack/Documents/Dev/MishkaHub/apps/web/src/theme.css"
DST_JAPAN="/Users/mack/Documents/Dev/Japan_website/apps/web/src/theme.css"

cp "$SRC" "$DST_MISHKA"
echo "synced: $SRC -> $DST_MISHKA"
diff -q "$SRC" "$DST_MISHKA" && echo "in step ✓"

cp "$SRC" "$DST_JAPAN"
echo "synced: $SRC -> $DST_JAPAN"
diff -q "$SRC" "$DST_JAPAN" && echo "in step ✓"
