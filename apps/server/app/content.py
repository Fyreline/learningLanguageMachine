"""Read-only access to the versioned course content in <repo>/content.

Content is code (docs/ARCHITECTURE.md §2): loaded once per process, cached.
Progress tables reference these ids as plain strings, so nothing here touches
the database.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import PROJECT_ROOT

CONTENT_DIR = PROJECT_ROOT / "content"


@lru_cache(maxsize=1)
def manifest() -> dict[str, Any]:
    with open(CONTENT_DIR / "manifest.json", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=32)
def unit(unit_id: str) -> dict[str, Any] | None:
    path = CONTENT_DIR / "units" / f"{unit_id}.json"
    if not path.exists():
        # Units 10-14 are still being authored (phase-2 partial); the manifest
        # lists them so the path can render the road ahead, but their lessons
        # stay locked until the file lands.
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def main_lesson_order() -> list[str]:
    """Every main-path lesson id in walking order (kana trail excluded —
    it never gates progress, docs/CURRICULUM.md §1)."""
    return [
        lesson["id"]
        for u in manifest()["units"]
        for lesson in u["lessons"]
    ]


@lru_cache(maxsize=1)
def trip_core_item_ids() -> frozenset[str]:
    ids: set[str] = set()
    for u in manifest()["units"]:
        data = unit(u["id"])
        if not data:
            continue
        for item in data["items"]:
            if item.get("trip_core"):
                ids.add(item["id"])
    return frozenset(ids)


def unit_has_content(unit_id: str) -> bool:
    return unit(unit_id) is not None
