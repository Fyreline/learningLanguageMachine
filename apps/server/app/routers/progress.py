"""Progress writes: lesson completion and placement (docs/API.md §Progress).

Both endpoints are idempotent on their ``submission_id`` and do every write —
SRS state, ``daily_activity``, ``lesson_completions`` — inside a single
transaction (docs/DATA_MODEL.md "Integrity rules"): a retried POST must never
double-count XP.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import content
from ..auth import current_user
from ..db import get_session
from ..models import ItemProgress, LessonCompletion
from ..scoring import (
    apply_grade,
    bump_daily_activity,
    fmt_ts,
    guard_body_size,
    now_utc,
    stars_for_score,
)
from .curriculum import (
    _completed_lesson_ids,
    _trip_ready,
    current_lesson_id,
)
from .stats import _streak

router = APIRouter(tags=["progress"])


class ResultIn(BaseModel):
    item_id: str
    grade: int = Field(ge=0, le=3)
    mode: str


class LessonCompleteIn(BaseModel):
    submission_id: str
    score: int = Field(ge=0, le=100)
    duration_seconds: int = Field(ge=0)
    local_date: str
    results: list[ResultIn] = Field(default_factory=list)


class PlacementCompleteIn(BaseModel):
    submission_id: str
    known_item_ids: list[str] = Field(default_factory=list)
    local_date: str


def _path_block(db: Session, user_id: int, lesson_id: str) -> dict[str, Any]:
    """The ``path`` sub-object every progress response carries (docs/API.md)."""
    unit_id = content.unit_id_for_lesson(lesson_id)
    unit_completed = False
    if unit_id:
        done = _completed_lesson_ids(db, user_id)
        unit_completed = all(lid in done for lid in content.unit_lesson_ids(unit_id))
    return {
        "next_lesson_id": current_lesson_id(db, user_id),
        "unit_completed": unit_completed,
        "trip_ready_pct": _trip_ready(db, user_id),
    }


def _distinct_results(results: list[ResultIn]) -> list[ResultIn]:
    """Keep the last grade per item within a single submission (a slow-lane
    re-teach may re-grade the same item; the final exposure wins)."""
    by_item: dict[str, ResultIn] = {}
    for r in results:
        by_item[r.item_id] = r
    return list(by_item.values())


@router.post("/lessons/{lesson_id}/complete")
def complete_lesson(
    lesson_id: str,
    body: LessonCompleteIn,
    request: Request,
    user_id: int = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    guard_body_size(request)
    lesson = content.get_lesson(lesson_id)
    kind = (lesson or {}).get("kind", "teach")

    # --- Idempotency: a retried POST returns the stored outcome, no re-write.
    existing = db.execute(
        select(LessonCompletion).where(LessonCompletion.submission_id == body.submission_id)
    ).scalar_one_or_none()
    if existing is not None:
        return {
            "xp_awarded": existing.xp,
            "stars": existing.stars,
            "streak": _streak(db, user_id, _today(body.local_date)),
            "path": _path_block(db, user_id, existing.lesson_id),
            "leveled_items": _current_strengths(db, user_id, body.results),
        }

    now = now_utc()
    stars = stars_for_score(body.score)

    # Prior completions decide replay vs first pass, and the no-grind rule
    # (docs/CURRICULUM.md §8: a 3-starred lesson grants no more XP on replay).
    prior = db.execute(
        select(LessonCompletion)
        .where(LessonCompletion.user_id == user_id, LessonCompletion.lesson_id == lesson_id)
        .order_by(LessonCompletion.stars.desc())
    ).scalars().all()
    is_replay = len(prior) > 0
    best_prior_stars = max((c.stars for c in prior), default=0)

    results = _distinct_results(body.results)
    for r in results:
        apply_grade(db, user_id, r.item_id, r.grade, r.mode, now)

    correct = sum(1 for r in results if r.grade >= 2)
    if is_replay and best_prior_stars >= 3:
        xp = 0  # already mastered — replay is for practice, not points
    else:
        xp = 10 + correct + (5 * stars if kind == "checkpoint" else 0)

    bump_daily_activity(
        db, user_id, body.local_date,
        xp=xp, minutes=body.duration_seconds / 60.0, lessons=1,
    )

    db.add(
        LessonCompletion(
            user_id=user_id,
            lesson_id=lesson_id,
            score=body.score,
            stars=stars,
            xp=xp,
            duration_seconds=body.duration_seconds,
            source="replay" if is_replay else "lesson",
            submission_id=body.submission_id,
            completed_at=fmt_ts(now),
        )
    )
    db.commit()

    return {
        "xp_awarded": xp,
        "stars": stars,
        "streak": _streak(db, user_id, _today(body.local_date)),
        "path": _path_block(db, user_id, lesson_id),
        "leveled_items": _current_strengths(db, user_id, body.results),
    }


@router.post("/placement/complete")
def complete_placement(
    body: PlacementCompleteIn,
    request: Request,
    user_id: int = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    guard_body_size(request)
    now = now_utc()
    prefix = f"{body.submission_id}:"

    # Idempotency: placement writes one completion row per tested-out lesson,
    # each keyed ``<submission_id>:<lesson_id>`` (submission_id is UNIQUE per
    # row). A retry finds those rows and returns the same outcome.
    already = db.execute(
        select(LessonCompletion.lesson_id).where(
            LessonCompletion.user_id == user_id,
            LessonCompletion.submission_id.like(prefix + "%"),
        )
    ).scalars().all()
    if already:
        return {
            "tested_out_lessons": list(already),
            "path": _placement_path(db, user_id),
        }

    known = set(body.known_item_ids)
    # Every correctly-probed item is pre-marked strength 3 (docs/CURRICULUM §5).
    for iid in known:
        if content.get_item(iid) is not None:
            apply_grade(db, user_id, iid, 3, "fast-skip", now)

    # A lesson tests out when >= 80% of its new items are known.
    tested_out: list[str] = []
    for u in content.manifest()["units"]:
        for lesson in u["lessons"]:
            data = content.get_lesson(lesson["id"])
            new_items = (data or {}).get("new_items", [])
            if not new_items:
                continue
            known_here = sum(1 for iid in new_items if iid in known)
            if known_here / len(new_items) >= 0.8:
                tested_out.append(lesson["id"])

    for lid in tested_out:
        db.add(
            LessonCompletion(
                user_id=user_id,
                lesson_id=lid,
                score=0,
                stars=0,  # 0 stars = tested-out (docs/DATA_MODEL.md)
                xp=0,
                duration_seconds=0,
                source="placement",
                submission_id=f"{body.submission_id}:{lid}",
                completed_at=fmt_ts(now),
            )
        )
    db.commit()

    return {
        "tested_out_lessons": tested_out,
        "path": _placement_path(db, user_id),
    }


def _placement_path(db: Session, user_id: int) -> dict[str, Any]:
    return {
        "next_lesson_id": current_lesson_id(db, user_id),
        "unit_completed": False,
        "trip_ready_pct": _trip_ready(db, user_id),
    }


def _current_strengths(db: Session, user_id: int, results: list[ResultIn]) -> list[dict[str, Any]]:
    """The post-update strength of every distinct item in the submission — the
    score screen's "these are sticking now" list. Deterministic from stored
    state, so a retried POST returns byte-identical output."""
    ids = list({r.item_id for r in results})
    if not ids:
        return []
    rows = {
        r.item_id: r.strength
        for r in db.execute(
            select(ItemProgress).where(
                ItemProgress.user_id == user_id, ItemProgress.item_id.in_(ids)
            )
        ).scalars()
    }
    return [{"item_id": iid, "strength": rows.get(iid, 0)} for iid in ids]


def _today(local_date: str) -> date:
    try:
        return date.fromisoformat(local_date)
    except ValueError:
        return datetime.now(timezone.utc).date()
