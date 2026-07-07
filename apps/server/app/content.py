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


@lru_cache(maxsize=4)
def kana_deck(name: str) -> dict[str, Any] | None:
    """The hiragana/katakana side-trail decks (docs/CONTENT_GUIDE.md §2)."""
    path = CONTENT_DIR / "kana" / f"{name}.json"
    if not path.exists():
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


# ---------------------------------------------------------------------------
# Flat indices for the lesson-content / progress endpoints (phase 3). Built
# once per process from whatever units + kana decks are authored; cheap to
# rebuild (lru_cache) if a dev edit bumps the underlying files after restart.
# ---------------------------------------------------------------------------
_KANA_DECKS = ("hiragana", "katakana")


@lru_cache(maxsize=1)
def _index() -> dict[str, Any]:
    items: dict[str, dict[str, Any]] = {}
    item_owner: dict[str, str] = {}  # item_id -> unit id or kana deck name
    lessons: dict[str, dict[str, Any]] = {}
    lesson_owner: dict[str, str] = {}
    dialogues: dict[str, dict[str, Any]] = {}

    def ingest(owner: str, data: dict[str, Any]) -> None:
        for item in data.get("items", []):
            iid = item.get("id")
            if iid:
                items[iid] = item
                item_owner[iid] = owner
        for lesson in data.get("lessons", []):
            lid = lesson.get("id")
            if lid:
                lessons[lid] = lesson
                lesson_owner[lid] = owner
        for dlg in data.get("dialogues", []):
            did = dlg.get("id")
            if did:
                dialogues[did] = dlg

    for u in manifest()["units"]:
        data = unit(u["id"])
        if data:
            ingest(u["id"], data)
    for name in _KANA_DECKS:
        data = kana_deck(name)
        if data:
            ingest(name, data)

    return {
        "items": items,
        "item_owner": item_owner,
        "lessons": lessons,
        "lesson_owner": lesson_owner,
        "dialogues": dialogues,
    }


def get_item(item_id: str) -> dict[str, Any] | None:
    return _index()["items"].get(item_id)


def all_items() -> list[dict[str, Any]]:
    """The full item bank, each item tagged with its owning unit id or kana
    deck name (Phase 4: Phrasebook/Practice/KanaTrainer need item content that
    isn't necessarily inside any single unlocked lesson payload — the only
    other content route is per-lesson)."""
    idx = _index()
    return [{**item, "unit": idx["item_owner"].get(iid)} for iid, item in idx["items"].items()]


def get_lesson(lesson_id: str) -> dict[str, Any] | None:
    return _index()["lessons"].get(lesson_id)


def get_dialogue(dialogue_id: str) -> dict[str, Any] | None:
    return _index()["dialogues"].get(dialogue_id)


def lesson_owner(lesson_id: str) -> str | None:
    """The unit id (e.g. ``u04``) or kana deck name that owns a lesson."""
    return _index()["lesson_owner"].get(lesson_id)


def is_kana_lesson(lesson_id: str) -> bool:
    return lesson_owner(lesson_id) in _KANA_DECKS


def unit_lesson_ids(unit_id: str) -> list[str]:
    """Every lesson id of a unit, in manifest order (main path only)."""
    for u in manifest()["units"]:
        if u["id"] == unit_id:
            return [lesson["id"] for lesson in u["lessons"]]
    return []


def unit_id_for_lesson(lesson_id: str) -> str | None:
    """The manifest unit a main-path lesson belongs to (``u04.l3`` -> ``u04``)."""
    for u in manifest()["units"]:
        if any(lesson["id"] == lesson_id for lesson in u["lessons"]):
            return u["id"]
    return None
