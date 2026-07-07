"""GET /api/curriculum/manifest — the course map merged with the caller's
progress (docs/API.md). The lesson-content endpoint (/lessons/{id}) is
phase-3 scope and intentionally absent.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import content
from ..auth import current_user
from ..db import get_session
from ..models import ItemProgress, LessonCompletion, User

router = APIRouter(prefix="/curriculum", tags=["curriculum"])


def _best_completions(db: Session, user_id: int) -> dict[str, dict[str, int]]:
    """lesson_id -> {stars, best_score} over every completion row."""
    rows = db.execute(
        select(
            LessonCompletion.lesson_id,
            func.max(LessonCompletion.stars),
            func.max(LessonCompletion.score),
        )
        .where(LessonCompletion.user_id == user_id)
        .group_by(LessonCompletion.lesson_id)
    ).all()
    return {r[0]: {"stars": r[1], "best_score": r[2]} for r in rows}


def _merge_lessons(
    lessons: list[dict[str, Any]],
    done: dict[str, dict[str, int]],
    current_id: str | None,
    unit_available: bool,
) -> list[dict[str, Any]]:
    out = []
    for lesson in lessons:
        if lesson["id"] in done:
            state = "done"
        elif lesson["id"] == current_id:
            state = "current"
        elif unit_available:
            state = "available" if _prev_done(lessons, lesson, done) else "locked"
        else:
            state = "locked"
        best = done.get(lesson["id"], {})
        out.append(
            {
                **lesson,
                "state": state,
                "stars": best.get("stars", 0),
                "best_score": best.get("best_score"),
            }
        )
    return out


def _prev_done(
    lessons: list[dict[str, Any]], lesson: dict[str, Any], done: dict[str, Any]
) -> bool:
    idx = next(i for i, l in enumerate(lessons) if l["id"] == lesson["id"])
    return idx == 0 or lessons[idx - 1]["id"] in done


def _trip_ready(db: Session, user_id: int) -> int:
    core = content.trip_core_item_ids()
    if not core:
        return 0
    known = db.execute(
        select(func.count())
        .select_from(ItemProgress)
        .where(
            ItemProgress.user_id == user_id,
            ItemProgress.strength >= 3,
            ItemProgress.item_id.in_(core),
        )
    ).scalar_one()
    return round(100 * known / len(core))


def _words_known(db: Session, user_id: int) -> int:
    return db.execute(
        select(func.count())
        .select_from(ItemProgress)
        .where(ItemProgress.user_id == user_id, ItemProgress.strength >= 3)
    ).scalar_one()


def current_lesson_id(db: Session, user_id: int) -> str | None:
    """First not-done main-path lesson, in manifest walking order."""
    done = {
        r[0]
        for r in db.execute(
            select(LessonCompletion.lesson_id).where(
                LessonCompletion.user_id == user_id
            )
        ).all()
    }
    for lesson_id in content.main_lesson_order():
        if lesson_id not in done:
            return lesson_id
    return None  # the whole course is walked


@router.get("/manifest")
def get_manifest(
    user_id: int = Depends(current_user), db: Session = Depends(get_session)
) -> dict[str, Any]:
    m = content.manifest()
    done = _best_completions(db, user_id)
    current = current_lesson_id(db, user_id)

    units = []
    reached_current_unit = False
    for u in m["units"]:
        has_content = content.unit_has_content(u["id"])
        unit_current = any(lesson["id"] == current for lesson in u["lessons"])
        reached_current_unit = reached_current_unit or unit_current
        merged = _merge_lessons(
            u["lessons"],
            done,
            current,
            unit_available=has_content and (unit_current or not reached_current_unit),
        )
        if not has_content:
            merged = [
                {**lesson, "state": "locked"} if lesson["state"] != "done" else lesson
                for lesson in merged
            ]
        units.append(
            {
                "id": u["id"],
                "title": u["title"],
                "kicker": u["kicker"],
                "summary": u["summary"],
                "landmark": u["landmark"],
                "authored": has_content,
                "lessons": merged,
            }
        )

    kana = {
        trail: [
            {
                "id": lesson_id,
                "state": "done" if lesson_id in done else "available",
                "stars": done.get(lesson_id, {}).get("stars", 0),
            }
            for lesson_id in m["kana_trail"][trail]
        ]
        for trail in m["kana_trail"]
    }

    # Partner presence (docs/DESIGN.md §5): aggregates only, never item rows.
    partner_row = db.execute(
        select(User).where(User.id != user_id).limit(1)
    ).scalar_one_or_none()
    partner = None
    if partner_row:
        partner = {
            "display_name": partner_row.display_name,
            "current_lesson_id": current_lesson_id(db, partner_row.id),
            "words_known": _words_known(db, partner_row.id),
        }

    trip_date = date.fromisoformat(m.get("trip_date_default", "2026-09-15"))
    days_to_trip = (trip_date - datetime.now(timezone.utc).date()).days

    return {
        "course": m["course"],
        "trip_date_default": m.get("trip_date_default"),
        "units": units,
        "kana_trail": kana,
        "summit": {
            "trip_ready_pct": _trip_ready(db, user_id),
            "days_to_trip": days_to_trip,
        },
        "partner": partner,
    }
