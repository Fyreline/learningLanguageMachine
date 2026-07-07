"""GET /api/curriculum/manifest — the course map merged with the caller's
progress (docs/API.md). The lesson-content endpoint (/lessons/{id}) is
phase-3 scope and intentionally absent.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import content
from ..auth import current_user
from ..db import get_session
from ..errors import MichiHTTPException
from ..models import ItemProgress, LessonCompletion, User
from ..scoring import fmt_ts, now_utc

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


def _completed_lesson_ids(db: Session, user_id: int) -> set[str]:
    return {
        r[0]
        for r in db.execute(
            select(LessonCompletion.lesson_id).where(
                LessonCompletion.user_id == user_id
            )
        ).all()
    }


def lesson_is_locked(db: Session, user_id: int, lesson_id: str) -> bool:
    """Path-order enforcement (docs/API.md, docs/DATA_MODEL.md "Path state").
    A main-path lesson opens once the lesson immediately before it is done;
    done lessons stay open (relaxed replay); kana lessons never gate."""
    if content.is_kana_lesson(lesson_id):
        return False
    order = content.main_lesson_order()
    if lesson_id not in order:
        return False  # not a gated main-path lesson (shouldn't happen once found)
    done = _completed_lesson_ids(db, user_id)
    if lesson_id in done:
        return False
    idx = order.index(lesson_id)
    prev_done = idx == 0 or order[idx - 1] in done
    return not prev_done


def _referenced_item_ids(lesson: dict[str, Any]) -> list[str]:
    """Every item id the client will need to render this lesson: its new
    items, any hand-authored step items, and any dialogue ``you``-turn items."""
    ids: list[str] = list(lesson.get("new_items", []))
    for step in lesson.get("steps") or []:
        if step.get("item"):
            ids.append(step["item"])
        ids.extend(step.get("items", []))
        did = step.get("dialogue")
        if did:
            dlg = content.get_dialogue(did)
            if dlg:
                for turn in dlg.get("turns", []):
                    if turn.get("expect_item"):
                        ids.append(turn["expect_item"])
    # de-dupe, keep order
    seen: set[str] = set()
    out: list[str] = []
    for iid in ids:
        if iid not in seen:
            seen.add(iid)
            out.append(iid)
    return out


def _review_riders(
    db: Session, user_id: int, exclude: set[str], now_str: str, limit: int = 5
) -> list[ItemProgress]:
    """The SRS-weakest 3-5 due-or-weak items that ride along as warm-up
    (docs/API.md: the server decides *which* review items ride along)."""
    rows = db.execute(
        select(ItemProgress)
        .where(
            ItemProgress.user_id == user_id,
            ItemProgress.item_id.not_in(exclude) if exclude else True,
            or_(
                ItemProgress.strength < 3,
                ItemProgress.due_at.is_not(None) & (ItemProgress.due_at <= now_str),
            ),
        )
        .order_by(ItemProgress.strength.asc(), ItemProgress.due_at.asc())
        .limit(limit)
    ).scalars().all()
    return list(rows)


@router.get("/lessons/{lesson_id}")
def get_lesson_content(
    lesson_id: str,
    user_id: int = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    lesson = content.get_lesson(lesson_id)
    if lesson is None:
        raise MichiHTTPException(
            status_code=404, detail=f"No lesson '{lesson_id}'", code="unknown_lesson"
        )
    if lesson_is_locked(db, user_id, lesson_id):
        raise MichiHTTPException(
            status_code=403,
            detail="Finish the trail behind you first",
            code="lesson_locked",
        )

    referenced = _referenced_item_ids(lesson)
    strengths = {
        r.item_id: r
        for r in db.execute(
            select(ItemProgress).where(ItemProgress.user_id == user_id)
        ).scalars()
    }

    def item_payload(iid: str, *, review_rider: bool = False) -> dict[str, Any] | None:
        base = content.get_item(iid)
        if base is None:
            return None
        row = strengths.get(iid)
        return {
            **base,
            "strength": row.strength if row else 0,
            "due_at": row.due_at if row else None,
            "review_rider": review_rider,
        }

    items: list[dict[str, Any]] = []
    for iid in referenced:
        payload = item_payload(iid)
        if payload:
            items.append(payload)

    # Warm-up riders: SRS-weakest due-or-weak earlier items, never the ones
    # this lesson already teaches/drills.
    riders = _review_riders(db, user_id, set(referenced), fmt_ts(now_utc()))
    for r in riders:
        payload = item_payload(r.item_id, review_rider=True)
        if payload:
            items.append(payload)

    dialogues = []
    for step in lesson.get("steps") or []:
        did = step.get("dialogue")
        if did:
            dlg = content.get_dialogue(did)
            if dlg:
                dialogues.append(dlg)

    return {
        "lesson": {
            "id": lesson["id"],
            "title": lesson.get("title", ""),
            "kind": lesson.get("kind", "teach"),
        },
        "items": items,
        "steps": lesson.get("steps"),
        "dialogues": dialogues,
    }


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
