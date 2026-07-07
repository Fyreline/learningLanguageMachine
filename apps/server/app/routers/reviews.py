"""Reviews — the Practice tab's surface of the one shared SRS model
(docs/API.md §Reviews, docs/CURRICULUM.md §6/§7).

``GET /reviews/due`` lists what memory wants revisited (weakest-first, trip-core
weighted inside T-21); ``POST /reviews/complete`` grades a session through the
same SRS + daily-activity path a lesson uses, idempotent on ``submission_id``.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import content
from ..auth import current_user
from ..db import get_session
from ..models import ItemProgress, LessonCompletion, User
from ..scoring import (
    apply_grade,
    bump_daily_activity,
    fmt_ts,
    guard_body_size,
    now_utc,
    parse_ts,
)
from .progress import ResultIn, _today
from .stats import _streak

router = APIRouter(prefix="/reviews", tags=["reviews"])

T_MINUS_DAYS = 21  # from T-21, trip-core weighs 3x (docs/CURRICULUM.md §7)


class ReviewCompleteIn(BaseModel):
    submission_id: str
    duration_seconds: int = Field(ge=0)
    local_date: str
    results: list[ResultIn] = Field(default_factory=list)


def _trip_date(db: Session, user_id: int) -> date:
    user = db.get(User, user_id)
    settings = json.loads((user.settings_json if user else None) or "{}")
    raw = settings.get("trip_date") or content.manifest().get("trip_date_default", "2026-09-15")
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return date(2026, 9, 15)


def _within_t_minus(db: Session, user_id: int, today: date) -> bool:
    return 0 <= (_trip_date(db, user_id) - today).days <= T_MINUS_DAYS


def _forecast_week(db: Session, user_id: int, today: date) -> list[int]:
    """Due counts for the next 7 days; overdue items pile onto day 0
    (mirrors routers/stats.py's forecast so the numbers agree everywhere)."""
    week: list[int] = []
    for i in range(7):
        day = today + timedelta(days=i)
        if i == 0:
            cond = ItemProgress.due_at < (day + timedelta(days=1)).isoformat()
        else:
            cond = func.substr(ItemProgress.due_at, 1, 10) == day.isoformat()
        n = db.execute(
            select(func.count())
            .select_from(ItemProgress)
            .where(
                ItemProgress.user_id == user_id,
                ItemProgress.due_at.is_not(None),
                cond,
            )
        ).scalar_one()
        week.append(n)
    return week


@router.get("/due")
def reviews_due(
    user_id: int = Depends(current_user), db: Session = Depends(get_session)
) -> dict[str, Any]:
    now = now_utc()
    now_str = fmt_ts(now)
    today = now.date()
    trip_core = content.trip_core_item_ids()
    boost = _within_t_minus(db, user_id, today)

    due_rows = db.execute(
        select(ItemProgress).where(
            ItemProgress.user_id == user_id,
            ItemProgress.due_at.is_not(None),
            ItemProgress.due_at <= now_str,
        )
    ).scalars().all()

    def sort_key(r: ItemProgress) -> tuple[Any, ...]:
        due = parse_ts(r.due_at) or now
        overdue_days = (now - due).days
        # trip-core sinks to the front inside T-21; then weakest, then most overdue
        core_rank = 0 if (boost and r.item_id in trip_core) else 1
        return (core_rank, r.strength, -overdue_days)

    ordered = sorted(due_rows, key=sort_key)
    due = []
    for r in ordered:
        due_dt = parse_ts(r.due_at) or now
        overdue_days = max(0, (now - due_dt).days)
        due.append(
            {
                "item_id": r.item_id,
                "strength": r.strength,
                "due_at": r.due_at,
                "overdue_days": overdue_days,
            }
        )

    week = _forecast_week(db, user_id, today)
    return {"due": due, "counts": {"today": week[0], "week": week}}


@router.post("/complete")
def reviews_complete(
    body: ReviewCompleteIn,
    request: Request,
    user_id: int = Depends(current_user),
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    guard_body_size(request)

    # Idempotency uses the same UNIQUE submission_id ledger as lessons: a
    # review session records a source='review' completion row (lesson_id
    # 'review'), which the path derivation harmlessly ignores.
    existing = db.execute(
        select(LessonCompletion).where(LessonCompletion.submission_id == body.submission_id)
    ).scalar_one_or_none()
    if existing is not None:
        return {
            "xp_awarded": existing.xp,
            "streak": _streak(db, user_id, _today(body.local_date)),
            "next_due_counts": _next_due_counts(db, user_id, now_utc()),
        }

    now = now_utc()
    # last grade per item wins within one submission
    by_item: dict[str, ResultIn] = {r.item_id: r for r in body.results}
    for r in by_item.values():
        apply_grade(db, user_id, r.item_id, r.grade, r.mode, now)

    xp = sum(1 for r in by_item.values() if r.grade >= 2)  # 1 per correct (§8)
    bump_daily_activity(
        db, user_id, body.local_date,
        xp=xp, minutes=body.duration_seconds / 60.0, reviews=1,
    )
    db.add(
        LessonCompletion(
            user_id=user_id,
            lesson_id="review",
            score=0,
            stars=0,
            xp=xp,
            duration_seconds=body.duration_seconds,
            source="review",
            submission_id=body.submission_id,
            completed_at=fmt_ts(now),
        )
    )
    db.commit()

    return {
        "xp_awarded": xp,
        "streak": _streak(db, user_id, _today(body.local_date)),
        "next_due_counts": _next_due_counts(db, user_id, now),
    }


def _next_due_counts(db: Session, user_id: int, now: datetime) -> dict[str, Any]:
    week = _forecast_week(db, user_id, now.date())
    return {"today": week[0], "week": week}
