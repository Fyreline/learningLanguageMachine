"""Shared write-side helpers for the progress + reviews routers.

Everything that mutates SRS state or the daily-activity aggregate funnels
through here so the lesson-complete and review-complete transactions stay
identical in behaviour (docs/DATA_MODEL.md "Integrity rules"; docs/CURRICULUM.md
§6/§8). Timestamps use Mishka's ``"%Y-%m-%d %H:%M:%S"`` UTC string convention,
matching the comparisons already baked into routers/stats.py.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from .errors import MichiHTTPException
from .models import DailyActivity, ItemProgress
from .srs import SrsState, fast_skip, review

TS_FMT = "%Y-%m-%d %H:%M:%S"
MAX_BODY_BYTES = 64 * 1024  # docs/API.md: every POST body <= 64KB


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def fmt_ts(dt: datetime) -> str:
    return dt.strftime(TS_FMT)


def parse_ts(s: str | None) -> datetime | None:
    if not s:
        return None
    return datetime.strptime(s, TS_FMT).replace(tzinfo=timezone.utc)


def stars_for_score(score: int) -> int:
    """1-3 stars at score >= 60/80/95 (docs/CURRICULUM.md §8)."""
    if score >= 95:
        return 3
    if score >= 80:
        return 2
    if score >= 60:
        return 1
    return 0


def guard_body_size(request: Request) -> None:
    length = request.headers.get("content-length")
    if length is not None and length.isdigit() and int(length) > MAX_BODY_BYTES:
        raise MichiHTTPException(
            status_code=413,
            detail="Request body too large",
            code="payload_too_large",
        )


def _state_from_row(row: ItemProgress | None) -> SrsState:
    if row is None:
        return SrsState()
    return SrsState(
        strength=row.strength,
        ease=row.ease,
        interval_days=row.interval_days,
        reps=row.reps,
        lapses=row.lapses,
        due_at=parse_ts(row.due_at),
    )


def apply_grade(
    db: Session, user_id: int, item_id: str, grade: int, mode: str, now: datetime
) -> int:
    """Upsert one (user, item) SRS row for a single graded exposure and return
    its new strength. ``mode == "fast-skip"`` triggers the §5.1 escape hatch
    (strength 3, next-day review); every other mode is a normal §6 review."""
    row = db.get(ItemProgress, (user_id, item_id))
    state = _state_from_row(row)
    new = fast_skip(state, now) if mode == "fast-skip" else review(state, grade, now)

    if row is None:
        row = ItemProgress(user_id=user_id, item_id=item_id)
        db.add(row)
    row.strength = new.strength
    row.ease = new.ease
    row.interval_days = new.interval_days
    row.reps = new.reps
    row.lapses = new.lapses
    row.due_at = fmt_ts(new.due_at) if new.due_at else None
    row.last_grade = grade
    row.last_seen_at = fmt_ts(now)
    return new.strength


def bump_daily_activity(
    db: Session,
    user_id: int,
    local_date: str,
    *,
    xp: int = 0,
    minutes: float = 0.0,
    lessons: int = 0,
    reviews: int = 0,
) -> None:
    """Upsert the daily aggregate that feeds streaks, the weekly chart, and the
    daily-goal ring (docs/DATA_MODEL.md daily_activity). The client sends its
    own local date so streaks respect the household's timezone, not UTC."""
    row = db.get(DailyActivity, (user_id, local_date))
    if row is None:
        row = DailyActivity(user_id=user_id, date=local_date, xp=0, minutes=0.0, lessons=0, reviews=0)
        db.add(row)
    row.xp += xp
    row.minutes += minutes
    row.lessons += lessons
    row.reviews += reviews
