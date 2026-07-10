#!/usr/bin/env bash
# Mirror the canonical Aizome palette to MishkaHub + Japan 2026 + Kakeibo + Sukumo (see theme.css header).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)/apps/web/src/theme.css"
DST_MISHKA="/Users/mack/Documents/Dev/MishkaHub/apps/web/src/theme.css"
DST_JAPAN="/Users/mack/Documents/Dev/Japan_website/apps/web/src/theme.css"
DST_KAKEIBO="/Users/mack/Documents/Dev/Finances/apps/web/src/theme.css"
DST_SUKUMO="/Users/mack/Documents/Dev/sukumo/apps/web/src/theme.css"

cp "$SRC" "$DST_MISHKA"
echo "synced: $SRC -> $DST_MISHKA"
diff -q "$SRC" "$DST_MISHKA" && echo "in step ✓"

cp "$SRC" "$DST_JAPAN"
echo "synced: $SRC -> $DST_JAPAN"
diff -q "$SRC" "$DST_JAPAN" && echo "in step ✓"

cp "$SRC" "$DST_KAKEIBO"
echo "synced: $SRC -> $DST_KAKEIBO"
diff -q "$SRC" "$DST_KAKEIBO" && echo "in step ✓"

cp "$SRC" "$DST_SUKUMO"
echo "synced: $SRC -> $DST_SUKUMO"
diff -q "$SRC" "$DST_SUKUMO" && echo "in step ✓"
