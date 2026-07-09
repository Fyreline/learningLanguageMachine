#!/usr/bin/env python3
"""Nightly snapshot of the production SQLite db (data/michi.db — the real
household's only copy of their progress). Run by the com.michi.backup
LaunchAgent (which invokes this via the venv's python — not /bin/sh, which
macOS's per-app folder permissions block from touching ~/Documents even
though the venv's python is already implicitly trusted, since it's the same
interpreter com.michi.api runs under).

Uses sqlite3's own .backup() API, not a plain file copy — a copy of a
WAL-mode db mid-write can grab an inconsistent snapshot. Same mechanism as
data/michi.dev.db's refresh command in CLAUDE.md.

Standalone, stdlib-only. Run from anywhere; paths are resolved relative to
this file, not the CWD.
"""
from __future__ import annotations

import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

# .../learningLanguageMachine/apps/server/scripts/backup_db.py
#   parents[3] = learningLanguageMachine (project root, where data/ lives)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DB = PROJECT_ROOT / "data" / "michi.db"
BACKUP_DIR = PROJECT_ROOT / "data" / "backups"
KEEP = 30


def log(msg: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"{stamp} {msg}")


def main() -> int:
    if not DB.exists():
        log(f"skip: no db at {DB}")
        return 0

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    dest = BACKUP_DIR / f"michi-{stamp}.db"

    src_conn = sqlite3.connect(str(DB))
    dest_conn = sqlite3.connect(str(dest))
    with dest_conn:
        src_conn.backup(dest_conn)
    dest_conn.close()
    src_conn.close()
    log(f"backed up to {dest}")

    snapshots = sorted(BACKUP_DIR.glob("michi-*.db"), key=lambda p: p.name, reverse=True)
    for old in snapshots[KEEP:]:
        old.unlink()
        log(f"pruned {old}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
